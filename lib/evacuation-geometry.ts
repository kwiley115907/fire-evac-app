import { Point, Room } from './evacuation-types';

export function polygonCentroid(polygon: Point[]): Point {
  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < polygon.length; i++) {
    const p0 = polygon[i];
    const p1 = polygon[(i + 1) % polygon.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    area += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }

  area = area / 2;

  if (Math.abs(area) < 1e-9) {
    const n = polygon.length || 1;
    return polygon.reduce(
      (acc, p) => ({ x: acc.x + p.x / n, y: acc.y + p.y / n }),
      { x: 0, y: 0 }
    );
  }

  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return { x: cx, y: cy };
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function findRoomAtPoint(point: Point, floor: number, rooms: Room[]): Room | null {
  for (const room of rooms) {
    if (room.floor !== floor) continue;
    if (pointInPolygon(point, room.polygon)) return room;
  }
  return null;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Unsigned shoelace area, in the plan's square units (m²).
export function polygonArea(polygon: Point[]): number {
  let twice = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p0 = polygon[i];
    const p1 = polygon[(i + 1) % polygon.length];
    twice += p0.x * p1.y - p1.x * p0.y;
  }
  return Math.abs(twice) / 2;
}
