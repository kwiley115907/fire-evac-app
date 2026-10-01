// Turns an EvacuationRoute (a list of rooms, doors and stair hops) into
// what a person actually needs under stress: short, turn-by-turn
// maneuvers with distances, plus the geometry to draw and fly the camera
// along. Turns are computed from the plan geometry, not guessed.

import { FLIGHT_COST_PER_FLOOR } from './evacuation-router';
import { distance, polygonCentroid } from './evacuation-geometry';
import type { BuildingGraph, DoorOpening, EvacuationRoute, Point } from './evacuation-types';
import { crossRoomPoints, insetPoint, stepInto } from './walk-geometry';

// Typical unimpeded horizontal walking speed during an evacuation (m/s),
// and the time to descend or climb one storey of stairs (s).
export const WALK_SPEED_MPS = 1.2;
export const SECONDS_PER_FLIGHT = 12;

export type Turn =
  | 'straight'
  | 'slight-left'
  | 'left'
  | 'sharp-left'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'u-turn';

export type ManeuverKind = 'start' | 'door' | 'stairs-down' | 'stairs-up' | 'leave-stair' | 'exit' | 'at-exit';

export interface Maneuver {
  kind: ManeuverKind;
  turn: Turn | null;
  instruction: string;
  target: string;
  meters: number;
  seconds: number;
  cumulativeSeconds: number;
  floor: number;
  // The leg's geometry on `floor`, for highlighting and camera focus.
  points: Point[];
}

export interface RouteGuide {
  maneuvers: Maneuver[];
  meters: number;
  seconds: number;
  exitName: string;
  startFloor: number;
  exitFloor: number;
}

export interface FloorPath {
  floor: number;
  points: Point[];
}

const TURN_WORDS: Record<Turn, string> = {
  straight: 'Go straight',
  'slight-left': 'Bear left',
  left: 'Turn left',
  'sharp-left': 'Sharp left',
  'slight-right': 'Bear right',
  right: 'Turn right',
  'sharp-right': 'Sharp right',
  'u-turn': 'Turn around',
};

// Plan coordinates are SVG-style (y grows downward), so a positive cross
// product is a clockwise — i.e. right-hand — turn.
export function classifyTurn(heading: Point, next: Point): Turn | null {
  if (Math.hypot(heading.x, heading.y) < 1e-6 || Math.hypot(next.x, next.y) < 1e-6) return null;
  const cross = heading.x * next.y - heading.y * next.x;
  const dot = heading.x * next.x + heading.y * next.y;
  const deg = (Math.atan2(cross, dot) * 180) / Math.PI;
  const mag = Math.abs(deg);
  if (mag < 25) return 'straight';
  if (mag > 160) return 'u-turn';
  const side = deg > 0 ? 'right' : 'left';
  if (mag < 60) return `slight-${side}` as Turn;
  if (mag < 135) return side;
  return `sharp-${side}` as Turn;
}

export function turnWord(turn: Turn | null): string {
  return turn ? TURN_WORDS[turn] : 'Head';
}

function roomLabel(graph: BuildingGraph, id: string): string {
  return graph.rooms.find((r) => r.id === id)?.name?.trim() || 'the next room';
}

function connectorLabel(graph: BuildingGraph, id: string): string {
  const c = graph.connectors.find((x) => x.id === id);
  if (!c) return 'the stairs';
  return c.name?.trim() || (c.type === 'elevator' ? 'the elevator' : 'the stairs');
}

function formatMeters(m: number): string {
  return `${Math.max(1, Math.round(m))} m`;
}

function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

type WalkRole = 'start' | 'approach' | 'door' | 'depart' | 'connector';
interface WalkPoint {
  floor: number;
  p: Point;
  role: WalkRole;
  step: number;
  // For doors: the direction you face once through, into the next room.
  inward?: Point;
}

// The line a person actually walks: square-on through each door (a point
// just inside the room being left, one just inside the room entered),
// straight across rooms, and through stair landings. Uses the same
// crossRoom() geometry the escape field costs routes with.
function walkPoints(graph: BuildingGraph, route: EvacuationRoute): WalkPoint[] {
  const steps = route.steps;
  const rooms = new Map(graph.rooms.map((r) => [r.id, r]));
  const out: WalkPoint[] = [{ floor: steps[0].floor, p: steps[0].position, role: 'start', step: 0 }];
  let current = steps[0].id;
  let anchor = { p: steps[0].position, isDoor: false };

  const cross = (to: Point, toIsDoor: boolean, floor: number, step: number) => {
    const room = rooms.get(current);
    if (!room) return;
    for (const m of crossRoomPoints(room, anchor.p, to, anchor.isDoor, toIsDoor)) out.push({ floor, p: m.p, role: m.role, step });
  };

  for (let i = 1; i < steps.length; i++) {
    const s = steps[i];
    if (s.type === 'room') {
      current = s.id; // stepped off a stair landing into this room
      continue;
    }
    if (s.type === 'connector') {
      if (out[out.length - 1].floor === s.floor) cross(s.position, false, s.floor, i);
      out.push({ floor: s.floor, p: s.position, role: 'connector', step: i });
      anchor = { p: s.position, isDoor: false };
      continue;
    }
    const door: DoorOpening | undefined = graph.doors.find((d) => d.id === s.id);
    const next = door ? (door.roomA === current ? door.roomB : door.roomA) : current;
    cross(s.position, true, s.floor, i);
    const into = rooms.get(next);
    out.push({ floor: s.floor, p: s.position, role: 'door', step: i, inward: into ? stepInto(into, s.position).normal : undefined });
    if (i === steps.length - 1 && into) {
      const outside = insetPoint(into, s.position);
      if (outside) out.push({ floor: s.floor, p: outside, role: 'depart', step: i });
    }
    current = next;
    anchor = { p: s.position, isDoor: true };
  }
  return out;
}

// The route as drawable polylines, one run per floor visit.
export function routeFloorPaths(graph: BuildingGraph, route: EvacuationRoute): FloorPath[] {
  const paths: FloorPath[] = [];
  for (const w of walkPoints(graph, route)) {
    const last = paths[paths.length - 1];
    if (!last || last.floor !== w.floor) paths.push({ floor: w.floor, points: [w.p] });
    else last.points.push(w.p);
  }
  return paths;
}

export function buildGuide(graph: BuildingGraph, route: EvacuationRoute): RouteGuide {
  const steps = route.steps;
  const start = steps[0];
  const walk = walkPoints(graph, route);
  const maneuvers: Maneuver[] = [];
  let elapsed = 0;
  let meters = 0;

  const push = (m: Omit<Maneuver, 'cumulativeSeconds'>) => {
    elapsed += m.seconds;
    meters += m.meters;
    maneuvers.push({ ...m, cumulativeSeconds: elapsed });
  };

  const exitName = roomLabel(graph, route.reachedExitId);
  const startRoom = graph.rooms.find((r) => r.id === start.id);

  push({
    kind: 'start',
    turn: null,
    instruction: 'You are here',
    target: `${startRoom?.name?.trim() || 'Unnamed room'} · Floor ${start.floor}`,
    meters: 0,
    seconds: 0,
    floor: start.floor,
    points: [start.position],
  });

  if (steps.length === 1) {
    push({
      kind: 'at-exit',
      turn: null,
      instruction: 'You are at an exit',
      target: `Leave via ${exitName} and keep moving away from the building`,
      meters: 0,
      seconds: 0,
      floor: start.floor,
      points: [start.position],
    });
    return { maneuvers, meters: 0, seconds: 0, exitName, startFloor: start.floor, exitFloor: start.floor };
  }

  // Each maneuver covers the walk from where the previous one ended up to
  // (and through) its own door or stair, so the legs add up to the line.
  let leg: WalkPoint[] = [walk[0]];
  let floor = start.floor;
  let heading: Point | null = null;
  let currentRoom = start.id;
  const lastDoorStep = Math.max(...walk.filter((w) => w.role === 'door').map((w) => w.step), -1);

  for (let k = 1; k < walk.length; k++) {
    const w = walk[k];
    leg.push(w);

    if (w.role === 'door') {
      const isExit = w.step === lastDoorStep && w.step === steps.length - 1;
      if (isExit && walk[k + 1]?.role === 'depart') {
        k++;
        leg.push(walk[k]);
      }
      const step = steps[w.step];
      const door = graph.doors.find((d) => d.id === step.id);
      const nextRoom = door ? (door.roomA === currentRoom ? door.roomB : door.roomA) : currentRoom;
      const doorIdx = leg.indexOf(w);
      // Direction of travel across the room: from just inside it (or where
      // we started) to just short of the door we're heading for.
      const from = (leg[1]?.role === 'depart' ? leg[1] : leg[0]).p;
      const before = leg[doorIdx - 1];
      const to = before && before.role === 'approach' ? before.p : w.p;
      const turn = heading ? classifyTurn(heading, { x: to.x - from.x, y: to.y - from.y }) : null;
      const points = leg.map((x) => x.p);
      const legMeters = pathLength(points);
      push({
        kind: isExit ? 'exit' : 'door',
        turn,
        instruction: turnWord(turn),
        target: isExit
          ? `${formatMeters(legMeters)}, then out through ${roomLabel(graph, nextRoom)}`
          : `${formatMeters(legMeters)}, through the door into ${roomLabel(graph, nextRoom)}`,
        meters: legMeters,
        seconds: legMeters / WALK_SPEED_MPS,
        floor,
        points,
      });
      currentRoom = nextRoom;
      heading = w.inward ?? null; // through a door you face square into the next room
      leg = [w];
      continue;
    }

    if (w.role === 'connector') {
      // Fold the walk to the stairwell plus every consecutive flight of the
      // same connector into one maneuver.
      const step = steps[w.step];
      const fromFloor = floor;
      const approachPoints = leg.map((x) => x.p);
      const approach = pathLength(approachPoints);
      let toFloor = w.floor;
      while (k + 1 < walk.length && walk[k + 1].role === 'connector' && steps[walk[k + 1].step].id === step.id) {
        k++;
        toFloor = walk[k].floor;
      }
      const flights = Math.abs(toFloor - fromFloor);
      const down = toFloor < fromFloor;
      push({
        kind: down ? 'stairs-down' : 'stairs-up',
        turn: null,
        instruction: `Take ${connectorLabel(graph, step.id)} ${down ? 'down' : 'up'}`,
        target:
          flights === 0
            ? `${formatMeters(approach)} to the stairwell`
            : `${flights} floor${flights === 1 ? '' : 's'} to Floor ${toFloor}`,
        meters: approach + FLIGHT_COST_PER_FLOOR * flights,
        seconds: approach / WALK_SPEED_MPS + SECONDS_PER_FLIGHT * flights,
        floor: fromFloor,
        points: approachPoints,
      });
      floor = toFloor;
      heading = null; // you come out of a stairwell facing who-knows-where
      leg = [walk[k]];

      // Say which room the stair lets out into.
      const landing = steps.findIndex((s, idx) => idx > walk[k].step && s.type === 'room');
      if (landing !== -1 && steps.slice(walk[k].step + 1, landing).every((s) => s.type === 'connector')) {
        const roomStep = steps[landing];
        currentRoom = roomStep.id;
        const isExit = roomStep.id === route.reachedExitId && landing === steps.length - 1;
        push({
          kind: isExit ? 'exit' : 'leave-stair',
          turn: null,
          instruction: 'Leave the stairwell',
          target: isExit
            ? `straight out through ${roomLabel(graph, roomStep.id)}`
            : /stair/i.test(roomLabel(graph, roomStep.id))
              ? `on Floor ${toFloor}`
              : `into ${roomLabel(graph, roomStep.id)} on Floor ${toFloor}`,
          meters: 0,
          seconds: 0,
          floor: toFloor,
          points: [walk[k].p],
        });
      }
    }
  }

  return { maneuvers, meters, seconds: elapsed, exitName, startFloor: start.floor, exitFloor: floor };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface TimedPath extends FloorPath {
  startSeconds: number;
  endSeconds: number;
}

// Per-floor polylines stamped with when you'd be walking them — the same
// clock buildGuide() uses, so countdown markers agree with the ETA.
export function routeTimeline(graph: BuildingGraph, route: EvacuationRoute): TimedPath[] {
  const paths = routeFloorPaths(graph, route);
  let t = 0;
  return paths.map((path, i) => {
    if (i > 0) t += SECONDS_PER_FLIGHT * Math.abs(path.floor - paths[i - 1].floor);
    const startSeconds = t;
    t += pathLength(path.points) / WALK_SPEED_MPS;
    return { ...path, startSeconds, endSeconds: t };
  });
}

// A marker every `interval` seconds of walking along one timed path.
export function timeMarkers(path: TimedPath, interval: number): { point: Point; seconds: number }[] {
  const out: { point: Point; seconds: number }[] = [];
  let t = path.startSeconds;
  let nextMark = Math.floor(t / interval) * interval + interval;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1];
    const b = path.points[i];
    const legSeconds = distance(a, b) / WALK_SPEED_MPS;
    while (legSeconds > 0 && nextMark <= t + legSeconds) {
      const f = (nextMark - t) / legSeconds;
      out.push({ point: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, seconds: nextMark });
      nextMark += interval;
    }
    t += legSeconds;
  }
  return out;
}

// Walking time to safety from the middle of every room that has a way out
// — the numbers on the flow map. Same clock as the guide.
export function roomEtas(
  graph: BuildingGraph,
  route: (roomId: string, start: Point) => EvacuationRoute | null
): Map<string, number> {
  const etas = new Map<string, number>();
  for (const room of graph.rooms) {
    const r = route(room.id, polygonCentroid(room.polygon));
    if (!r) continue;
    const timeline = routeTimeline(graph, r);
    etas.set(room.id, timeline.length ? timeline[timeline.length - 1].endSeconds : 0);
  }
  return etas;
}
