import { distance, pointInPolygon, polygonCentroid } from './evacuation-geometry';
import type { Point, Room } from './evacuation-types';

// How far into a room the walking line steps after passing a door, so a
// route walks down the middle of a corridor rather than along its wall.
const MAX_DOOR_INSET = 2;

// Unit normal of the wall a door sits in, pointing into `room`, plus how
// far to step in: up to MAX_DOOR_INSET, but never past the room's middle.
export function stepInto(room: Room, at: Point): { normal: Point; inset: number } {
  const poly = room.polygon;
  let edge: [Point, Point] | null = null;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / len2));
    const d = Math.hypot(a.x + t * dx - at.x, a.y + t * dy - at.y);
    if (d < best) {
      best = d;
      edge = [a, b];
    }
  }

  const centroid = polygonCentroid(poly);
  let normal = { x: centroid.x - at.x, y: centroid.y - at.y };
  if (edge && best < 0.5) {
    const len = distance(edge[0], edge[1]);
    const n = { x: -(edge[1].y - edge[0].y) / len, y: (edge[1].x - edge[0].x) / len };
    if (pointInPolygon({ x: at.x + n.x * 0.2, y: at.y + n.y * 0.2 }, poly)) normal = n;
    else if (pointInPolygon({ x: at.x - n.x * 0.2, y: at.y - n.y * 0.2 }, poly)) normal = { x: -n.x, y: -n.y };
  }
  const nlen = Math.hypot(normal.x, normal.y) || 1;
  normal = { x: normal.x / nlen, y: normal.y / nlen };
  const depth = (centroid.x - at.x) * normal.x + (centroid.y - at.y) * normal.y;
  return { normal, inset: Math.max(0, Math.min(MAX_DOOR_INSET, depth * 0.95)) };
}

export function insetPoint(room: Room, at: Point): Point | null {
  const { normal, inset } = stepInto(room, at);
  if (inset <= 0.2) return null;
  return { x: at.x + normal.x * inset, y: at.y + normal.y * inset };
}

// Walking line across one room from `a` to `b` (doors or stair landings):
// step square-on off a door, then straight across, then square-on into
// the next door. Returns only the in-between points, tagged.
export function crossRoomPoints(
  room: Room,
  a: Point,
  b: Point,
  aIsDoor: boolean,
  bIsDoor: boolean
): { p: Point; role: 'depart' | 'approach' }[] {
  const out: { p: Point; role: 'depart' | 'approach' }[] = [];
  const da = aIsDoor ? insetPoint(room, a) : null;
  const db = bIsDoor ? insetPoint(room, b) : null;
  if (da && distance(a, b) > distance(a, da) + 0.25) out.push({ p: da, role: 'depart' });
  const last = out.length ? out[out.length - 1].p : a;
  if (db && distance(last, b) > distance(db, b) + 0.25) out.push({ p: db, role: 'approach' });
  return out;
}

export function crossRoom(room: Room, a: Point, b: Point, aIsDoor: boolean, bIsDoor: boolean): Point[] {
  return [a, ...crossRoomPoints(room, a, b, aIsDoor, bIsDoor).map((x) => x.p), b];
}
