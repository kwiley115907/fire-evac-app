import { describe, expect, it } from 'vitest';
import { sharedBoundaryPoint, snapPoint } from './editor-utils';
import { findRoomAtPoint, polygonArea } from './evacuation-geometry';
import { sampleBuilding } from './sample-building';

const square = (x0: number, y0: number, s = 10) => [
  { x: x0, y: y0 },
  { x: x0 + s, y: y0 },
  { x: x0 + s, y: y0 + s },
  { x: x0, y: y0 + s },
];

describe('sharedBoundaryPoint', () => {
  it('snaps a door onto the wall two rooms share, near the click', () => {
    expect(sharedBoundaryPoint(square(0, 0), square(10, 0), { x: 8, y: 3 })).toEqual({ x: 10, y: 3 });
  });

  it('clamps to the overlapping stretch of an offset neighbour', () => {
    // B only shares x=10, y in [5,10] with A.
    expect(sharedBoundaryPoint(square(0, 0), square(10, 5), { x: 9, y: 1 })).toEqual({ x: 10, y: 5 });
  });

  it('falls back to the nearest point on room A when rooms do not touch', () => {
    expect(sharedBoundaryPoint(square(0, 0), square(20, 0), { x: 15, y: 4 })).toEqual({ x: 10, y: 4 });
  });
});

describe('polygonArea', () => {
  it('is unsigned', () => {
    expect(polygonArea(square(0, 0))).toBe(100);
    expect(polygonArea([...square(0, 0)].reverse())).toBe(100);
  });
});

describe('sampleBuilding', () => {
  const graph = sampleBuilding();

  it('puts every door on the boundary between its two rooms', () => {
    for (const d of graph.doors) {
      const a = graph.rooms.find((r) => r.id === d.roomA)!;
      const b = graph.rooms.find((r) => r.id === d.roomB)!;
      expect(a.floor).toBe(d.floor);
      expect(b.floor).toBe(d.floor);
      expect(sharedBoundaryPoint(a.polygon, b.polygon, d.position)).toEqual(d.position);
    }
  });

  it('lands every stair inside a room on each floor it serves', () => {
    for (const c of graph.connectors) {
      for (const f of c.floors) expect(findRoomAtPoint(c.position, f, graph.rooms)).not.toBeNull();
    }
  });
});

describe('snapPoint', () => {
  const graph = sampleBuilding();
  it('snaps to a nearby corner on the same floor', () => {
    expect(snapPoint(graph, 1, { x: 12.3, y: 0.2 })).toEqual({ x: 12, y: 0 });
  });
  it('falls back to the half-metre grid', () => {
    expect(snapPoint(graph, 1, { x: 5.2, y: 4.8 })).toEqual({ x: 5, y: 5 });
  });
});
