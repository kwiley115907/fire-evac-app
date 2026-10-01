'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BBox } from '@/lib/editor-utils';
import type { Point } from '@/lib/evacuation-types';

// Camera = world point at the centre of the viewport + pixels per metre.
export interface Camera {
  cx: number;
  cy: number;
  scale: number;
}

const MIN_SCALE = 2;
const MAX_SCALE = 240;
const DRAG_THRESHOLD_PX = 5;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function cameraFor(box: BBox, width: number, height: number, requestedPad: number): Camera {
  // Small screens can't spare much margin around the plan.
  const padPx = Math.min(requestedPad, Math.min(width, height) * 0.06);
  const w = Math.max(box.maxX - box.minX, 1);
  const h = Math.max(box.maxY - box.minY, 1);
  const scale = clampScale(Math.min((width - padPx * 2) / w, (height - padPx * 2) / h));
  return { cx: (box.minX + box.maxX) / 2, cy: (box.minY + box.maxY) / 2, scale };
}

// Pan (drag), zoom (wheel / pinch / buttons) and animated fly-to for an
// SVG whose viewBox always matches its pixel aspect ratio — so one metre
// is the same number of pixels in x and y, and screen<->world is linear.
export function usePanZoom() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera | null>(null);

  const cameraRef = useRef<Camera | null>(null);
  const sizeRef = useRef(size);
  const pendingFit = useRef<{ box: BBox; padPx: number } | null>(null);
  const animation = useRef<number | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  const stopAnimation = useCallback(() => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      sizeRef.current = { width, height };
      setSize({ width, height });
      if (width > 0 && height > 0 && pendingFit.current) {
        const { box, padPx } = pendingFit.current;
        pendingFit.current = null;
        setCamera(cameraFor(box, width, height, padPx));
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const flyTo = useCallback(
    (box: BBox, options: { animate?: boolean; padPx?: number } = {}) => {
      const padPx = options.padPx ?? 48;
      const { width, height } = sizeRef.current;
      if (width === 0 || height === 0) {
        pendingFit.current = { box, padPx };
        return;
      }
      const target = cameraFor(box, width, height, padPx);
      const from = cameraRef.current;
      stopAnimation();
      if (!from || options.animate === false) {
        animation.current = requestAnimationFrame(() => setCamera(target));
        return;
      }
      const started = performance.now();
      const duration = 520;
      const tick = (now: number) => {
        const t = Math.min(1, (now - started) / duration);
        const k = easeInOut(t);
        // Interpolate zoom in log space so it feels linear to the eye.
        const scale = Math.exp(Math.log(from.scale) + (Math.log(target.scale) - Math.log(from.scale)) * k);
        setCamera({ cx: from.cx + (target.cx - from.cx) * k, cy: from.cy + (target.cy - from.cy) * k, scale });
        animation.current = t < 1 ? requestAnimationFrame(tick) : null;
      };
      animation.current = requestAnimationFrame(tick);
    },
    [stopAnimation]
  );

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = clientX - rect.left - rect.width / 2;
    const py = clientY - rect.top - rect.height / 2;
    setCamera((c) => {
      if (!c) return c;
      const scale = clampScale(c.scale * factor);
      const wx = c.cx + px / c.scale;
      const wy = c.cy + py / c.scale;
      return { cx: wx - px / scale, cy: wy - py / scale, scale };
    });
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      stopAnimation();
      const rect = svg.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [stopAnimation, zoomAt]
  );

  // React registers wheel listeners as passive, so preventDefault() would
  // be ignored and the page would scroll — attach natively instead.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopAnimation();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [stopAnimation, zoomAt]);

  useEffect(() => stopAnimation, [stopAnimation]);

  const handlers = {
    onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 1) drag.current = { startX: e.clientX, startY: e.clientY, moved: false };
      stopAnimation();
    },
    onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;

      if (pointers.current.size === 1 && drag.current) {
        if (!drag.current.moved) {
          if (Math.hypot(e.clientX - drag.current.startX, e.clientY - drag.current.startY) < DRAG_THRESHOLD_PX) return;
          drag.current.moved = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        setCamera((c) => (c ? { ...c, cx: c.cx - dx / c.scale, cy: c.cy - dy / c.scale } : c));
      } else if (pointers.current.size === 2) {
        const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
        if (other) {
          const before = Math.hypot(prev.x - other.x, prev.y - other.y);
          const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
          const mid = { x: (e.clientX + other.x) / 2, y: (e.clientY + other.y) / 2 };
          const prevMid = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
          setCamera((c) =>
            c ? { ...c, cx: c.cx - (mid.x - prevMid.x) / c.scale, cy: c.cy - (mid.y - prevMid.y) / c.scale } : c
          );
          if (before > 0) zoomAt(mid.x, mid.y, after / before);
        }
        if (drag.current) drag.current.moved = true;
      }
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    },
    onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
      pointers.current.delete(e.pointerId);
      if (drag.current?.moved) {
        suppressClick.current = true;
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
      }
      if (pointers.current.size === 0) drag.current = null;
    },
    onPointerCancel(e: React.PointerEvent<SVGSVGElement>) {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) drag.current = null;
    },
    // A drag that ends over a room must not also count as a click on it.
    onClickCapture(e: React.MouseEvent<SVGSVGElement>) {
      if (suppressClick.current) {
        suppressClick.current = false;
        e.stopPropagation();
        e.preventDefault();
      }
    },
  };

  const toWorld = useCallback((clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }, []);

  const viewBox =
    camera && size.width > 0 && size.height > 0
      ? {
          x: camera.cx - size.width / camera.scale / 2,
          y: camera.cy - size.height / camera.scale / 2,
          width: size.width / camera.scale,
          height: size.height / camera.scale,
        }
      : null;

  return { svgRef, viewBox, camera, flyTo, zoomBy, toWorld, handlers };
}
