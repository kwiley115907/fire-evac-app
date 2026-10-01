'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ScanPoint } from '@/lib/evacuation-types';
import { formatDuration } from '@/lib/route-directions';
import { C, heatColor } from '@/components/plan/palette';
import { Icon } from '@/components/icons';

// A recorded walk in 3D: the path as a glowing tube coloured from start
// (hot) to finish (safe), its shadow on the ground with drop lines for
// depth, ghost plates at each storey it passes, and a playhead you can
// scrub. Pure SVG with an orbit camera, like the Floor Stack.

const DEG = Math.PI / 180;
const MAX_DRAWN = 420;
const BANDS = 28;

function interpolate(points: ScanPoint[], t: number): ScanPoint {
  if (t <= points[0].t) return points[0];
  for (let i = 1; i < points.length; i++) {
    const b = points[i];
    if (b.t >= t) {
      const a = points[i - 1];
      const f = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, h: a.h + (b.h - a.h) * f, t };
    }
  }
  return points[points.length - 1];
}

export function ScanViewer3D({
  points: raw,
  storyHeight,
  playhead = null,
  autoRotate = true,
  className = '',
}: {
  points: ScanPoint[];
  storyHeight: number;
  playhead?: number | null;
  autoRotate?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const [yaw, setYaw] = useState(-30);
  const [pitch, setPitch] = useState(42);
  const [zoom, setZoom] = useState(1);
  const [spinning, setSpinning] = useState(autoRotate);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef<{ d: number; zoom: number } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    if (!spinning) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setYaw((y) => y + dt * 9);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spinning]);

  const points = useMemo(() => {
    if (raw.length <= MAX_DRAWN) return raw;
    const stride = (raw.length - 1) / (MAX_DRAWN - 1);
    return Array.from({ length: MAX_DRAWN }, (_, i) => raw[Math.round(i * stride)]);
  }, [raw]);

  const geo = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => -p.y);
    const hs = points.map((p) => p.h);
    const minX = Math.min(...xs, 0);
    const maxX = Math.max(...xs, 0);
    const minY = Math.min(...ys, 0);
    const maxY = Math.max(...ys, 0);
    const minH = Math.min(...hs, 0);
    const maxH = Math.max(...hs, 0);
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      minX,
      maxX,
      minY,
      maxY,
      minH,
      maxH,
      midH: (minH + maxH) / 2,
      radius: Math.max(4, Math.hypot(maxX - minX, maxY - minY) / 2 + 2),
    };
  }, [points]);

  const sinY = Math.sin(yaw * DEG);
  const cosY = Math.cos(yaw * DEG);
  const sinP = Math.sin(pitch * DEG);
  const cosP = Math.cos(pitch * DEG);
  const project = (x: number, planY: number, h: number) => {
    const dx = x - geo.cx;
    const dy = planY - geo.cy;
    return { x: dx * cosY - dy * sinY, y: (dx * sinY + dy * cosY) * sinP - (h - geo.midH) * cosP };
  };
  const P = (p: ScanPoint) => project(p.x, -p.y, p.h);

  const R = geo.radius / zoom;
  const halfH = ((geo.maxH - geo.minH) / 2) * cosP;
  const vb = { x: -R - 1, y: -R * sinP - halfH - 2, w: 2 * R + 2, h: 2 * R * sinP + 2 * halfH + 4 };
  const unit = (2 * geo.radius) / 600; // ~1px at the default zoom
  const stroke = Math.max(0.06, geo.radius * 0.012);

  // Ground grid under the lowest point.
  const step = geo.radius > 30 ? 5 : geo.radius > 12 ? 2 : 1;
  const gx0 = Math.floor((geo.cx - geo.radius) / step) * step;
  const gy0 = Math.floor((geo.cy - geo.radius) / step) * step;
  const lines: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
  for (let gx = gx0; gx <= geo.cx + geo.radius; gx += step) lines.push({ a: project(gx, gy0, geo.minH), b: project(gx, geo.cy + geo.radius, geo.minH) });
  for (let gy = gy0; gy <= geo.cy + geo.radius; gy += step) lines.push({ a: project(gx0, gy, geo.minH), b: project(geo.cx + geo.radius, gy, geo.minH) });

  // Ghost plates at every storey the walk passes through.
  const lo = Math.round(geo.minH / storyHeight);
  const hi = Math.round(geo.maxH / storyHeight);
  const storeys: number[] = [];
  for (let k = hi; k >= lo; k--) storeys.push(k);
  const plate = (h: number) =>
    [
      project(geo.minX - 1.5, geo.minY - 1.5, h),
      project(geo.maxX + 1.5, geo.minY - 1.5, h),
      project(geo.maxX + 1.5, geo.maxY + 1.5, h),
      project(geo.minX - 1.5, geo.maxY + 1.5, h),
    ]
      .map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`)
      .join(' ');

  const projected = points.map(P);
  const d = projected.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' ');
  const shadow = points
    .map((p, i) => {
      const q = project(p.x, -p.y, geo.minH);
      return `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
    })
    .join(' ');

  const bands: { d: string; color: string }[] = [];
  const per = Math.max(2, Math.ceil(projected.length / BANDS));
  for (let s = 0; s < projected.length - 1; s += per - 1) {
    const seg = projected.slice(s, Math.min(projected.length, s + per));
    const frac = s / Math.max(1, projected.length - 1);
    bands.push({ d: seg.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(' '), color: heatColor(1 - frac) });
  }

  const head = playhead !== null && raw.length ? P(interpolate(raw, playhead)) : null;
  const start = projected[0];
  const end = projected[projected.length - 1];

  return (
    <div className={`scan3d ${className}`}>
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="scan3d-svg"
        role="img"
        aria-label="Recorded route in 3D"
        onPointerDown={(e) => {
          touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (touches.current.size === 1) drag.current = { x: e.clientX, y: e.clientY, moved: false };
          if (touches.current.size === 2) {
            const [a, b] = [...touches.current.values()];
            pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
          }
        }}
        onPointerMove={(e) => {
          if (!touches.current.has(e.pointerId)) return;
          touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (touches.current.size === 2 && pinch.current) {
            const [a, b] = [...touches.current.values()];
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            setZoom(Math.max(0.5, Math.min(4, (pinch.current.zoom * dist) / pinch.current.d)));
            return;
          }
          const g = drag.current;
          if (!g) return;
          const dx = e.clientX - g.x;
          const dy = e.clientY - g.y;
          if (!g.moved && Math.hypot(dx, dy) < 4) return;
          if (!g.moved) e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, moved: true };
          setSpinning(false);
          setYaw((y) => y + dx * 0.45);
          setPitch((p) => Math.max(8, Math.min(89, p - dy * 0.3)));
        }}
        onPointerUp={(e) => {
          touches.current.delete(e.pointerId);
          if (touches.current.size < 2) pinch.current = null;
          if (touches.current.size === 0) drag.current = null;
        }}
        onPointerCancel={(e) => {
          touches.current.delete(e.pointerId);
          drag.current = null;
          pinch.current = null;
        }}
        onWheel={(e) => setZoom((z) => Math.max(0.5, Math.min(4, z * Math.exp(-e.deltaY * 0.0015))))}
      >
        <defs>
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={stroke * 1.2} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g stroke="rgba(140,190,240,0.08)" strokeWidth={unit}>
          {lines.map((l, i) => (
            <line key={i} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} />
          ))}
        </g>

        {storeys.length > 1 &&
          storeys.map((k) => {
            const lab = project(geo.minX - 1.5, geo.maxY + 1.5, k * storyHeight);
            return (
              <g key={k}>
                <polygon points={plate(k * storyHeight)} fill="rgba(22,34,48,0.35)" stroke="rgba(76,201,255,0.25)" strokeWidth={unit * 1.2} />
                <text x={lab.x - unit * 8} y={lab.y} fontSize={geo.radius * 0.05} textAnchor="end" fill={C.textDim} className="plan-label mono">
                  {k === 0 ? 'Start level' : `${k > 0 ? '+' : ''}${k} storey${Math.abs(k) === 1 ? '' : 's'}`}
                </text>
              </g>
            );
          })}

        <path d={shadow} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={stroke * 1.4} strokeLinecap="round" strokeLinejoin="round" />
        <path d={shadow} fill="none" stroke="rgba(160,200,240,0.14)" strokeWidth={stroke * 0.5} strokeLinecap="round" strokeLinejoin="round" />
        <g stroke="rgba(160,200,240,0.16)" strokeWidth={unit}>
          {points
            .filter((_, i) => i % Math.max(1, Math.floor(points.length / 40)) === 0)
            .map((p, i) => {
              const a = P(p);
              const b = project(p.x, -p.y, geo.minH);
              return Math.abs(p.h - geo.minH) > 0.05 ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} /> : null;
            })}
        </g>

        <path d={d} fill="none" stroke={C.go} strokeOpacity={0.22} strokeWidth={stroke * 4} strokeLinecap="round" strokeLinejoin="round" />
        <g filter={`url(#${uid}-glow)`}>
          {bands.map((b, i) => (
            <path key={i} d={b.d} fill="none" stroke={b.color} strokeWidth={stroke * 1.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>
        <path d={d} fill="none" stroke="#fff" strokeWidth={stroke * 0.55} strokeDasharray={`0.01 ${stroke * 5}`} strokeLinecap="round">
          <animate attributeName="stroke-dashoffset" from="0" to={-(0.01 + stroke * 5)} dur="0.45s" repeatCount="indefinite" />
        </path>

        {start && (
          <g>
            <circle cx={start.x} cy={start.y} r={stroke * 3} fill={C.fire} stroke="#fff" strokeWidth={stroke * 0.7} />
            <text x={start.x} y={start.y - stroke * 5} fontSize={geo.radius * 0.055} textAnchor="middle" fill="#fff" className="plan-label" stroke={C.ink} strokeWidth={geo.radius * 0.012} paintOrder="stroke">
              Start
            </text>
          </g>
        )}
        {end && (
          <g>
            <circle cx={end.x} cy={end.y} r={stroke * 3} fill={C.go} stroke="#fff" strokeWidth={stroke * 0.7} />
            <text x={end.x} y={end.y - stroke * 5} fontSize={geo.radius * 0.055} textAnchor="middle" fill={C.go} fontWeight={800} className="plan-label" stroke={C.ink} strokeWidth={geo.radius * 0.012} paintOrder="stroke">
              Finish
            </text>
          </g>
        )}
        {head && (
          <g>
            <circle cx={head.x} cy={head.y} r={stroke * 4.5} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={stroke * 0.5} />
            <circle cx={head.x} cy={head.y} r={stroke * 2.4} fill="#fff" filter={`url(#${uid}-glow)`} />
          </g>
        )}
      </svg>
      <div className="scan3d-controls">
        <button
          type="button"
          className={`icon-btn${spinning ? ' active' : ''}`}
          onClick={() => setSpinning((s) => !s)}
          aria-label={spinning ? 'Stop rotating' : 'Auto-rotate'}
        >
          <Icon name="orbit" />
        </button>
      </div>
    </div>
  );
}

// Scrubber shared by the review screen: plays the walk back in real time.
export function useScanPlayback(duration: number) {
  const [time, setTimeState] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef<number | null>(null);

  const setTime = (t: number | null) => {
    timeRef.current = t;
    setTimeState(t);
  };

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let t = timeRef.current ?? 0;
    const tick = (now: number) => {
      t += (now - last) / 1000;
      last = now;
      if (t >= duration) {
        timeRef.current = duration;
        setTimeState(duration);
        setPlaying(false);
        return;
      }
      timeRef.current = t;
      setTimeState(t);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);

  return {
    time,
    playing,
    setTime,
    pause: () => setPlaying(false),
    toggle() {
      if (playing) {
        setPlaying(false);
        return;
      }
      if (timeRef.current === null || timeRef.current >= duration) setTime(0);
      setPlaying(true);
    },
    label: formatDuration(time ?? 0),
  };
}
