import { describe, expect, it } from 'vitest';
import { buildGuide, classifyTurn, formatDuration, routeFloorPaths, routeTimeline, timeMarkers } from './route-directions';
import { computeEscapeField, routeFromPoint } from './evacuation-field';
import { sampleBuilding } from './sample-building';

describe('classifyTurn', () => {
  // Plan coordinates: x right, y DOWN.
  const east = { x: 1, y: 0 };
  it.each([
    [{ x: 1, y: 0.1 }, 'straight'],
    [{ x: 0, y: 1 }, 'right'],
    [{ x: 0, y: -1 }, 'left'],
    [{ x: 1, y: 1 }, 'slight-right'],
    [{ x: -1, y: -0.6 }, 'sharp-left'],
    [{ x: -1, y: 0 }, 'u-turn'],
  ] as const)('heading east then %o is %s', (next, expected) => {
    expect(classifyTurn(east, next)).toBe(expected);
  });

  it('returns null for a zero-length leg', () => {
    expect(classifyTurn(east, { x: 0, y: 0 })).toBeNull();
  });
});

describe('buildGuide', () => {
  const graph = sampleBuilding();
  const field = computeEscapeField(graph);

  it('narrates a same-floor route with turns and ends at the exit', () => {
    // Server Room -> Main Corridor -> Lobby -> Front Exit
    const route = routeFromPoint(graph, field, { x: 14, y: 19 }, 1)!;
    const guide = buildGuide(graph, route);
    const kinds = guide.maneuvers.map((m) => m.kind);
    expect(kinds[0]).toBe('start');
    expect(kinds.at(-1)).toBe('exit');
    expect(guide.maneuvers[1].turn).toBeNull(); // first leg has no prior heading
    expect(guide.maneuvers.slice(2).every((m) => m.turn !== null)).toBe(true);
    expect(guide.meters).toBeGreaterThan(0);
    expect(guide.seconds).toBeCloseTo(guide.maneuvers.at(-1)!.cumulativeSeconds, 6);
  });

  it('folds a multi-floor descent into one stair maneuver', () => {
    const route = routeFromPoint(graph, field, { x: 5, y: 5 }, 3)!; // Design Studio, F3
    const guide = buildGuide(graph, route);
    const stairs = guide.maneuvers.filter((m) => m.kind === 'stairs-down');
    expect(stairs).toHaveLength(1);
    expect(stairs[0].target).toContain('2 floors to Floor 1');
    expect(guide.startFloor).toBe(3);
    expect(guide.exitFloor).toBe(1);
  });

  it('handles starting inside an exit', () => {
    const route = routeFromPoint(graph, field, { x: 6, y: -1 }, 1)!;
    const guide = buildGuide(graph, route);
    expect(guide.maneuvers.at(-1)?.kind).toBe('at-exit');
    expect(guide.seconds).toBe(0);
  });
});

describe('routeFloorPaths', () => {
  it('splits a route into one polyline per floor visited', () => {
    const graph = sampleBuilding();
    const field = computeEscapeField(graph);
    const route = routeFromPoint(graph, field, { x: 5, y: 5 }, 3)!;
    expect(routeFloorPaths(graph, route).map((p) => p.floor)).toEqual([3, 2, 1]);
  });
});

describe('formatDuration', () => {
  it('formats m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(42.4)).toBe('0:42');
    expect(formatDuration(125)).toBe('2:05');
  });
});

describe('routeTimeline', () => {
  it('ends exactly when the guide says you are out', () => {
    const graph = sampleBuilding();
    const field = computeEscapeField(graph);
    for (const point of [{ x: 5, y: 5, floor: 3 }, { x: 14, y: 19, floor: 1 }, { x: 32, y: 20, floor: 2 }]) {
      const route = routeFromPoint(graph, field, point, point.floor)!;
      const timeline = routeTimeline(graph, route);
      expect(timeline.at(-1)!.endSeconds).toBeCloseTo(buildGuide(graph, route).seconds, 6);
    }
  });

  it('drops a marker at each interval along the path', () => {
    const marks = timeMarkers({ floor: 1, points: [{ x: 0, y: 0 }, { x: 24, y: 0 }], startSeconds: 0, endSeconds: 20 }, 5);
    expect(marks.map((m) => m.seconds)).toEqual([5, 10, 15, 20]);
    expect(marks[0].point.x).toBeCloseTo(6, 6);
  });
});

describe('walking line', () => {
  const graph = sampleBuilding();
  const field = computeEscapeField(graph);

  it('turns relative to the way you come through each door', () => {
    // Server Room's door opens north into Main Corridor; the Lobby is to
    // the west — on your left as you come out — then straight on north.
    const server = buildGuide(graph, routeFromPoint(graph, field, { x: 14, y: 19 }, 1)!);
    expect(server.exitName).toBe('Front Exit');
    expect(server.maneuvers.map((m) => m.turn).slice(1)).toEqual([null, 'left', 'straight']);

    // Office 101's door opens south, so the same corridor is a right turn.
    const office = buildGuide(graph, routeFromPoint(graph, field, { x: 13, y: 5 }, 1)!);
    expect(office.exitName).toBe('Front Exit');
    expect(office.maneuvers.map((m) => m.turn).slice(1)).toEqual([null, 'right', 'straight']);
  });

  it('walks down the middle of a corridor, not along its wall', () => {
    const route = routeFromPoint(graph, field, { x: 34, y: 5 }, 3)!; // Board Room
    const f3 = routeFloorPaths(graph, route).find((p) => p.floor === 3)!;
    const inCorridor = f3.points.filter((p) => p.y > 10 && p.y < 14);
    expect(inCorridor.length).toBeGreaterThanOrEqual(2);
    for (const p of inCorridor) expect(Math.abs(p.y - 12)).toBeLessThan(0.2);
  });
});
