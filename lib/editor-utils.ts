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

function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return a;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

// Where a door between two rooms should sit: on the stretch of wall the
// two polygons share, as close as possible to where the user clicked.
// Falls back to the closest point on room A's outline when the rooms
// don't actually touch (e.g. hand-drawn with a small gap).
export function sharedBoundaryPoint(a: Point[], b: Point[], hint: Point, tolerance = 0.25): Point {
  let best: Point | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < a.length; i++) {
    const a0 = a[i];
    const a1 = a[(i + 1) % a.length];
    const len = Math.hypot(a1.x - a0.x, a1.y - a0.y);
    if (len < 1e-9) continue;
    const ux = (a1.x - a0.x) / len;
    const uy = (a1.y - a0.y) / len;

    for (let j = 0; j < b.length; j++) {
      const b0 = b[j];
      const b1 = b[(j + 1) % b.length];
      // Both of B's endpoints must lie on A's edge line…
      const off0 = Math.abs((b0.x - a0.x) * uy - (b0.y - a0.y) * ux);
      const off1 = Math.abs((b1.x - a0.x) * uy - (b1.y - a0.y) * ux);
      if (off0 > tolerance || off1 > tolerance) continue;
      // …and overlap it along that line.
      const t0 = (b0.x - a0.x) * ux + (b0.y - a0.y) * uy;
      const t1 = (b1.x - a0.x) * ux + (b1.y - a0.y) * uy;
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(len, Math.max(t0, t1));
      if (hi - lo < 0.3) continue;
      const s = { x: a0.x + ux * lo, y: a0.y + uy * lo };
      const e = { x: a0.x + ux * hi, y: a0.y + uy * hi };
      const candidate = closestOnSegment(hint, s, e);
      const d = Math.hypot(candidate.x - hint.x, candidate.y - hint.y);
      if (d < bestDist) {
        bestDist = d;
        best = candidate;
      }
    }
  }

  if (best) return { x: Math.round(best.x * 10) / 10, y: Math.round(best.y * 10) / 10 };

  let fallback = a[0];
  let fallbackDist = Infinity;
  for (let i = 0; i < a.length; i++) {
    const c = closestOnSegment(hint, a[i], a[(i + 1) % a.length]);
    const d = Math.hypot(c.x - hint.x, c.y - hint.y);
    if (d < fallbackDist) {
      fallbackDist = d;
      fallback = c;
    }
  }
  return { x: Math.round(fallback.x * 10) / 10, y: Math.round(fallback.y * 10) / 10 };
}

export function graphBounds(graph: BuildingGraph): BBox {
  const points: Point[] = [];
  for (const room of graph.rooms) points.push(...room.polygon);
  for (const wall of graph.walls) points.push(wall.start, wall.end);
  for (const c of graph.connectors) points.push(c.position);
  if (points.length === 0) return DEFAULT_BBOX;
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

// Tight bounds of the content on one floor (no padding, no default
// minimum), or null when the floor is empty.
export function contentBounds(graph: BuildingGraph, floor: number): BBox | null {
  const points: Point[] = [];
  for (const room of graph.rooms) if (room.floor === floor) points.push(...room.polygon);
  for (const wall of graph.walls) if (wall.floor === floor) points.push(wall.start, wall.end);
  for (const c of graph.connectors) if (c.floors.includes(floor)) points.push(c.position);
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

export function boundsOfPoints(points: Point[], pad = 0): BBox | null {
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map((p) => p.x)) - pad,
    minY: Math.min(...points.map((p) => p.y)) - pad,
    maxX: Math.max(...points.map((p) => p.x)) + pad,
    maxY: Math.max(...points.map((p) => p.y)) + pad,
  };
}

// Drawing snap: an existing corner or wall end on this floor if one is
// within `radius`, otherwise the nearest half-metre grid point. Keeps
// neighbouring rooms sharing exact edges, which door snapping relies on.
export function snapPoint(graph: BuildingGraph, floor: number, p: Point, radius = 0.6): Point {
  const candidates: Point[] = [];
  for (const room of graph.rooms) if (room.floor === floor) candidates.push(...room.polygon);
  for (const wall of graph.walls) if (wall.floor === floor) candidates.push(wall.start, wall.end);

  let best: Point | null = null;
  let bestDist = radius;
  for (const q of candidates) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = q;
    }
  }
  if (best) return { x: best.x, y: best.y };
  return { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 };
}

// Camera framing for a few points: padded, and never tighter than
// minW x minH metres so a 3 m leg doesn't fill the whole screen.
export function focusBox(points: Point[], pad = 4, minW = 30, minH = 18): BBox | null {
  const box = boundsOfPoints(points, pad);
  if (!box) return null;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const w = Math.max(box.maxX - box.minX, minW) / 2;
  const h = Math.max(box.maxY - box.minY, minH) / 2;
  return { minX: cx - w, minY: cy - h, maxX: cx + w, maxY: cy + h };
}
