import { describe, expect, it } from 'vitest';
import { distance, findRoomAtPoint, pointInPolygon, polygonCentroid } from './evacuation-geometry';
import { Room } from './evacuation-types';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('polygonCentroid', () => {
  it('finds the centroid of a square', () => {
    expect(polygonCentroid(square)).toEqual({ x: 5, y: 5 });
  });

  it('falls back to the vertex average for a degenerate (zero-area) polygon', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(polygonCentroid(line)).toEqual({ x: 5, y: 0 });
  });
});

describe('pointInPolygon', () => {
  it('returns true for a point inside the polygon', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it('returns false for a point outside the polygon', () => {
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
});

describe('findRoomAtPoint', () => {
  const rooms: Room[] = [
    { id: 'room-1f', floor: 1, polygon: square, isExit: false },
    { id: 'room-2f', floor: 2, polygon: square, isExit: false },
  ];

  it('matches only rooms on the requested floor', () => {
    expect(findRoomAtPoint({ x: 5, y: 5 }, 1, rooms)?.id).toBe('room-1f');
    expect(findRoomAtPoint({ x: 5, y: 5 }, 2, rooms)?.id).toBe('room-2f');
  });

  it('returns null when no room contains the point', () => {
    expect(findRoomAtPoint({ x: 500, y: 500 }, 1, rooms)).toBeNull();
  });
});

describe('distance', () => {
  it('computes euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
