// Escape field: one reverse Dijkstra pass outward from every available exit
// over a graph of *portals* — doors and stair landings — where crossing a
// room costs the actual walking line between two of its portals. That
// answers "how do I get out from here?" for every room at once: distance
// to safety, the next door to head for, and which exit each room drains
// to. It powers the flow map, instant re-routing around hazards, Plan B
// and the egress audit, all client-side.
//
// The original room-centroid router (evacuation-router.ts) still backs the
// server API. It charges a detour through the middle of every room, which
// can send people the long way down a long corridor; door-to-door costs
// don't, and are never longer than the router's for the same start.

import { FLIGHT_COST_PER_FLOOR } from './evacuation-router';
import { distance, findRoomAtPoint, polygonArea, polygonCentroid } from './evacuation-geometry';
import type { BuildingGraph, EvacuationRoute, Point, Room, RouteStep } from './evacuation-types';
import { crossRoom, insetPoint } from './walk-geometry';

export interface Hazards {
  // Rooms on fire: impassable, though anyone starting inside can still leave.
  rooms: string[];
  doors: string[];
  connectors: string[];
}

export const NO_HAZARDS: Hazards = { rooms: [], doors: [], connectors: [] };

// Rooms sharing an open door with a fire room are smoke-logged: passable,
// but every metre walked inside them counts as this many metres.
export const SMOKE_PENALTY = 2.5;

export function hazardCount(hazards: Hazards): number {
  return hazards.rooms.length + hazards.doors.length + hazards.connectors.length;
}

export function toggleHazard(hazards: Hazards, kind: keyof Hazards, id: string): Hazards {
  const list = hazards[kind];
  return { ...hazards, [kind]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
}

export interface Portal {
  id: string;
  kind: 'door' | 'landing';
  refId: string; // door id or connector id
  floor: number;
  position: Point;
  rooms: string[];
}

// `room` is the room crossed to get there; undefined means a stair flight.
interface PortalHop {
  to: string;
  weight: number;
  room?: string;
}

export interface EscapeField {
  portals: Map<string, Portal>;
  roomPortals: Map<string, string[]>;
  portalDistance: Map<string, number>;
  portalNext: Map<string, PortalHop>;
  portalExit: Map<string, string>;
  // Metres from each room's centre to safety. Missing = no way out.
  distance: Map<string, number>;
  // The portal each room's occupants head for first (from its centre).
  roomEntry: Map<string, string>;
  exitFor: Map<string, string>;
  exits: Set<string>;
  fireRooms: Set<string>;
  smokyRooms: Set<string>;
  rooms: Map<string, Room>;
}

class MinHeap {
  private items: [number, string][] = [];

  get size() {
    return this.items.length;
  }

  push(item: [number, string]) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop(): [number, string] | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

function lineLength(points: Point[]): number {
  let t = 0;
  for (let i = 1; i < points.length; i++) t += distance(points[i - 1], points[i]);
  return t;
}

function walk(room: Room, a: Point, b: Point, aIsDoor: boolean, bIsDoor: boolean): number {
  return lineLength(crossRoom(room, a, b, aIsDoor, bIsDoor));
}

export function computeEscapeField(
  graph: BuildingGraph,
  hazards: Hazards = NO_HAZARDS,
  options: { excludeExits?: string[] } = {}
): EscapeField {
  const rooms = new Map(graph.rooms.map((r) => [r.id, r]));
  const blockedDoors = new Set(hazards.doors);
  const blockedConnectors = new Set(hazards.connectors);
  const fireRooms = new Set(hazards.rooms.filter((id) => rooms.has(id)));
  const excluded = new Set(options.excludeExits ?? []);

  const openDoors = graph.doors.filter(
    (d) => !blockedDoors.has(d.id) && d.roomA !== d.roomB && rooms.has(d.roomA) && rooms.has(d.roomB)
  );

  const smokyRooms = new Set<string>();
  for (const d of openDoors) {
    if (fireRooms.has(d.roomA) && !fireRooms.has(d.roomB)) smokyRooms.add(d.roomB);
    if (fireRooms.has(d.roomB) && !fireRooms.has(d.roomA)) smokyRooms.add(d.roomA);
  }
  const factor = (roomId: string) => (smokyRooms.has(roomId) ? SMOKE_PENALTY : 1);

  const portals = new Map<string, Portal>();
  const roomPortals = new Map<string, string[]>();
  const addPortal = (p: Portal) => {
    portals.set(p.id, p);
    for (const r of p.rooms) {
      if (!roomPortals.has(r)) roomPortals.set(r, []);
      roomPortals.get(r)!.push(p.id);
    }
  };

  for (const d of openDoors) {
    addPortal({ id: `d:${d.id}`, kind: 'door', refId: d.id, floor: d.floor, position: d.position, rooms: [d.roomA, d.roomB] });
  }

  const adjacency = new Map<string, PortalHop[]>();
  const link = (a: string, b: string, weight: number, room?: string) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push({ to: b, weight, room });
    adjacency.get(b)!.push({ to: a, weight, room });
  };

  for (const c of graph.connectors) {
    if (!c.evacuationSafe || blockedConnectors.has(c.id)) continue;
    const floors = [...new Set(c.floors)].sort((a, b) => a - b);
    floors.forEach((floor, i) => {
      const room = findRoomAtPoint(c.position, floor, graph.rooms);
      addPortal({ id: `l:${c.id}@${floor}`, kind: 'landing', refId: c.id, floor, position: c.position, rooms: room ? [room.id] : [] });
      if (i > 0) link(`l:${c.id}@${floors[i - 1]}`, `l:${c.id}@${floor}`, FLIGHT_COST_PER_FLOOR * (floor - floors[i - 1]));
    });
  }

  for (const [roomId, ids] of roomPortals) {
    if (fireRooms.has(roomId)) continue; // never walk through a burning room
    const room = rooms.get(roomId)!;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = portals.get(ids[i])!;
        const b = portals.get(ids[j])!;
        link(a.id, b.id, walk(room, a.position, b.position, a.kind === 'door', b.kind === 'door') * factor(roomId), roomId);
      }
    }
  }

  const exits = new Set(graph.rooms.filter((r) => r.isExit && !fireRooms.has(r.id) && !excluded.has(r.id)).map((r) => r.id));
  const portalDistance = new Map<string, number>();
  const portalNext = new Map<string, PortalHop>();
  const portalExit = new Map<string, string>();
  const settled = new Set<string>();
  const heap = new MinHeap();

  for (const exitId of exits) {
    for (const id of roomPortals.get(exitId) ?? []) {
      if (portalDistance.has(id)) continue;
      portalDistance.set(id, 0);
      portalExit.set(id, exitId);
      heap.push([0, id]);
    }
  }

  while (heap.size > 0) {
    const [d, id] = heap.pop()!;
    if (settled.has(id)) continue;
    settled.add(id);
    for (const edge of adjacency.get(id) ?? []) {
      if (settled.has(edge.to)) continue;
      const candidate = d + edge.weight;
      if (candidate < (portalDistance.get(edge.to) ?? Infinity)) {
        portalDistance.set(edge.to, candidate);
        // Edges are symmetric, so the hop back toward `id` costs the same.
        portalNext.set(edge.to, { to: id, weight: edge.weight, room: edge.room });
        portalExit.set(edge.to, portalExit.get(id)!);
        heap.push([candidate, edge.to]);
      }
    }
  }

  const field: EscapeField = {
    portals,
    roomPortals,
    portalDistance,
    portalNext,
    portalExit,
    distance: new Map(),
    roomEntry: new Map(),
    exitFor: new Map(),
    exits,
    fireRooms,
    smokyRooms,
    rooms,
  };

  for (const room of graph.rooms) {
    if (exits.has(room.id)) {
      field.distance.set(room.id, 0);
      field.exitFor.set(room.id, room.id);
      continue;
    }
    const best = bestPortal(field, room, polygonCentroid(room.polygon));
    if (!best) continue;
    field.distance.set(room.id, best.cost);
    field.roomEntry.set(room.id, best.portal);
    field.exitFor.set(room.id, portalExit.get(best.portal)!);
  }

  return field;
}

function bestPortal(field: EscapeField, room: Room, from: Point): { portal: string; cost: number } | null {
  let best: { portal: string; cost: number } | null = null;
  const f = field.smokyRooms.has(room.id) ? SMOKE_PENALTY : 1;
  for (const id of field.roomPortals.get(room.id) ?? []) {
    const rest = field.portalDistance.get(id);
    if (rest === undefined) continue;
    const p = field.portals.get(id)!;
    const cost = walk(room, from, p.position, false, p.kind === 'door') * f + rest;
    if (!best || cost < best.cost) best = { portal: id, cost };
  }
  return best;
}

function portalStep(p: Portal): RouteStep {
  return { type: p.kind === 'door' ? 'door' : 'connector', id: p.refId, floor: p.floor, position: p.position };
}

export function routeFromRoom(field: EscapeField, room: Room, startPoint: Point): EvacuationRoute | null {
  const steps: RouteStep[] = [{ type: 'room', id: room.id, floor: room.floor, position: startPoint }];
  if (field.exits.has(room.id)) return { steps, totalDistanceMeters: 0, reachedExitId: room.id };

  const best = bestPortal(field, room, startPoint);
  if (!best) return null;

  let q = best.portal;
  steps.push(portalStep(field.portals.get(q)!));
  for (let guard = 0; guard <= field.portals.size; guard++) {
    if (field.portalDistance.get(q) === 0) {
      const exitId = field.portalExit.get(q)!;
      const portal = field.portals.get(q)!;
      // A stair that lets straight out into an exit room.
      if (portal.kind === 'landing') {
        const exitRoom = field.rooms.get(exitId)!;
        steps.push({ type: 'room', id: exitId, floor: portal.floor, position: polygonCentroid(exitRoom.polygon) });
      }
      return { steps, totalDistanceMeters: best.cost, reachedExitId: exitId };
    }
    const hop = field.portalNext.get(q);
    if (!hop) return null;
    const next = field.portals.get(hop.to)!;
    if (hop.room !== undefined && steps[steps.length - 1].type === 'connector') {
      // Stepping off a stair landing into the room we're about to cross.
      const r = field.rooms.get(hop.room)!;
      steps.push({ type: 'room', id: hop.room, floor: next.floor, position: polygonCentroid(r.polygon) });
    }
    steps.push(portalStep(next));
    q = hop.to;
  }
  return null;
}

export function routeFromPoint(
  graph: BuildingGraph,
  field: EscapeField,
  point: Point,
  floor: number
): EvacuationRoute | null {
  const room = findRoomAtPoint(point, floor, graph.rooms);
  if (!room) return null;
  return routeFromRoom(field, room, point);
}

export interface EvacuationPlan {
  room: Room;
  primary: EvacuationRoute | null;
  // Best route that does NOT use the primary route's exit — what you'd do if
  // you got there and found it chained, crowded, or full of smoke.
  alternate: EvacuationRoute | null;
}

export function planEvacuation(
  graph: BuildingGraph,
  hazards: Hazards,
  point: Point,
  floor: number,
  field: EscapeField = computeEscapeField(graph, hazards)
): EvacuationPlan | null {
  const room = findRoomAtPoint(point, floor, graph.rooms);
  if (!room) return null;
  const primary = routeFromRoom(field, room, point);
  let alternate: EvacuationRoute | null = null;
  if (primary && primary.steps.length > 1) {
    const altField = computeEscapeField(graph, hazards, { excludeExits: [primary.reachedExitId] });
    alternate = routeFromRoom(altField, room, point);
  }
  return { room, primary, alternate };
}

export interface FlowSegment {
  id: string;
  floor: number;
  points: Point[];
  // Floor area (m²) of every room that drains through this segment — the
  // stream gets thicker where more of the building funnels through.
  volume: number;
  // Metres from the segment's upstream end to safety.
  distance: number;
}

// The escape field drawn as a river network: each room's stream to the
// door its occupants head for, then door-to-door along the shortest-path
// tree to the exits. Stair flights are left to the 3D stack view.
export function flowNetwork(graph: BuildingGraph, field: EscapeField): FlowSegment[] {
  const volume = new Map<string, number>();
  const segments: FlowSegment[] = [];

  for (const room of graph.rooms) {
    const entry = field.roomEntry.get(room.id);
    if (!entry) continue;
    const area = Math.max(1, polygonArea(room.polygon));
    volume.set(entry, (volume.get(entry) ?? 0) + area);
    const p = field.portals.get(entry)!;
    segments.push({
      id: `room:${room.id}`,
      floor: room.floor,
      points: crossRoom(room, polygonCentroid(room.polygon), p.position, false, p.kind === 'door'),
      volume: area,
      distance: field.distance.get(room.id) ?? 0,
    });
  }

  const ordered = [...field.portalNext.keys()].sort(
    (a, b) => (field.portalDistance.get(b) ?? 0) - (field.portalDistance.get(a) ?? 0)
  );
  for (const id of ordered) {
    const hop = field.portalNext.get(id)!;
    volume.set(hop.to, (volume.get(hop.to) ?? 0) + (volume.get(id) ?? 0));
  }

  for (const id of ordered) {
    const hop = field.portalNext.get(id)!;
    if (hop.room === undefined || !volume.get(id)) continue;
    const a = field.portals.get(id)!;
    const b = field.portals.get(hop.to)!;
    segments.push({
      id: `${id}->${hop.to}`,
      floor: a.floor,
      points: crossRoom(field.rooms.get(hop.room)!, a.position, b.position, a.kind === 'door', b.kind === 'door'),
      volume: volume.get(id)!,
      distance: field.portalDistance.get(id) ?? 0,
    });
  }

  // The last step out through each exit door.
  for (const [id, exitId] of field.portalExit) {
    if (field.portalDistance.get(id) !== 0 || !volume.get(id)) continue;
    const p = field.portals.get(id)!;
    const out = p.kind === 'door' ? insetPoint(field.rooms.get(exitId)!, p.position) : null;
    if (!out) continue;
    segments.push({ id: `${id}->out`, floor: p.floor, points: [p.position, out], volume: volume.get(id)!, distance: 0 });
  }
  return segments;
}

export interface EgressAudit {
  roomCount: number;
  exitCount: number;
  unreachable: Room[];
  longest: { room: Room; meters: number } | null;
  overLimit: { room: Room; meters: number }[];
  // Rooms that lose every way out if their nearest exit is lost.
  singleExit: Room[];
  exitLoad: { exit: Room; rooms: number; area: number }[];
}

export function auditEgress(graph: BuildingGraph, hazards: Hazards, limitMeters: number): EgressAudit {
  const field = computeEscapeField(graph, hazards);
  const occupied = graph.rooms.filter((r) => !r.isExit);
  const exits = graph.rooms.filter((r) => field.exits.has(r.id));

  const unreachable = occupied.filter((r) => !field.distance.has(r.id));
  const reachable = occupied
    .filter((r) => field.distance.has(r.id))
    .map((room) => ({ room, meters: field.distance.get(room.id)! }))
    .sort((a, b) => b.meters - a.meters);

  const singleExit: Room[] = [];
  for (const exit of exits) {
    const dependents = reachable.filter(({ room }) => field.exitFor.get(room.id) === exit.id);
    if (dependents.length === 0) continue;
    const without = computeEscapeField(graph, hazards, { excludeExits: [exit.id] });
    for (const { room } of dependents) {
      if (!without.distance.has(room.id)) singleExit.push(room);
    }
  }

  const exitLoad = exits
    .map((exit) => {
      const served = reachable.filter(({ room }) => field.exitFor.get(room.id) === exit.id);
      return {
        exit,
        rooms: served.length,
        area: served.reduce((sum, { room }) => sum + polygonArea(room.polygon), 0),
      };
    })
    .sort((a, b) => b.area - a.area);

  return {
    roomCount: occupied.length,
    exitCount: exits.length,
    unreachable,
    longest: reachable[0] ?? null,
    overLimit: reachable.filter((r) => r.meters > limitMeters),
    singleExit,
    exitLoad,
  };
}
