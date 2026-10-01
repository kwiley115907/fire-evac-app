'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import type { BuildingGraph, DoorOpening, EvacuationRoute, Point, Room } from '@/lib/evacuation-types';
import { polygonCentroid } from '@/lib/evacuation-geometry';
import { contentBounds, type BBox } from '@/lib/editor-utils';
import type { FlowSegment, Hazards } from '@/lib/evacuation-field';
import { formatDuration, routeTimeline, timeMarkers, type TimedPath } from '@/lib/route-directions';
import { Icon } from '@/components/icons';
import type { CameraRequest, PickTarget, Selected, Tool } from '@/components/editor/types';
import { usePanZoom } from './usePanZoom';
import { C, heatColor } from './palette';

const FALLBACK_BOX: BBox = { minX: 0, minY: 0, maxX: 24, maxY: 16 };
const FLAME =
  'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.1 2.2-5.1 3.4-6.9.4 1.6 1.3 2.6 2.2 3.1C11 7.6 12.4 4.8 15 3c-.4 3 .9 4.8 2.1 6.6 1 1.4 1.4 3 1.4 4.6 0 4-2.6 6.8-6.5 6.8z';

export interface PlanViewProps {
  graph: BuildingGraph;
  floor: number;
  mode: 'plan' | 'flow';
  tool: Tool;
  hazards: Hazards;
  flow: FlowSegment[];
  etas: Map<string, number>;
  smokyRooms: Set<string>;
  limitSeconds: number;
  route: EvacuationRoute | null;
  alternate: EvacuationRoute | null;
  focusLeg: Point[] | null;
  selected: Selected;
  draftPolygon?: Point[];
  draftWallStart?: Point | null;
  draftDoorRoomA?: string | null;
  cameraRequest?: CameraRequest | null;
  onPick: (target: PickTarget, point: Point) => void;
  onFloorJump?: (floor: number) => void;
  compact?: boolean;
  // Walked routes recorded with AR Scan, already cut to this floor.
  scanPaths?: { id: string; points: Point[]; active: boolean; start: boolean }[];
}

function pathD(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

function polyLength(points: Point[]): number {
  let t = 0;
  for (let i = 1; i < points.length; i++) t += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return t;
}

function roomBox(room: Room) {
  const xs = room.polygon.map((p) => p.x);
  const ys = room.polygon.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// Doors are stored as a point; draw them along the wall they sit in by
// finding the nearest edge of either adjoining room.
function doorDirection(door: DoorOpening, rooms: Room[]): Point {
  let best = { x: 1, y: 0 };
  let bestDist = Infinity;
  for (const room of rooms) {
    if (room.id !== door.roomA && room.id !== door.roomB) continue;
    const poly = room.polygon;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((door.position.x - a.x) * dx + (door.position.y - a.y) * dy) / len2));
      const d = Math.hypot(a.x + t * dx - door.position.x, a.y + t * dy - door.position.y);
      if (d < bestDist) {
        bestDist = d;
        const len = Math.sqrt(len2);
        best = { x: dx / len, y: dy / len };
      }
    }
  }
  return best;
}

function labelSize(room: Room, text: string, compact: boolean) {
  const { w, h } = roomBox(room);
  const byWidth = (w * 0.86) / Math.max(4, text.length * 0.6);
  return Math.max(0.36, Math.min(compact ? 0.95 : 0.85, byWidth, h * 0.24));
}

export function PlanView(props: PlanViewProps) {
  const {
    graph,
    floor,
    mode,
    tool,
    hazards,
    flow,
    etas,
    smokyRooms,
    limitSeconds,
    route,
    alternate,
    focusLeg,
    selected,
    draftPolygon = [],
    draftWallStart = null,
    draftDoorRoomA = null,
    cameraRequest,
    onPick,
    onFloorJump,
    compact = false,
    scanPaths = [],
  } = props;

  const uid = useId().replace(/:/g, '');
  const { svgRef, viewBox, camera, flyTo, zoomBy, toWorld, handlers } = usePanZoom();

  const floorBox = useMemo(() => contentBounds(graph, floor) ?? FALLBACK_BOX, [graph, floor]);
  const fitBox = useRef(floorBox);
  useEffect(() => {
    fitBox.current = floorBox;
  });
  useEffect(() => {
    flyTo(fitBox.current, { padPx: compact ? 20 : 64 });
  }, [floor, flyTo, compact]);
  useEffect(() => {
    if (cameraRequest) flyTo(cameraRequest.box, { padPx: compact ? 24 : 90 });
  }, [cameraRequest, flyTo, compact]);

  const fire = useMemo(() => new Set(hazards.rooms), [hazards.rooms]);
  const blockedDoors = useMemo(() => new Set(hazards.doors), [hazards.doors]);
  const blockedConnectors = useMemo(() => new Set(hazards.connectors), [hazards.connectors]);

  const rooms = graph.rooms.filter((r) => r.floor === floor);
  const walls = graph.walls.filter((w) => w.floor === floor);
  const doors = graph.doors.filter((d) => d.floor === floor);
  const connectors = graph.connectors.filter((c) => c.floors.includes(floor));
  const sortedFloors = [...graph.floors].sort((a, b) => a - b);
  const below = sortedFloors[sortedFloors.indexOf(floor) - 1];
  const ghostRooms = below === undefined ? [] : graph.rooms.filter((r) => r.floor === below);

  const timeline = useMemo<TimedPath[]>(() => (route ? routeTimeline(graph, route) : []), [graph, route]);
  const total = timeline.length ? timeline[timeline.length - 1].endSeconds : 0;
  const routeHere = timeline
    .map((path, index) => ({ path, index }))
    .filter(({ path }) => path.floor === floor);
  const altHere = useMemo(
    () => (alternate ? routeTimeline(graph, alternate).filter((p) => p.floor === floor) : []),
    [graph, alternate, floor]
  );
  const routeDoorIds = useMemo(() => new Set(route?.steps.filter((s) => s.type === 'door').map((s) => s.id) ?? []), [route]);
  const maxVolume = Math.max(1, ...flow.map((f) => f.volume));

  const isFlow = mode === 'flow';
  const unit = camera ? 1 / camera.scale : 0.05; // one screen pixel, in metres

  function pick(e: React.MouseEvent, target: PickTarget) {
    e.stopPropagation();
    const p = toWorld(e.clientX, e.clientY);
    if (p) onPick(target, p);
  }

  const cursor =
    tool === 'select' ? 'default' : tool === 'route' ? 'pointer' : tool === 'hazard' ? 'cell' : 'crosshair';

  const scaleBar = camera ? niceScale(120 / camera.scale) : null;

  return (
    <div className={`plan-view${compact ? ' compact' : ''}`}>
      <svg
        ref={svgRef}
        className="plan-svg"
        viewBox={viewBox ? `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}` : `${floorBox.minX} ${floorBox.minY} ${floorBox.maxX - floorBox.minX} ${floorBox.maxY - floorBox.minY}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor }}
        {...handlers}
        onClick={(e) => pick(e, { kind: 'empty' })}
        role="img"
        aria-label={`Floor ${floor} plan`}
      >
        <defs>
          <pattern id={`${uid}-grid`} width={1} height={1} patternUnits="userSpaceOnUse">
            <path d="M1 0H0V1" fill="none" stroke="rgba(140,190,240,0.045)" strokeWidth={0.04} />
          </pattern>
          <pattern id={`${uid}-grid5`} width={5} height={5} patternUnits="userSpaceOnUse">
            <path d="M5 0H0V5" fill="none" stroke="rgba(140,190,240,0.09)" strokeWidth={0.06} />
          </pattern>
          <pattern id={`${uid}-hatch`} width={0.9} height={0.9} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={0.9} height={0.9} fill="rgba(255,90,54,0.08)" />
            <line x1={0} y1={0} x2={0} y2={0.9} stroke="rgba(255,90,54,0.5)" strokeWidth={0.14} />
          </pattern>
          <radialGradient id={`${uid}-fire`}>
            <stop offset="0%" stopColor="#ffd27a" stopOpacity={0.75} />
            <stop offset="45%" stopColor={C.fire} stopOpacity={0.45} />
            <stop offset="100%" stopColor={C.fire} stopOpacity={0.08} />
          </radialGradient>
          <linearGradient id={`${uid}-flame`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={C.fire} />
            <stop offset="100%" stopColor="#ffd27a" />
          </linearGradient>
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={0.45} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {viewBox && (
          <>
            <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill={`url(#${uid}-grid)`} />
            <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill={`url(#${uid}-grid5)`} />
          </>
        )}

        {/* Onion skin: the floor below, so stairs and shafts line up. */}
        {!isFlow &&
          ghostRooms.map((r) => (
            <polygon
              key={`ghost-${r.id}`}
              points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="rgba(160,200,240,0.09)"
              strokeWidth={unit * 1}
              strokeDasharray={`${unit * 4} ${unit * 4}`}
              pointerEvents="none"
            />
          ))}

        {rooms.map((room) => {
          const points = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
          const isSelected = selected?.kind === 'room' && selected.id === room.id;
          const onFire = fire.has(room.id);
          const smoky = smokyRooms.has(room.id);
          const eta = etas.get(room.id);
          const reachable = eta !== undefined;
          let fill = room.isExit ? 'rgba(47,227,154,0.13)' : C.roomFill;
          if (isFlow && !room.isExit) fill = reachable ? heatColor(eta / limitSeconds, 0.15) : `url(#${uid}-hatch)`;
          if (smoky && !onFire) fill = isFlow && reachable ? heatColor(eta / limitSeconds, 0.15) : 'rgba(255,181,71,0.12)';
          let stroke = room.isExit ? 'rgba(47,227,154,0.75)' : C.line;
          if (isFlow && !room.isExit && reachable) stroke = heatColor(eta / limitSeconds, 0.55);
          if (isFlow && !reachable && !room.isExit) stroke = 'rgba(255,90,54,0.7)';
          if (isSelected) stroke = C.signal;
          return (
            <g key={room.id} className="plan-room">
              <polygon
                points={points}
                fill={fill}
                stroke={stroke}
                strokeWidth={unit * (isSelected ? 2.5 : 1.4)}
                strokeLinejoin="round"
                onClick={(e) => pick(e, { kind: 'room', id: room.id })}
              />
              {onFire && (
                <polygon points={points} fill={`url(#${uid}-fire)`} className="fire-pulse" pointerEvents="none" />
              )}
              {smoky && !onFire && (
                <polygon
                  points={points}
                  fill="none"
                  stroke={C.smoke}
                  strokeOpacity={0.6}
                  strokeWidth={unit * 1.4}
                  strokeDasharray={`${unit * 6} ${unit * 5}`}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}

        {walls.map((w) => {
          const isSelected = selected?.kind === 'wall' && selected.id === w.id;
          return (
            <line
              key={w.id}
              x1={w.start.x}
              y1={w.start.y}
              x2={w.end.x}
              y2={w.end.y}
              stroke={isSelected ? C.signal : 'rgba(234,242,248,0.7)'}
              strokeWidth={Math.max(0.18, unit * (isSelected ? 4 : 3))}
              strokeLinecap="round"
              onClick={(e) => pick(e, { kind: 'wall', id: w.id })}
            />
          );
        })}

        {/* Escape field streams: thicker = more of the building drains here. */}
        {isFlow &&
          flow
            .filter((s) => s.floor === floor)
            .map((s) => {
              const w = 0.16 + 0.75 * Math.sqrt(s.volume / maxVolume);
              const d = pathD(s.points);
              const speed = 2.4; // m/s of on-screen drift
              return (
                <g key={s.id} pointerEvents="none">
                  <path d={d} fill="none" stroke={C.go} strokeOpacity={0.13} strokeWidth={w * 2.2} strokeLinecap="round" strokeLinejoin="round" />
                  <path
                    d={d}
                    fill="none"
                    stroke={C.go}
                    strokeOpacity={0.9}
                    strokeWidth={w}
                    strokeLinecap="round"
                    strokeDasharray={`0.01 1.4`}
                    className="flow-dash"
                    style={{ animationDuration: `${1.41 / speed}s` }}
                  />
                </g>
              );
            })}

        {doors.map((d) => {
          const dir = doorDirection(d, graph.rooms);
          const half = Math.max(0.35, d.widthMeters / 2);
          const blocked = blockedDoors.has(d.id);
          const onRoute = routeDoorIds.has(d.id);
          const isSelected = selected?.kind === 'door' && selected.id === d.id;
          const color = blocked ? C.fire : isSelected ? C.signal : onRoute ? C.go : '#d9e7f2';
          return (
            <g key={d.id} onClick={(e) => pick(e, { kind: 'door', id: d.id })} className="plan-door">
              <circle cx={d.position.x} cy={d.position.y} r={Math.max(0.55, unit * 10)} fill="transparent" />
              <line
                x1={d.position.x - dir.x * half}
                y1={d.position.y - dir.y * half}
                x2={d.position.x + dir.x * half}
                y2={d.position.y + dir.y * half}
                stroke={C.ink}
                strokeWidth={Math.max(0.3, unit * 6)}
                strokeLinecap="butt"
              />
              <line
                x1={d.position.x - dir.x * half}
                y1={d.position.y - dir.y * half}
                x2={d.position.x + dir.x * half}
                y2={d.position.y + dir.y * half}
                stroke={color}
                strokeWidth={Math.max(0.12, unit * 2.4)}
                strokeLinecap="round"
              />
              {blocked && (
                <g stroke={C.fire} strokeWidth={Math.max(0.12, unit * 2.4)} strokeLinecap="round">
                  <line x1={d.position.x - 0.45} y1={d.position.y - 0.45} x2={d.position.x + 0.45} y2={d.position.y + 0.45} />
                  <line x1={d.position.x - 0.45} y1={d.position.y + 0.45} x2={d.position.x + 0.45} y2={d.position.y - 0.45} />
                </g>
              )}
            </g>
          );
        })}

        {connectors.map((c) => {
          const blocked = blockedConnectors.has(c.id);
          const safe = c.evacuationSafe && !blocked;
          const isSelected = selected?.kind === 'connector' && selected.id === c.id;
          const s = 0.75;
          const color = safe ? C.go : C.fire;
          return (
            <g
              key={c.id}
              className="plan-connector"
              onClick={(e) => pick(e, { kind: 'connector', id: c.id })}
              transform={`translate(${c.position.x} ${c.position.y})`}
            >
              <rect x={-s} y={-s} width={s * 2} height={s * 2} rx={0.28} fill={C.ink} stroke={isSelected ? C.signal : color} strokeWidth={Math.max(0.1, unit * 2)} />
              {c.type === 'stair' ? (
                <path d="M-0.45 0.4h0.3v-0.3h0.3v-0.3h0.3v-0.3" fill="none" stroke={color} strokeWidth={0.11} strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M-0.3 -0.1l0.3-0.32 0.3 0.32M-0.3 0.1l0.3 0.32 0.3-0.32" fill="none" stroke={color} strokeWidth={0.1} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {!safe && <line x1={-s} y1={s} x2={s} y2={-s} stroke={C.fire} strokeWidth={0.1} />}
              {!compact && !isFlow && (
                <text y={-s - 0.3} fontSize={0.45} textAnchor="middle" fill={C.textDim} className="plan-label">
                  {c.name || (c.type === 'stair' ? 'Stair' : 'Lift')}
                </text>
              )}
            </g>
          );
        })}

        {/* AR-scanned walks: the route someone actually took. */}
        {scanPaths.map((sp) =>
          sp.points.length < 2 ? null : (
            <g key={sp.id} pointerEvents="none" opacity={sp.active ? 1 : 0.6}>
              <path d={pathD(sp.points)} fill="none" stroke={C.signal} strokeOpacity={0.18} strokeWidth={sp.active ? 1.3 : 0.8} strokeLinecap="round" strokeLinejoin="round" />
              <path d={pathD(sp.points)} fill="none" stroke={C.signal} strokeWidth={sp.active ? 0.3 : 0.18} strokeLinecap="round" strokeLinejoin="round" />
              {sp.active && (
                <path d={pathD(sp.points)} fill="none" stroke="#fff" strokeWidth={0.12} strokeDasharray="0.01 0.9" strokeLinecap="round" className="life-dash" />
              )}
              {sp.start && (
                <g transform={`translate(${sp.points[0].x} ${sp.points[0].y})`}>
                  <circle r={0.75} fill="none" stroke={C.signal} strokeWidth={0.1}>
                    {sp.active && <animate attributeName="r" values="0.6;1.8" dur="1.6s" repeatCount="indefinite" />}
                  </circle>
                  <circle r={0.42} fill={C.signal} stroke="#fff" strokeWidth={0.1} />
                </g>
              )}
            </g>
          )
        )}

        {/* Plan B: quieter, dashed, no comet. */}
        {altHere.map((p, i) => (
          <path
            key={`alt-${i}`}
            d={pathD(p.points)}
            fill="none"
            stroke={C.plum}
            strokeOpacity={0.85}
            strokeWidth={Math.max(0.14, unit * 2.5)}
            strokeDasharray={`${Math.max(0.5, unit * 9)} ${Math.max(0.35, unit * 6)}`}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}

        {/* The lifeline. */}
        {routeHere.map(({ path, index }) => {
          if (path.points.length < 2) return null;
          const d = pathD(path.points);
          const len = polyLength(path.points);
          const start = path.points[0];
          const end = path.points[path.points.length - 1];
          const gradId = `${uid}-life-${index}`;
          const tFrom = total > 0 ? path.startSeconds / total : 0;
          const tTo = total > 0 ? path.endSeconds / total : 1;
          const markers = timeMarkers(path, 10);
          return (
            <g key={`route-${index}`} pointerEvents="none">
              <defs>
                <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
                  <stop offset="0%" stopColor={heatColor(1 - tFrom)} />
                  <stop offset="100%" stopColor={heatColor(1 - tTo)} />
                </linearGradient>
              </defs>
              <path d={d} fill="none" stroke={C.go} strokeOpacity={0.16} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke={`url(#${gradId})`} strokeWidth={0.5} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${uid}-glow)`} />
              <path d={d} fill="none" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={0.16} strokeDasharray="0.01 0.9" strokeLinecap="round" className="life-dash" />
              {markers.map((m) => (
                <g key={m.seconds} transform={`translate(${m.point.x} ${m.point.y})`}>
                  <circle r={0.22} fill={C.ink} stroke="#fff" strokeWidth={0.07} />
                  {!compact && (
                    <text y={-0.5} fontSize={0.48} textAnchor="middle" className="plan-label mono" fill="#fff" stroke={C.ink} strokeWidth={0.12} paintOrder="stroke">
                      {formatDuration(total - m.seconds)}
                    </text>
                  )}
                </g>
              ))}
              <circle r={0.42} fill="#fff" filter={`url(#${uid}-glow)`}>
                <animateMotion dur={`${Math.min(10, Math.max(1.6, len / 7))}s`} repeatCount="indefinite" path={d} />
              </circle>
            </g>
          );
        })}

        {/* Start / handoff / exit markers. */}
        {routeHere.map(({ path, index }) => {
          const start = path.points[0];
          const end = path.points[path.points.length - 1];
          const isFirst = index === 0;
          const isLast = index === timeline.length - 1;
          const passThrough = path.points.length === 1 && !isFirst && !isLast;
          const nextFloor = nextWalkingFloor(timeline, index);
          const prevFloor = timeline[index - 1]?.floor;
          return (
            <g key={`marks-${index}`}>
              {passThrough && nextFloor !== undefined && (
                <FloorBadge at={start} label={`${nextFloor < floor ? '↓' : '↑'} F${nextFloor}`} tone="go" onClick={onFloorJump ? () => onFloorJump(nextFloor) : undefined} />
              )}
              {isFirst && (
                <g transform={`translate(${start.x} ${start.y})`} pointerEvents="none">
                  <circle r={0.6} fill="none" stroke={C.fire} strokeWidth={0.12}>
                    <animate attributeName="r" values="0.6;2.2" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.9;0" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle r={0.55} fill={C.fire} stroke="#fff" strokeWidth={0.14} />
                </g>
              )}
              {!isFirst && !passThrough && prevFloor !== undefined && !compact && (
                <FloorBadge at={start} label={`From F${prevFloor}`} tone="dim" onClick={onFloorJump ? () => onFloorJump(prevFloor) : undefined} />
              )}
              {isLast && path.points.length > 1 && (
                <g transform={`translate(${end.x} ${end.y})`} pointerEvents="none">
                  <rect x={-1.25} y={-2.35} width={2.5} height={1.2} rx={0.3} fill={C.go} />
                  <text y={-1.48} fontSize={0.62} fontWeight={800} textAnchor="middle" fill={C.ink} className="plan-label">
                    EXIT
                  </text>
                  <circle r={0.38} fill={C.go} stroke="#fff" strokeWidth={0.12} />
                </g>
              )}
              {!isLast && !passThrough && nextFloor !== undefined && (
                <FloorBadge
                  at={end}
                  label={`${nextFloor < floor ? '↓' : '↑'} F${nextFloor}`}
                  tone="go"
                  onClick={onFloorJump ? () => onFloorJump(nextFloor) : undefined}
                />
              )}
            </g>
          );
        })}

        {focusLeg && focusLeg.length > 1 && (
          <path
            d={pathD(focusLeg)}
            fill="none"
            stroke="#fff"
            strokeWidth={0.95}
            strokeOpacity={0.35}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="focus-leg"
            pointerEvents="none"
          />
        )}

        {/* Labels last so nothing covers them. */}
        {rooms.map((room) => {
          const centroid = polygonCentroid(room.polygon);
          // Lift the label clear of a stair or lift sitting mid-room.
          const blocked = connectors.some((k) => Math.hypot(k.position.x - centroid.x, k.position.y - centroid.y) < 1.8);
          const c = blocked ? { x: centroid.x, y: centroid.y - 2.2 } : centroid;
          const name = room.name?.trim() || (room.isExit ? 'Exit' : 'Unnamed');
          const fs = labelSize(room, name, compact);
          const eta = etas.get(room.id);
          const onFire = fire.has(room.id);
          return (
            <g key={`label-${room.id}`} pointerEvents="none" transform={`translate(${c.x} ${c.y})`}>
              {onFire && (
                <g transform={`translate(-1.2 ${-fs * 0.6 - 2.6}) scale(0.1)`}>
                  <path d={FLAME} fill={`url(#${uid}-flame)`} className="flame-flicker" />
                </g>
              )}
              <text
                fontSize={fs}
                textAnchor="middle"
                fill={room.isExit ? C.go : C.text}
                fontWeight={room.isExit ? 700 : 500}
                className="plan-label"
                stroke={C.ink}
                strokeWidth={fs * 0.22}
                paintOrder="stroke"
                y={isFlow && eta !== undefined && !room.isExit ? -fs * 0.15 : fs * 0.35}
              >
                {name}
              </text>
              {isFlow && !room.isExit && (
                <text
                  fontSize={fs * 0.92}
                  textAnchor="middle"
                  y={fs * 1.05}
                  className="plan-label mono"
                  fill={eta === undefined ? C.fire : heatColor(eta / limitSeconds)}
                  fontWeight={700}
                  stroke={C.ink}
                  strokeWidth={fs * 0.2}
                  paintOrder="stroke"
                >
                  {eta === undefined ? 'NO WAY OUT' : formatDuration(eta)}
                </text>
              )}
            </g>
          );
        })}

        {draftPolygon.length > 0 && (
          <g pointerEvents="none">
            <polyline points={draftPolygon.map((p) => `${p.x},${p.y}`).join(' ')} fill="rgba(76,201,255,0.08)" stroke={C.signal} strokeDasharray={`${unit * 6} ${unit * 4}`} strokeWidth={unit * 2} />
            {draftPolygon.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={unit * (i === 0 ? 6 : 4)} fill={i === 0 ? C.ink : C.signal} stroke={C.signal} strokeWidth={unit * 2} />
            ))}
          </g>
        )}
        {draftWallStart && <circle cx={draftWallStart.x} cy={draftWallStart.y} r={unit * 5} fill={C.signal} pointerEvents="none" />}
        {draftDoorRoomA &&
          (() => {
            const r = graph.rooms.find((x) => x.id === draftDoorRoomA);
            if (!r) return null;
            return (
              <polygon
                points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="rgba(76,201,255,0.12)"
                stroke={C.signal}
                strokeWidth={unit * 2.5}
                pointerEvents="none"
              />
            );
          })()}
      </svg>

      <div className="plan-controls">
        <button type="button" className="icon-btn" onClick={() => zoomBy(1.35)} aria-label="Zoom in">
          <Icon name="plus" />
        </button>
        <button type="button" className="icon-btn" onClick={() => zoomBy(1 / 1.35)} aria-label="Zoom out">
          <Icon name="minus" />
        </button>
        <button type="button" className="icon-btn" onClick={() => flyTo(floorBox, { padPx: compact ? 20 : 64 })} aria-label="Fit floor">
          <Icon name="fit" />
        </button>
      </div>

      {scaleBar && !compact && camera && (
        <div className="scale-bar" aria-hidden="true">
          <span style={{ width: scaleBar * camera.scale }} />
          {scaleBar} m
        </div>
      )}
    </div>
  );
}

// Where the route next does any walking after `index` — skips floors the
// stairwell merely passes through.
function nextWalkingFloor(timeline: TimedPath[], index: number): number | undefined {
  for (let j = index + 1; j < timeline.length; j++) {
    if (timeline[j].points.length > 1 || j === timeline.length - 1) return timeline[j].floor;
  }
  return undefined;
}

function niceScale(meters: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200];
  return steps.find((s) => s >= meters * 0.6) ?? 200;
}

function FloorBadge({ at, label, tone, onClick }: { at: Point; label: string; tone: 'go' | 'dim'; onClick?: () => void }) {
  return (
    <g
      transform={`translate(${at.x} ${at.y})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{ cursor: onClick ? 'pointer' : undefined }}
      className="floor-badge"
    >
      <rect x={-1.5} y={0.75} width={3} height={1.15} rx={0.57} fill={tone === 'go' ? C.go : '#1b2633'} stroke={tone === 'go' ? '#fff' : C.line} strokeWidth={0.06} />
      <text y={1.56} fontSize={0.56} fontWeight={800} textAnchor="middle" fill={tone === 'go' ? C.ink : C.text} className="plan-label">
        {label}
      </text>
    </g>
  );
}
