'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { BuildingGraph, EvacuationRoute, Point } from '@/lib/evacuation-types';
import { polygonCentroid } from '@/lib/evacuation-geometry';
import { contentBounds, graphBounds } from '@/lib/editor-utils';
import type { Hazards } from '@/lib/evacuation-field';
import { routeTimeline } from '@/lib/route-directions';
import { Icon } from '@/components/icons';
import { C, heatColor } from './palette';

// The whole building as an exploded, orbitable stack of floor plates with
// the escape route threaded through it — vertical runs are the stairwells.
// Pure SVG with a hand-rolled projection: no WebGL, no 3D library.

export interface StackViewProps {
  graph: BuildingGraph;
  hazards: Hazards;
  etas: Map<string, number>;
  limitSeconds: number;
  route: EvacuationRoute | null;
  focusFloor: number;
  onPickRoom: (roomId: string, point: Point, floor: number) => void;
  autoRotate?: boolean;
  compact?: boolean;
}

const DEG = Math.PI / 180;

export function StackView({
  graph,
  hazards,
  etas,
  limitSeconds,
  route,
  focusFloor,
  onPickRoom,
  autoRotate = false,
  compact = false,
}: StackViewProps) {
  const uid = useId().replace(/:/g, '');
  const [yaw, setYaw] = useState(-32);
  const [pitch, setPitch] = useState(54);
  const [spread, setSpread] = useState(0.5);
  const [spinning, setSpinning] = useState(autoRotate);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (!spinning) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setYaw((y) => y + dt * 7);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spinning]);

  const floors = useMemo(() => [...graph.floors].sort((a, b) => a - b), [graph.floors]);
  const bounds = useMemo(() => graphBounds(graph), [graph]);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const footprint = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 10);
  const gap = footprint * spread;
  const radius = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 + 2;

  const sinY = Math.sin(yaw * DEG);
  const cosY = Math.cos(yaw * DEG);
  const sinP = Math.sin(pitch * DEG);
  const cosP = Math.cos(pitch * DEG);
  const zOf = (floor: number) => Math.max(0, floors.indexOf(floor)) * gap;
  const project = (p: Point, z: number): Point => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: dx * cosY - dy * sinY, y: (dx * sinY + dy * cosY) * sinP - z * cosP };
  };
  const pts = (poly: Point[], z: number) =>
    poly
      .map((p) => project(p, z))
      .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');

  const top = zOf(floors[floors.length - 1] ?? 1);
  const vb = {
    x: -radius - 3,
    y: -radius * sinP - top * cosP - 4,
    w: radius * 2 + 6,
    h: radius * sinP * 2 + top * cosP + 8,
  };

  const fire = new Set(hazards.rooms);
  const blockedConnectors = new Set(hazards.connectors);
  const timeline = route ? routeTimeline(graph, route) : [];
  const route3d = timeline.flatMap((path) => path.points.map((p) => project(p, zOf(path.floor))));
  const routeD = route3d.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  let routeLen = 0;
  for (let i = 1; i < route3d.length; i++) routeLen += Math.hypot(route3d[i].x - route3d[i - 1].x, route3d[i].y - route3d[i - 1].y);
  const fs = footprint * 0.024;

  return (
    <div className={`stack-view${compact ? ' compact' : ''}`}>
      <svg
        className="stack-svg"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < 5) return;
          if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
          d.moved = true;
          setSpinning(false);
          setYaw((y) => y + dx * 0.4);
          setPitch((p) => Math.max(16, Math.min(89, p - dy * 0.3)));
          drag.current = { x: e.clientX, y: e.clientY, moved: true };
        }}
        onPointerUp={() => {
          if (drag.current?.moved) {
            suppressClick.current = true;
            window.setTimeout(() => (suppressClick.current = false), 0);
          }
          drag.current = null;
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.stopPropagation();
          }
        }}
        role="img"
        aria-label="3D floor stack"
      >
        <defs>
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={footprint * 0.008} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`${uid}-shaft`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={C.go} stopOpacity={0.8} />
            <stop offset="100%" stopColor={C.go} stopOpacity={0.15} />
          </linearGradient>
        </defs>

        {floors.map((floor, fi) => {
          const z = zOf(floor);
          const box = contentBounds(graph, floor);
          const focus = floor === focusFloor;
          const rooms = graph.rooms.filter((r) => r.floor === floor);
          const slab = box
            ? [
                { x: box.minX - 1.2, y: box.minY - 1.2 },
                { x: box.maxX + 1.2, y: box.minY - 1.2 },
                { x: box.maxX + 1.2, y: box.maxY + 1.2 },
                { x: box.minX - 1.2, y: box.maxY + 1.2 },
              ]
            : null;
          const labelAt = slab
            ? slab.map((p) => project(p, z)).reduce((a, b) => (b.x < a.x ? b : a))
            : project({ x: cx, y: cy }, z);
          const nextFloor = floors[fi + 1];
          return (
            <g key={floor} opacity={focus ? 1 : 0.82}>
              {slab && (
                <>
                  <polygon points={pts(slab, z - footprint * 0.018)} fill="#05080c" stroke="rgba(160,200,240,0.12)" strokeWidth={footprint * 0.0015} />
                  <polygon
                    points={pts(slab, z)}
                    fill={focus ? 'rgba(22,34,48,0.78)' : 'rgba(16,24,34,0.6)'}
                    stroke={focus ? 'rgba(76,201,255,0.55)' : 'rgba(160,200,240,0.22)'}
                    strokeWidth={footprint * 0.002}
                  />
                </>
              )}
              {rooms.map((room) => {
                const eta = etas.get(room.id);
                const onFire = fire.has(room.id);
                let fill = room.isExit ? 'rgba(47,227,154,0.5)' : eta === undefined ? 'rgba(255,90,54,0.22)' : heatColor(eta / limitSeconds, focus ? 0.34 : 0.22);
                if (onFire) fill = 'rgba(255,90,54,0.75)';
                return (
                  <polygon
                    key={room.id}
                    className="stack-room"
                    points={pts(room.polygon, z)}
                    fill={fill}
                    stroke={room.isExit ? C.go : onFire ? '#ffd27a' : 'rgba(234,242,248,0.28)'}
                    strokeWidth={footprint * 0.0018}
                    strokeLinejoin="round"
                    onClick={() => onPickRoom(room.id, polygonCentroid(room.polygon), floor)}
                  />
                );
              })}
              {focus &&
                !compact &&
                rooms.map((room) => {
                  const c = project(polygonCentroid(room.polygon), z);
                  return (
                    <text
                      key={`l-${room.id}`}
                      x={c.x}
                      y={c.y + fs * 0.35}
                      fontSize={fs}
                      textAnchor="middle"
                      className="plan-label"
                      fill={room.isExit ? C.go : C.text}
                      stroke={C.ink}
                      strokeWidth={fs * 0.22}
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {room.name}
                    </text>
                  );
                })}
              <text
                x={labelAt.x - fs * 0.8}
                y={labelAt.y + fs * 0.4}
                fontSize={fs * 1.5}
                fontWeight={800}
                textAnchor="end"
                className="plan-label mono"
                fill={focus ? C.signal : C.textDim}
                pointerEvents="none"
              >
                F{floor}
              </text>
              {/* Shafts up to the next plate, drawn before it so it occludes them. */}
              {nextFloor !== undefined &&
                graph.connectors
                  .filter((c) => c.floors.includes(floor) && c.floors.includes(nextFloor))
                  .map((c) => {
                    const a = project(c.position, z);
                    const b = project(c.position, zOf(nextFloor));
                    const ok = c.evacuationSafe && !blockedConnectors.has(c.id);
                    return (
                      <line
                        key={`shaft-${c.id}-${floor}`}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={ok ? `url(#${uid}-shaft)` : 'rgba(255,90,54,0.6)'}
                        strokeWidth={footprint * (ok ? 0.012 : 0.006)}
                        strokeDasharray={ok ? undefined : `${footprint * 0.015} ${footprint * 0.012}`}
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                    );
                  })}
            </g>
          );
        })}

        {route3d.length > 1 && (
          <g pointerEvents="none">
            <path d={routeD} fill="none" stroke={C.go} strokeOpacity={0.22} strokeWidth={footprint * 0.03} strokeLinecap="round" strokeLinejoin="round" />
            <path d={routeD} fill="none" stroke={C.go} strokeWidth={footprint * 0.01} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${uid}-glow)`} />
            <path
              d={routeD}
              fill="none"
              stroke="#fff"
              strokeWidth={footprint * 0.0045}
              strokeDasharray={`0.01 ${footprint * 0.025}`}
              strokeLinecap="round"
            >
              <animate attributeName="stroke-dashoffset" from="0" to={-(0.01 + footprint * 0.025)} dur="0.5s" repeatCount="indefinite" />
            </path>
            <circle r={footprint * 0.011} fill="#fff" filter={`url(#${uid}-glow)`}>
              <animateMotion dur={`${Math.min(9, Math.max(2.5, routeLen / (footprint * 0.35)))}s`} repeatCount="indefinite" path={routeD} />
            </circle>
            <circle cx={route3d[0].x} cy={route3d[0].y} r={footprint * 0.013} fill={C.fire} stroke="#fff" strokeWidth={footprint * 0.003} />
            <g transform={`translate(${route3d[route3d.length - 1].x} ${route3d[route3d.length - 1].y})`}>
              <circle r={footprint * 0.012} fill={C.go} stroke="#fff" strokeWidth={footprint * 0.003} />
            </g>
          </g>
        )}
      </svg>

      <div className="stack-controls">
        <button
          type="button"
          className={`icon-btn${spinning ? ' active' : ''}`}
          onClick={() => setSpinning((s) => !s)}
          aria-label={spinning ? 'Stop rotating' : 'Auto-rotate'}
          title={spinning ? 'Stop rotating' : 'Auto-rotate'}
        >
          <Icon name="orbit" />
        </button>
        {!compact && (
          <label className="explode">
            <span>Explode</span>
            <input type="range" min={0.2} max={0.95} step={0.01} value={spread} onChange={(e) => setSpread(Number(e.target.value))} />
          </label>
        )}
      </div>
      {!compact && <div className="stack-hint">Drag to orbit · tap a room for its way out</div>}
    </div>
  );
}
