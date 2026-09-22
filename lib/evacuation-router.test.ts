import { describe, expect, it } from 'vitest';
import { findNearestExit } from './evacuation-router';
import { BuildingGraph } from './evacuation-types';

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

describe('findNearestExit', () => {
  it('routes through a door to a same-floor exit', () => {
    const graph: BuildingGraph = {
      buildingId: 'b1',
      floors: [1],
      walls: [],
      doors: [{ id: 'door-1', floor: 1, position: { x: 10, y: 5 }, roomA: 'room-a', roomB: 'room-b', widthMeters: 0.9 }],
      rooms: [room('room-a', 1, 0), room('room-b', 1, 10, true)],
      connectors: [],
    };

    const result = findNearestExit(graph, { x: 2, y: 2 }, 1);

    expect(result).not.toBeNull();
    expect(result?.reachedExitId).toBe('room-b');
    expect(result?.steps[0]).toMatchObject({ type: 'room', id: 'room-a' });
    expect(result?.steps.at(-1)).toMatchObject({ type: 'door', id: 'door-1' });
  });

  it('returns null when the start point is not inside any room', () => {
    const graph: BuildingGraph = {
      buildingId: 'b1',
      floors: [1],
      walls: [],
      doors: [],
      rooms: [room('room-a', 1, 0, true)],
      connectors: [],
    };

    expect(findNearestExit(graph, { x: 500, y: 500 }, 1)).toBeNull();
  });

  it('returns null when the building has no exits', () => {
    const graph: BuildingGraph = {
      buildingId: 'b1',
      floors: [1],
      walls: [],
      doors: [],
      rooms: [room('room-a', 1, 0, false)],
      connectors: [],
    };

    expect(findNearestExit(graph, { x: 2, y: 2 }, 1)).toBeNull();
  });

  it('routes down a stair to an exit on a different floor', () => {
    const graph: BuildingGraph = {
      buildingId: 'b1',
      floors: [1, 2],
      walls: [],
      doors: [],
      rooms: [room('room-2f', 2, 0), room('room-1f', 1, 0, true)],
      connectors: [
        {
          id: 'stair-1',
          type: 'stair',
          position: { x: 5, y: 5 },
          floors: [1, 2],
          evacuationSafe: true,
        },
      ],
    };

    const result = findNearestExit(graph, { x: 2, y: 2 }, 2);

    expect(result).not.toBeNull();
    expect(result?.reachedExitId).toBe('room-1f');
    expect(result?.steps.some((s) => s.type === 'connector' && s.id === 'stair-1')).toBe(true);
  });

  it('ignores connectors that are not evacuation-safe', () => {
    const graph: BuildingGraph = {
      buildingId: 'b1',
      floors: [1, 2],
      walls: [],
      doors: [],
      rooms: [room('room-2f', 2, 0), room('room-1f', 1, 0, true)],
      connectors: [
        {
          id: 'elevator-1',
          type: 'elevator',
          position: { x: 5, y: 5 },
          floors: [1, 2],
          evacuationSafe: false,
        },
      ],
    };

    expect(findNearestExit(graph, { x: 2, y: 2 }, 2)).toBeNull();
  });

  it('picks the nearer of two exits', () => {
    const graph: BuildingGraph = {
      buildingId: 'b1',
      floors: [1],
      walls: [],
      doors: [
        { id: 'door-near', floor: 1, position: { x: 10, y: 5 }, roomA: 'room-start', roomB: 'exit-near', widthMeters: 0.9 },
        { id: 'door-far', floor: 1, position: { x: -0.01, y: 5 }, roomA: 'room-start', roomB: 'exit-far', widthMeters: 0.9 },
      ],
      rooms: [room('room-start', 1, 0), room('exit-near', 1, 10, true), room('exit-far', 1, -100, true)],
      connectors: [],
    };

    const result = findNearestExit(graph, { x: 2, y: 2 }, 1);

    expect(result?.reachedExitId).toBe('exit-near');
  });
});
