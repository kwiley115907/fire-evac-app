// AR Scan: turn a walk through the building into a 3D route.
//
// Two capture sources feed the same ScanPoint[] (metres, x right, y
// forward, h up, relative to where recording started):
//  - 'ar'     — WebXR device pose (ARCore on Android): true 6-DoF tracking,
//               so stairs show up as real height change.
//  - 'motion' — the camera plus motion sensors on any phone: steps are
//               counted from the accelerometer, direction comes from the
//               gyroscope, and stairs are marked with the Stairs buttons.
//
// Everything here is pure maths so it can be unit-tested off-device.

import type { Point, RouteScan, ScanPlacement, ScanPoint } from './evacuation-types';

export const DEFAULT_STEP_LENGTH = 0.7; // m, typical walking stride
export const STAIR_TREAD = 0.28; // m of horizontal travel per stair step
export const STAIR_RISER = 0.17; // m of height per stair step
export const DEFAULT_STORY_HEIGHT = 3.5; // m, floor to floor
export const MAX_SCAN_POINTS = 2000;

export type StairMode = 'level' | 'down' | 'up';

export interface ScanStep {
  t: number;
  // Radians, clockwise, relative to the direction the camera faced when
  // recording started.
  heading: number;
  mode: StairMode;
}

const RAD = Math.PI / 180;

// Compass-style heading (radians, clockwise from the frame's north) of the
// direction the BACK camera points, from W3C DeviceOrientation angles.
// Works with the phone upright, where alpha alone is meaningless. With a
// relative (gyroscope) alpha the result is relative too, which is what we
// want indoors: steel and wiring wreck magnetometers.
export function cameraHeading(alphaDeg: number, betaDeg: number, gammaDeg: number): number {
  const cA = Math.cos(alphaDeg * RAD);
  const sA = Math.sin(alphaDeg * RAD);
  const sB = Math.sin(betaDeg * RAD);
  const cG = Math.cos(gammaDeg * RAD);
  const sG = Math.sin(gammaDeg * RAD);
  // Back camera = device -Z. In the earth frame (x east, y north, z up)
  // that is minus the third column of R = Rz(alpha) Rx(beta) Ry(gamma).
  const east = -cA * sG - sA * sB * cG;
  const north = -sA * sG + cA * sB * cG;
  return Math.atan2(east, north);
}

// Wrap an angle difference into (-pi, pi].
export function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

// Smooths a heading on the unit circle so it never jumps at +-180°.
export class HeadingFilter {
  private sx = 0;
  private cy = 0;
  private primed = false;

  constructor(private readonly k = 0.25) {}

  push(heading: number): number {
    if (!this.primed) {
      this.sx = Math.sin(heading);
      this.cy = Math.cos(heading);
      this.primed = true;
    } else {
      this.sx += this.k * (Math.sin(heading) - this.sx);
      this.cy += this.k * (Math.cos(heading) - this.cy);
    }
    return this.value;
  }

  get value(): number {
    return Math.atan2(this.sx, this.cy);
  }
}

// Counts steps from accelerometer magnitude (m/s², gravity included). A
// fast low-pass removes jitter, a slow one tracks gravity and sensor bias,
// and a step fires on each rise above the baseline, with hysteresis and a
// refractory period so one stride counts once.
export class StepDetector {
  private fast = 9.81;
  private slow = 9.81;
  private armed = true;
  private lastStep = -Infinity;
  steps = 0;

  constructor(
    private readonly threshold = 1.1,
    private readonly rearm = 0.25,
    private readonly minInterval = 0.3
  ) {}

  feed(magnitude: number, t: number): boolean {
    this.fast += 0.35 * (magnitude - this.fast);
    this.slow += 0.02 * (magnitude - this.slow);
    const d = this.fast - this.slow;
    if (d < this.rearm) this.armed = true;
    if (this.armed && d > this.threshold && t - this.lastStep > this.minInterval) {
      this.armed = false;
      this.lastStep = t;
      this.steps++;
      return true;
    }
    return false;
  }
}

// Dead-reckon a path from counted steps.
export function buildMotionPath(steps: ScanStep[], stepLength = DEFAULT_STEP_LENGTH, startT = 0): ScanPoint[] {
  const points: ScanPoint[] = [{ x: 0, y: 0, h: 0, t: startT }];
  let x = 0;
  let y = 0;
  let h = 0;
  for (const s of steps) {
    const run = s.mode === 'level' ? stepLength : STAIR_TREAD;
    x += Math.sin(s.heading) * run;
    y += Math.cos(s.heading) * run;
    if (s.mode === 'down') h -= STAIR_RISER;
    if (s.mode === 'up') h += STAIR_RISER;
    points.push({ x, y, h, t: s.t });
  }
  return points;
}

// WebXR 'local' space: x right, y up, -z forward at session start.
export function xrToScan(pos: { x: number; y: number; z: number }, origin: { x: number; y: number; z: number }, t: number): ScanPoint {
  return { x: pos.x - origin.x, y: -(pos.z - origin.z), h: pos.y - origin.y, t };
}

// Drop points closer than `spacing` (3D) and cap the total, always keeping
// the first and last.
export function simplifyScan(points: ScanPoint[], spacing = 0.15, max = MAX_SCAN_POINTS): ScanPoint[] {
  if (points.length <= 2) return points.slice();
  const kept: ScanPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = kept[kept.length - 1];
    const b = points[i];
    if (Math.hypot(b.x - a.x, b.y - a.y, b.h - a.h) >= spacing) kept.push(b);
  }
  kept.push(points[points.length - 1]);
  if (kept.length <= max) return kept;
  const out: ScanPoint[] = [];
  const stride = (kept.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(kept[Math.round(i * stride)]);
  return out;
}

export interface ScanStats {
  meters: number; // along the path, including stairs
  horizontalMeters: number;
  descended: number;
  climbed: number;
  netHeight: number;
  floorsChanged: number; // signed: negative = down
  seconds: number;
}

export function scanStats(points: ScanPoint[], storyHeight = DEFAULT_STORY_HEIGHT): ScanStats {
  let meters = 0;
  let horizontal = 0;
  let descended = 0;
  let climbed = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dh = b.h - a.h;
    const flat = Math.hypot(b.x - a.x, b.y - a.y);
    horizontal += flat;
    meters += Math.hypot(flat, dh);
    if (dh < 0) descended -= dh;
    else climbed += dh;
  }
  const net = points.length ? points[points.length - 1].h - points[0].h : 0;
  return {
    meters,
    horizontalMeters: horizontal,
    descended,
    climbed,
    netHeight: net,
    floorsChanged: Math.round(net / storyHeight),
    seconds: points.length ? points[points.length - 1].t - points[0].t : 0,
  };
}

// Where a scan point lands on the plan (x, y in plan metres; y grows
// down the screen). At rotation 0 "forward" points up the screen.
export function placePoint(p: ScanPoint, placement: ScanPlacement): Point {
  const vx = p.x * placement.scale;
  const vy = -p.y * placement.scale;
  const th = placement.rotationDeg * RAD;
  return {
    x: placement.origin.x + vx * Math.cos(th) - vy * Math.sin(th),
    y: placement.origin.y + vx * Math.sin(th) + vy * Math.cos(th),
  };
}

// Which floor a point is on, counting storeys from the floor the scan
// started on and clamping to the building's floors.
export function floorAt(h: number, placement: ScanPlacement, floors: number[], storyHeight: number): number {
  const sorted = [...floors].sort((a, b) => a - b);
  const start = Math.max(0, sorted.indexOf(placement.floor));
  const idx = Math.min(sorted.length - 1, Math.max(0, start + Math.round(h / storyHeight)));
  return sorted[idx] ?? placement.floor;
}

// Continuous storey position (e.g. 1.5 = halfway between the start floor
// and the next one up) — for drawing stairs as ramps between plates.
export function storeyOffset(h: number, storyHeight: number): number {
  return h / storyHeight;
}

// The scan as plan polylines, split wherever it changes floor.
export function placedFloorPaths(
  scan: RouteScan,
  floors: number[]
): { floor: number; points: Point[] }[] {
  if (!scan.placement) return [];
  const runs: { floor: number; points: Point[] }[] = [];
  for (const p of scan.points) {
    const floor = floorAt(p.h, scan.placement, floors, scan.storyHeight);
    const at = placePoint(p, scan.placement);
    const last = runs[runs.length - 1];
    if (!last || last.floor !== floor) runs.push({ floor, points: [at] });
    else last.points.push(at);
  }
  return runs;
}

// Rotation (degrees) nearest to `current` that lines the scan's dominant
// walking direction up with the plan's axes — buildings are mostly
// right angles, a hand-held phone mostly isn't.
export function straightenRotation(points: ScanPoint[], current: number): number {
  let c = 0;
  let s = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = -(points[i].y - points[i - 1].y);
    const w = Math.hypot(dx, dy);
    if (w < 1e-6) continue;
    const a = Math.atan2(dy, dx);
    c += w * Math.cos(4 * a);
    s += w * Math.sin(4 * a);
  }
  if (c === 0 && s === 0) return current;
  const dominant = Math.atan2(s, c) / 4 / RAD; // degrees, in (-45, 45]
  const base = -dominant;
  const k = Math.round((current - base) / 90);
  return base + k * 90;
}

// A believable recorded walk for trying AR Scan without a phone — sized to
// the demo office: out of the Board Room, along the corridor, down the
// East Stair's switchbacks two storeys and out the East Exit, with the
// wobble a real hand-held capture has.
export function sampleSteps(): ScanStep[] {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  const steps: ScanStep[] = [];
  let t = 0;
  const walk = (n: number, headingDeg: number, mode: StairMode = 'level', pace = 0.55) => {
    for (let i = 0; i < n; i++) {
      t += pace + rand() * 0.06;
      steps.push({ t, heading: (headingDeg + rand() * 7) * RAD, mode });
    }
  };
  walk(10, 180); // out of the room into the corridor
  walk(6, 90); // along the corridor
  walk(3, 180); // into the stairwell
  for (let floor = 0; floor < 2; floor++) {
    walk(10, 180, 'down', 0.62); // flight
    walk(2, 270, 'level', 0.6); // landing
    walk(10, 0, 'down', 0.62); // return flight
    walk(2, 90, 'level', 0.6);
  }
  walk(3, 0); // out of the stairwell
  walk(4, 90); // through the exit
  return steps;
}

export function newScanId(): string {
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
