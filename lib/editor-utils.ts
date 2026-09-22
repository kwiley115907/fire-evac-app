import type { BuildingGraph, Point } from './evacuation-types';

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const DEFAULT_BBOX: BBox = { minX: 0, minY: 0, maxX: 24, maxY: 16 };

export function floorBounds(graph: BuildingGraph, floor: number): BBox {
  const points: Point[] = [];
  for (const room of graph.rooms) {
    if (room.floor === floor) points.push(...room.polygon);
  }
  for (const wall of graph.walls) {
    if (wall.floor === floor) points.push(wall.start, wall.end);
  }
  for (const c of graph.connectors) {
    if (c.floors.includes(floor)) points.push(c.position);
  }

  if (points.length === 0) return DEFAULT_BBOX;

  const minX = Math.min(...points.map((p) => p.x), 0);
  const minY = Math.min(...points.map((p) => p.y), 0);
  const maxX = Math.max(...points.map((p) => p.x), DEFAULT_BBOX.maxX);
  const maxY = Math.max(...points.map((p) => p.y), DEFAULT_BBOX.maxY);

  return { minX: minX - 2, minY: minY - 2, maxX: maxX + 2, maxY: maxY + 2 };
}
