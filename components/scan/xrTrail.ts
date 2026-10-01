'use client';

// Precise AR capture with WebXR (ARCore on Android Chrome): records the
// phone's real 6-DoF position as you walk and paints the route on the
// floor behind you in the live camera view.
//
// TypeScript's DOM lib has no WebXR types, so the handful used here are
// declared locally (prefixed to avoid clashing with any future globals).

import { xrToScan } from '@/lib/ar-scan';
import type { ScanPoint } from '@/lib/evacuation-types';

interface XrRigidTransform {
  position: { x: number; y: number; z: number };
  matrix: Float32Array;
  inverse: { matrix: Float32Array };
}
interface XrView {
  projectionMatrix: Float32Array;
  transform: XrRigidTransform;
}
interface XrViewerPose {
  transform: XrRigidTransform;
  views: XrView[];
}
interface XrFrame {
  getViewerPose(space: unknown): XrViewerPose | null;
}
interface XrWebGlLayer {
  framebuffer: WebGLFramebuffer | null;
  getViewport(view: XrView): { x: number; y: number; width: number; height: number };
}
interface XrSession extends EventTarget {
  updateRenderState(state: { baseLayer: XrWebGlLayer }): void;
  requestReferenceSpace(type: string): Promise<unknown>;
  requestAnimationFrame(cb: (time: number, frame: XrFrame) => void): number;
  end(): Promise<void>;
  domOverlayState?: { type: string };
}
interface XrSystem {
  isSessionSupported(mode: string): Promise<boolean>;
  requestSession(mode: string, init: Record<string, unknown>): Promise<XrSession>;
}

function xrSystem(): XrSystem | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as unknown as { xr?: XrSystem }).xr ?? null;
}

export async function isArSupported(): Promise<boolean> {
  const xr = xrSystem();
  if (!xr) return false;
  try {
    return await xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

// Where the phone is held relative to the floor, for painting the trail
// on the ground rather than at chest height.
const HAND_HEIGHT = 1.35;
const SAMPLE_SPACING = 0.2;

const VERT = `
attribute vec3 aPos;
attribute float aT;
uniform mat4 uProj;
uniform mat4 uView;
uniform float uSize;
varying float vT;
void main() {
  vec4 p = uView * vec4(aPos, 1.0);
  gl_Position = uProj * p;
  gl_PointSize = uSize / max(0.25, -p.z);
  vT = aT;
}`;

const FRAG = `
precision mediump float;
varying float vT;
uniform float uPoint;
void main() {
  vec3 hot = vec3(1.0, 0.353, 0.212);
  vec3 safe = vec3(0.184, 0.890, 0.604);
  vec3 c = mix(hot, safe, vT);
  if (uPoint > 0.5) {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(mix(vec3(1.0), c, smoothstep(0.0, 0.32, d)), smoothstep(0.5, 0.3, d));
  } else {
    gl_FragColor = vec4(c, 0.85);
  }
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export interface XrCapture {
  stop(): void;
}

export async function startXrCapture(opts: {
  overlay: HTMLElement;
  onSample: (point: ScanPoint, all: ScanPoint[]) => void;
  onTracking: (ok: boolean) => void;
  onEnd: (points: ScanPoint[]) => void;
}): Promise<XrCapture> {
  const xr = xrSystem();
  if (!xr) throw new Error('WebXR is not available on this device');

  const session = await xr.requestSession('immersive-ar', {
    requiredFeatures: ['local'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: opts.overlay },
  });

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { xrCompatible: true, alpha: true, antialias: true } as WebGLContextAttributes) as WebGLRenderingContext;
  const Layer = (window as unknown as { XRWebGLLayer: new (s: XrSession, g: WebGLRenderingContext) => XrWebGlLayer }).XRWebGLLayer;
  const layer = new Layer(session, gl);
  session.updateRenderState({ baseLayer: layer });
  const space = await session.requestReferenceSpace('local');

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  const aPos = gl.getAttribLocation(program, 'aPos');
  const aT = gl.getAttribLocation(program, 'aT');
  const uProj = gl.getUniformLocation(program, 'uProj');
  const uView = gl.getUniformLocation(program, 'uView');
  const uSize = gl.getUniformLocation(program, 'uSize');
  const uPoint = gl.getUniformLocation(program, 'uPoint');
  const posBuf = gl.createBuffer();
  const tBuf = gl.createBuffer();

  const points: ScanPoint[] = [];
  const trail: number[] = []; // world xyz on the floor
  let origin: { x: number; y: number; z: number } | null = null;
  let t0 = 0;
  let lastWorld: { x: number; y: number; z: number } | null = null;
  let tracking = true;
  let dirty = false;
  let ended = false;

  const upload = () => {
    const n = trail.length / 3;
    const ts = new Float32Array(n);
    for (let i = 0; i < n; i++) ts[i] = n > 1 ? i / (n - 1) : 1;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(trail), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ts, gl.DYNAMIC_DRAW);
    dirty = false;
  };

  const onFrame = (time: number, frame: XrFrame) => {
    if (ended) return;
    session.requestAnimationFrame(onFrame);
    const pose = frame.getViewerPose(space);
    if (!pose) {
      if (tracking) opts.onTracking((tracking = false));
      return;
    }
    if (!tracking) opts.onTracking((tracking = true));

    const p = pose.transform.position;
    if (!origin) {
      origin = { x: p.x, y: p.y, z: p.z };
      t0 = time;
    }
    if (!lastWorld || Math.hypot(p.x - lastWorld.x, p.y - lastWorld.y, p.z - lastWorld.z) >= SAMPLE_SPACING) {
      lastWorld = { x: p.x, y: p.y, z: p.z };
      const sp = xrToScan(p, origin, (time - t0) / 1000);
      points.push(sp);
      trail.push(p.x, p.y - HAND_HEIGHT, p.z);
      dirty = true;
      opts.onSample(sp, points);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const n = trail.length / 3;
    if (n === 0) return;
    if (dirty) upload();

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuf);
    gl.enableVertexAttribArray(aT);
    gl.vertexAttribPointer(aT, 1, gl.FLOAT, false, 0, 0);

    for (const view of pose.views) {
      const vp = layer.getViewport(view);
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      gl.uniformMatrix4fv(uProj, false, view.projectionMatrix);
      gl.uniformMatrix4fv(uView, false, view.transform.inverse.matrix);
      gl.uniform1f(uPoint, 0);
      if (n > 1) gl.drawArrays(gl.LINE_STRIP, 0, n);
      gl.uniform1f(uPoint, 1);
      gl.uniform1f(uSize, vp.height * 0.045);
      gl.drawArrays(gl.POINTS, 0, n);
    }
  };

  session.addEventListener('end', () => {
    ended = true;
    opts.onEnd(points.slice());
  });
  session.requestAnimationFrame(onFrame);

  return {
    stop() {
      if (!ended) session.end().catch(() => {});
    },
  };
}
