import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  buildMotionPath,
  cameraHeading,
  floorAt,
  HeadingFilter,
  placedFloorPaths,
  placePoint,
  sampleSteps,
  scanStats,
  simplifyScan,
  STAIR_RISER,
  StepDetector,
  straightenRotation,
  xrToScan,
} from './ar-scan';
import type { RouteScan, ScanPoint } from './evacuation-types';

const deg = (r: number) => (r * 180) / Math.PI;

describe('cameraHeading', () => {
  it('follows the back camera with the phone held upright', () => {
    // Upright (beta 90), alpha rotates counter-clockwise seen from above.
    expect(deg(cameraHeading(0, 90, 0))).toBeCloseTo(0, 6);
    expect(deg(cameraHeading(90, 90, 0))).toBeCloseTo(-90, 6); // west
    expect(Math.abs(deg(cameraHeading(180, 90, 0)))).toBeCloseTo(180, 6);
  });

  it('does not depend on how far the phone is tipped forward', () => {
    expect(deg(cameraHeading(30, 60, 0))).toBeCloseTo(deg(cameraHeading(30, 110, 0)), 6);
  });
});

describe('angleDiff', () => {
  it('wraps across +-180', () => {
    expect(deg(angleDiff((170 * Math.PI) / 180, (-170 * Math.PI) / 180))).toBeCloseTo(-20, 6);
  });
});

describe('HeadingFilter', () => {
  it('smooths without jumping at the seam', () => {
    const f = new HeadingFilter(0.5);
    f.push((179 * Math.PI) / 180);
    const v = f.push((-179 * Math.PI) / 180);
    expect(Math.abs(deg(v))).toBeGreaterThan(178);
  });
});

describe('StepDetector', () => {
  it('counts one step per stride of a walking signal', () => {
    const d = new StepDetector();
    const hz = 60;
    const cadence = 1.8; // steps per second
    let count = 0;
    for (let i = 0; i < hz * 10; i++) {
      const t = i / hz;
      const mag = 9.81 + 2.6 * Math.sin(2 * Math.PI * cadence * t) + 0.3 * Math.sin(2 * Math.PI * 9 * t);
      if (d.feed(mag, t)) count++;
    }
    expect(count).toBeGreaterThanOrEqual(16);
    expect(count).toBeLessThanOrEqual(19);
  });

  it('ignores standing still', () => {
    const d = new StepDetector();
    let count = 0;
    for (let i = 0; i < 600; i++) if (d.feed(9.81 + 0.15 * Math.sin(i), i / 60)) count++;
    expect(count).toBe(0);
  });
});

describe('buildMotionPath', () => {
  it('dead-reckons level steps and stair steps', () => {
    const path = buildMotionPath(
      [
        { t: 1, heading: 0, mode: 'level' },
        { t: 2, heading: Math.PI / 2, mode: 'level' },
        { t: 3, heading: Math.PI / 2, mode: 'down' },
      ],
      1
    );
    expect(path).toHaveLength(4);
    expect(path[1]).toMatchObject({ x: 0, y: 1, h: 0 });
    expect(path[2].x).toBeCloseTo(1, 9);
    expect(path[3].h).toBeCloseTo(-STAIR_RISER, 9);
  });
});

describe('xrToScan', () => {
  it('maps WebXR -z to forward and y to height', () => {
    expect(xrToScan({ x: 1, y: 0.5, z: -3 }, { x: 0, y: 1.5, z: 0 }, 2)).toEqual({ x: 1, y: 3, h: -1, t: 2 });
  });
});

describe('simplifyScan', () => {
  it('drops near-duplicate points and caps the count', () => {
    const pts: ScanPoint[] = Array.from({ length: 1000 }, (_, i) => ({ x: i * 0.01, y: 0, h: 0, t: i }));
    expect(simplifyScan(pts, 0.15).length).toBeLessThan(80);
    const many: ScanPoint[] = Array.from({ length: 5000 }, (_, i) => ({ x: i, y: 0, h: 0, t: i }));
    const capped = simplifyScan(many, 0.1, 100);
    expect(capped).toHaveLength(100);
    expect(capped[0].x).toBe(0);
    expect(capped[99].x).toBe(4999);
  });
});

describe('the sample walk', () => {
  const points = buildMotionPath(sampleSteps());

  it('goes down two storeys', () => {
    const s = scanStats(points);
    expect(s.floorsChanged).toBe(-2);
    expect(s.descended).toBeCloseTo(40 * STAIR_RISER, 6);
    expect(s.meters).toBeGreaterThan(s.horizontalMeters);
    expect(s.seconds).toBeGreaterThan(30);
  });

  it('straightens to the plan axes', () => {
    const rot = straightenRotation(points, 3);
    expect(Math.abs(rot - Math.round(rot / 90) * 90)).toBeLessThan(4);
    expect(Math.abs(rot - 3)).toBeLessThan(45);
  });
});

describe('placement', () => {
  const placement = { floor: 3, origin: { x: 10, y: 10 }, rotationDeg: 0, scale: 1 };

  it('puts forward up the screen and turns clockwise', () => {
    expect(placePoint({ x: 0, y: 2, h: 0, t: 0 }, placement)).toEqual({ x: 10, y: 8 });
    const turned = placePoint({ x: 0, y: 2, h: 0, t: 0 }, { ...placement, rotationDeg: 90 });
    expect(turned.x).toBeCloseTo(12, 9);
    expect(turned.y).toBeCloseTo(10, 9);
  });

  it('counts storeys from the start floor', () => {
    expect(floorAt(-3.4, placement, [1, 2, 3], 3.5)).toBe(2);
    expect(floorAt(-9, placement, [1, 2, 3], 3.5)).toBe(1);
    expect(floorAt(4, placement, [1, 2, 3], 3.5)).toBe(3);
  });

  it('splits the placed scan by floor', () => {
    const scan: RouteScan = {
      id: 's',
      name: 'x',
      createdAt: '',
      source: 'motion',
      durationSeconds: 0,
      storyHeight: 3.5,
      points: buildMotionPath(sampleSteps()),
      placement,
    };
    expect(placedFloorPaths(scan, [1, 2, 3]).map((r) => r.floor)).toEqual([3, 2, 1]);
  });
});

describe('the sample walk on the demo office', () => {
  it('leaves the Board Room, goes down the East Stair and ends at the East Exit', async () => {
    const { sampleBuilding } = await import('./sample-building');
    const { findRoomAtPoint } = await import('./evacuation-geometry');
    const graph = sampleBuilding();
    const scan: RouteScan = {
      id: 's',
      name: 'x',
      createdAt: '',
      source: 'motion',
      durationSeconds: 0,
      storyHeight: 3.5,
      points: buildMotionPath(sampleSteps()),
      placement: { floor: 3, origin: { x: 34, y: 5 }, rotationDeg: 0, scale: 1 },
    };
    const runs = placedFloorPaths(scan, graph.floors);
    const end = runs[runs.length - 1].points.at(-1)!;
    expect(findRoomAtPoint(end, 1, graph.rooms)?.id).toBe('exit-east');
    const stairs = runs.find((r) => r.floor === 2)!;
    for (const p of stairs.points) expect(findRoomAtPoint(p, 2, graph.rooms)?.id).toBe('f2-stair-east');
  });
});
