import { describe, expect, it } from 'vitest';
import { findNearestExit } from './evacuation-router';
import {
  auditEgress,
  computeEscapeField,
  flowNetwork,
  NO_HAZARDS,
  planEvacuation,
  routeFromPoint,
  SMOKE_PENALTY,
  toggleHazard,
} from './evacuation-field';
import { polygonCentroid } from './evacuation-geometry';
import { sampleBuilding } from './sample-building';
import type { BuildingGraph } from './evacuation-types';

function room(id: string, floor: number, x0: number, isExit = false) {
  return {
    id,
    floor,
    isExit,
    polygon: [
      { x: x0, y: 0 },
      { x: x0 + 10, y: 0 },
      { x: x0 + 10, y: 10 },
      { x: x0, y: 10 },
    ],
  };
}

// exit-west | hall (40 m) | start | mid | exit-east
function corridorGraph(): BuildingGraph {
  return {
    buildingId: 'b1',
    floors: [1],
    walls: [],
    doors: [
      { id: 'd-start-mid', floor: 1, position: { x: 10, y: 5 }, roomA: 'start', roomB: 'mid', widthMeters: 0.9 },
      { id: 'd-mid-east', floor: 1, position: { x: 20, y: 5 }, roomA: 'mid', roomB: 'exit-east', widthMeters: 0.9 },
      { id: 'd-start-hall', floor: 1, position: { x: 0, y: 5 }, roomA: 'start', roomB: 'hall', widthMeters: 0.9 },
      { id: 'd-hall-west', floor: 1, position: { x: -40, y: 5 }, roomA: 'hall', roomB: 'exit-west', widthMeters: 0.9 },
    ],
    rooms: [
      room('start', 1, 0),
      room('mid', 1, 10),
      room('exit-east', 1, 20, true),
      {
        id: 'hall',
        floor: 1,
        isExit: false,
        polygon: [{ x: -40, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }, { x: -40, y: 10 }],
      },
      room('exit-west', 1, -50, true),
    ],
    connectors: [],
  };
}

describe('computeEscapeField', () => {
  it('agrees with findNearestExit on reachability and is never longer', () => {
    const graph = sampleBuilding();
    const field = computeEscapeField(graph);
    for (const r of graph.rooms) {
      const start = polygonCentroid(r.polygon);
      const router = findNearestExit(graph, start, r.floor);
      const route = routeFromPoint(graph, field, start, r.floor);
      expect(route === null).toBe(router === null);
      expect(route!.totalDistanceMeters).toBeLessThanOrEqual(router!.totalDistanceMeters + 1e-6);
    }
  });

  it('takes the stair right next door instead of a long corridor detour', () => {
    // The centroid router sends the Board Room the long way via the West
    // Stair because it charges a walk to the middle of each corridor.
    const graph = sampleBuilding();
    const route = routeFromPoint(graph, computeEscapeField(graph), { x: 34, y: 5 }, 3)!;
    expect(route.reachedExitId).toBe('exit-east');
    expect(route.steps.some((s) => s.type === 'connector' && s.id === 'stair-east')).toBe(true);
    expect(findNearestExit(graph, { x: 34, y: 5 }, 3)!.reachedExitId).toBe('exit-front');
  });

  it('reaches an exit from every room of the sample building', () => {
    const graph = sampleBuilding();
    const field = computeEscapeField(graph);
    for (const r of graph.rooms) expect(field.distance.has(r.id)).toBe(true);
  });

  it('never routes through a room on fire', () => {
    const graph = corridorGraph();
    const field = computeEscapeField(graph, { ...NO_HAZARDS, rooms: ['mid'] });
    const route = routeFromPoint(graph, field, { x: 5, y: 5 }, 1);
    expect(route?.reachedExitId).toBe('exit-west');
    expect(route?.steps.some((s) => s.id === 'mid')).toBe(false);
  });

  it('still lets someone inside a burning room get out', () => {
    const graph = corridorGraph();
    const field = computeEscapeField(graph, { ...NO_HAZARDS, rooms: ['start'] });
    const route = routeFromPoint(graph, field, { x: 5, y: 5 }, 1);
    expect(route).not.toBeNull();
    expect(route?.reachedExitId).toBe('exit-east');
  });

  it('treats blocked doors as impassable', () => {
    const graph = corridorGraph();
    const field = computeEscapeField(graph, { ...NO_HAZARDS, doors: ['d-mid-east'] });
    expect(routeFromPoint(graph, field, { x: 5, y: 5 }, 1)?.reachedExitId).toBe('exit-west');
  });

  it('ignores exits that are on fire', () => {
    const graph = corridorGraph();
    const field = computeEscapeField(graph, { ...NO_HAZARDS, rooms: ['exit-east'] });
    expect(field.distance.has('exit-east')).toBe(true); // reachable to leave, but not a destination
    expect(routeFromPoint(graph, field, { x: 5, y: 5 }, 1)?.reachedExitId).toBe('exit-west');
  });

  it('penalises smoke-logged rooms next to a fire', () => {
    const graph: BuildingGraph = {
      buildingId: 'b1',
      floors: [1],
      walls: [],
      doors: [
        { id: 'd1', floor: 1, position: { x: 10, y: 5 }, roomA: 'start', roomB: 'mid', widthMeters: 0.9 },
        { id: 'd2', floor: 1, position: { x: 20, y: 5 }, roomA: 'mid', roomB: 'exit', widthMeters: 0.9 },
        { id: 'd-fire', floor: 1, position: { x: 15, y: 10 }, roomA: 'mid', roomB: 'fire', widthMeters: 0.9 },
      ],
      rooms: [
        room('start', 1, 0),
        room('mid', 1, 10),
        room('exit', 1, 20, true),
        { ...room('fire', 1, 10), polygon: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }] },
      ],
      connectors: [],
    };
    const clear = computeEscapeField(graph);
    const smoky = computeEscapeField(graph, { ...NO_HAZARDS, rooms: ['fire'] });
    expect(smoky.smokyRooms.has('mid')).toBe(true);
    // Entering "mid" (10 m from start's centroid) costs SMOKE_PENALTY x.
    expect(smoky.distance.get('start')! - clear.distance.get('start')!).toBeCloseTo(10 * (SMOKE_PENALTY - 1), 6);
  });

  it('respects blocked stairs', () => {
    const graph = sampleBuilding();
    const both = computeEscapeField(graph, { ...NO_HAZARDS, connectors: ['stair-west', 'stair-east'] });
    expect(both.distance.has('f3-west')).toBe(false);
    expect(both.distance.has('f1-lobby')).toBe(true);
  });
});

describe('planEvacuation', () => {
  it('offers a Plan B through a different exit', () => {
    const graph = corridorGraph();
    const plan = planEvacuation(graph, NO_HAZARDS, { x: 5, y: 5 }, 1);
    expect(plan?.primary?.reachedExitId).toBe('exit-east');
    expect(plan?.alternate?.reachedExitId).toBe('exit-west');
  });

  it('has no Plan B when only one exit exists', () => {
    const graph = corridorGraph();
    graph.rooms = graph.rooms.filter((r) => r.id !== 'exit-west' && r.id !== 'hall');
    graph.doors = graph.doors.filter((d) => d.id !== 'd-start-hall' && d.id !== 'd-hall-west');
    const plan = planEvacuation(graph, NO_HAZARDS, { x: 5, y: 5 }, 1);
    expect(plan?.primary).not.toBeNull();
    expect(plan?.alternate).toBeNull();
  });
});

describe('flowNetwork', () => {
  it('accumulates upstream floor area into downstream segments', () => {
    const graph = corridorGraph();
    const segs = new Map(flowNetwork(graph, computeEscapeField(graph)).map((s) => [s.id, s]));
    expect(segs.get('room:start')?.volume).toBe(100);
    // start drains through mid; mid's own area joins at its exit door.
    const through = segs.get('d:d-start-mid->d:d-mid-east')!;
    expect(through.volume).toBe(100);
    expect(through.points).toHaveLength(4); // door, step in, step to, door
    expect(segs.get('d:d-mid-east->out')?.volume).toBe(200);
    expect(segs.get('d:d-hall-west->out')?.volume).toBe(400);
  });
});

describe('auditEgress', () => {
  it('flags unreachable rooms, single-exit dependence and the travel limit', () => {
    const graph = corridorGraph();
    graph.rooms.push(room('island', 1, 100));
    const audit = auditEgress(graph, toggleHazard(NO_HAZARDS, 'doors', 'd-start-hall'), 12);
    expect(audit.unreachable.map((r) => r.id)).toEqual(['island']);
    // With the start<->hall door blocked each side depends on one exit.
    expect(audit.singleExit.map((r) => r.id).sort()).toEqual(['hall', 'mid', 'start']);
    expect(audit.longest).toMatchObject({ room: { id: 'hall' }, meters: 20 });
    expect(audit.overLimit.map((r) => r.room.id)).toEqual(['hall', 'start']);
    expect(audit.exitLoad.map((e) => [e.exit.id, e.rooms])).toEqual([
      ['exit-west', 1],
      ['exit-east', 2],
    ]);
  });
});
