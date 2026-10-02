'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import banner from '@/assets/brand/sentinel-grid-banner.webp';
import type { ScanPoint } from '@/lib/evacuation-types';
import {
  angleDiff,
  buildMotionPath,
  cameraHeading,
  DEFAULT_STEP_LENGTH,
  HeadingFilter,
  sampleSteps,
  scanStats,
  StepDetector,
  type ScanStep,
  type StairMode,
} from '@/lib/ar-scan';
import { formatDuration } from '@/lib/route-directions';
import { Icon } from '@/components/icons';
import { isArSupported, startXrCapture, type XrCapture } from './xrTrail';

export interface ScanCapture {
  source: 'ar' | 'motion';
  points: ScanPoint[];
  steps?: ScanStep[];
  durationSeconds: number;
  sample?: boolean;
  video?: { url: string; mime: string };
}

type Phase = 'intro' | 'motion' | 'ar' | 'finishing';

// iOS gates motion sensors behind a permission prompt that must come from
// a tap; other browsers don't have the method at all.
async function requestSensorPermission(): Promise<boolean> {
  const Motion = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
  const Orientation = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  // Ask for both in the same tick so each call still counts as user-initiated.
  const asks: Promise<string>[] = [];
  if (Motion?.requestPermission) asks.push(Motion.requestPermission());
  if (Orientation?.requestPermission) asks.push(Orientation.requestPermission());
  try {
    return (await Promise.all(asks)).every((r) => r === 'granted');
  } catch {
    return false;
  }
}

// Chrome/Samsung Internet's Generic Sensor API. Some Android builds deliver
// readings here even when the older devicemotion event stays silent.
interface GenericAccelerometer extends EventTarget {
  x: number | null;
  y: number | null;
  z: number | null;
  start(): void;
  stop(): void;
}
type AccelerometerCtor = new (opts: { frequency: number }) => GenericAccelerometer;

type SensorTrouble = 'blocked' | 'silent';

// After motion data fails to arrive, tell blocked-by-permission apart from
// a browser or device that just isn't sending any.
async function diagnoseSensors(): Promise<SensorTrouble> {
  try {
    const status = await navigator.permissions?.query({ name: 'accelerometer' as PermissionName });
    if (status?.state === 'denied') return 'blocked';
  } catch {
    // Browsers that don't know the 'accelerometer' permission name throw.
  }
  return 'silent';
}

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

// Heading-up mini map of the path so far, drawn while recording.
function LiveMap({ points, heading }: { points: ScanPoint[]; heading: number }) {
  const last = points[points.length - 1] ?? { x: 0, y: 0, h: 0, t: 0 };
  const span = Math.max(6, ...points.map((p) => Math.hypot(p.x - last.x, p.y - last.y))) * 1.15;
  const deg = (heading * 180) / Math.PI;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(p.x - last.x).toFixed(2)} ${(-(p.y - last.y)).toFixed(2)}`).join(' ');
  return (
    <svg className="live-map" viewBox={`${-span} ${-span} ${span * 2} ${span * 2}`} aria-hidden="true">
      <circle r={span * 0.98} fill="rgba(7,10,15,0.6)" stroke="rgba(160,200,240,0.25)" strokeWidth={span * 0.015} />
      <g transform={`rotate(${-deg})`}>
        <path d={d} fill="none" stroke="#2fe39a" strokeWidth={span * 0.05} strokeLinecap="round" strokeLinejoin="round" />
        {points.length > 0 && (
          <circle cx={points[0].x - last.x} cy={-(points[0].y - last.y)} r={span * 0.05} fill="#ff5a36" />
        )}
      </g>
      <path d={`M0 ${-span * 0.16} L${span * 0.11} ${span * 0.1} L0 ${span * 0.04} L${-span * 0.11} ${span * 0.1}Z`} fill="#fff" />
    </svg>
  );
}

export function ArScanner({ onClose, onComplete }: { onClose: () => void; onComplete: (capture: ScanCapture) => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [arAvailable, setArAvailable] = useState(false);
  const [recordVideo, setRecordVideo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [points, setPoints] = useState<ScanPoint[]>([{ x: 0, y: 0, h: 0, t: 0 }]);
  const [stepCount, setStepCount] = useState(0);
  const [stairs, setStairs] = useState<StairMode>('level');
  const [heading, setHeading] = useState(0);
  const [tilted, setTilted] = useState(false);
  const [noSensors, setNoSensors] = useState(false);
  const [sensorTrouble, setSensorTrouble] = useState<SensorTrouble | null>(null);
  const [noCamera, setNoCamera] = useState(false);
  const [tracking, setTracking] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const steps = useRef<ScanStep[]>([]);
  const stairsRef = useRef<StairMode>('level');
  const headingRef = useRef(0);
  const zero = useRef<number | null>(null);
  const filter = useRef(new HeadingFilter(0.3));
  const detector = useRef(new StepDetector());
  const t0 = useRef(0);
  const sawMotion = useRef(false);
  const tiltedRef = useRef(false);
  const xr = useRef<XrCapture | null>(null);
  const detach = useRef<(() => void) | null>(null);

  useEffect(() => {
    let live = true;
    isArSupported().then((ok) => live && setArAvailable(ok));
    return () => {
      live = false;
    };
  }, []);

  // Recording clock.
  useEffect(() => {
    if (phase !== 'motion' && phase !== 'ar') return;
    const id = window.setInterval(() => {
      setElapsed((performance.now() - t0.current) / 1000);
      if (phase === 'motion' && !sawMotion.current && performance.now() - t0.current > 2500) setNoSensors(true);
      if (phase === 'motion' && sawMotion.current) setNoSensors(false);
    }, 250);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!noSensors) return;
    let live = true;
    diagnoseSensors().then((t) => live && setSensorTrouble(t));
    return () => {
      live = false;
    };
  }, [noSensors]);

  // Never leave the camera or sensors running behind us.
  useEffect(
    () => () => {
      detach.current?.();
      stream.current?.getTracks().forEach((t) => t.stop());
      xr.current?.stop();
    },
    []
  );

  function setStairMode(mode: StairMode) {
    stairsRef.current = mode;
    setStairs(mode);
  }

  async function startMotion() {
    setError(null);
    const permitted = await requestSensorPermission();
    if (!permitted) {
      setError('Motion access was declined. Allow Motion & Orientation for this site in your browser settings, then try again.');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch {
      stream.current = null;
      setNoCamera(true);
    }

    steps.current = [];
    zero.current = null;
    filter.current = new HeadingFilter(0.3);
    detector.current = new StepDetector();
    sawMotion.current = false;
    setNoSensors(false);
    setSensorTrouble(null);
    chunks.current = [];
    t0.current = performance.now();
    setPoints([{ x: 0, y: 0, h: 0, t: 0 }]);
    setStepCount(0);
    setElapsed(0);
    setStairMode('level');
    setPhase('motion');

    // Orientation fires 60+ times a second. Keep the filter fed on every
    // event but re-render at most once per frame: rendering per event kept
    // the main thread busy enough to delay taps by over half a second.
    let frame = 0;
    const flush = () => {
      frame = 0;
      setHeading(headingRef.current);
      setTilted(tiltedRef.current);
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      const raw = cameraHeading(e.alpha, e.beta, e.gamma);
      if (zero.current === null) zero.current = raw;
      headingRef.current = filter.current.push(angleDiff(raw, zero.current));
      // Camera pointing mostly at the floor or ceiling?
      const camUp = -Math.cos((e.beta * Math.PI) / 180) * Math.cos((e.gamma * Math.PI) / 180);
      tiltedRef.current = Math.abs(camUp) > 0.75;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const feedAcceleration = (x: number, y: number, z: number) => {
      sawMotion.current = true;
      const t = (performance.now() - t0.current) / 1000;
      if (detector.current.feed(Math.hypot(x, y, z), t)) {
        steps.current.push({ t, heading: headingRef.current, mode: stairsRef.current });
        setStepCount(steps.current.length);
        setPoints(buildMotionPath(steps.current, DEFAULT_STEP_LENGTH));
      }
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      feedAcceleration(a.x, a.y, a.z);
    };
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);

    // No devicemotion after a second? Try the Generic Sensor API instead.
    let accel: GenericAccelerometer | null = null;
    const fallback = window.setTimeout(() => {
      const Ctor = (window as unknown as { Accelerometer?: AccelerometerCtor }).Accelerometer;
      if (sawMotion.current || !Ctor) return;
      try {
        const sensor = new Ctor({ frequency: 60 });
        sensor.addEventListener('reading', () => {
          if (sensor.x !== null && sensor.y !== null && sensor.z !== null) feedAcceleration(sensor.x, sensor.y, sensor.z);
        });
        sensor.addEventListener('error', () => sensor.stop());
        sensor.start();
        accel = sensor;
      } catch {
        accel = null;
      }
    }, 1000);

    detach.current = () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
      window.clearTimeout(fallback);
      accel?.stop();
      if (frame) cancelAnimationFrame(frame);
    };

    const mime = pickMime();
    if (stream.current && recordVideo && mime) {
      try {
        const r = new MediaRecorder(stream.current, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
        r.ondataavailable = (ev) => {
          if (ev.data.size) chunks.current.push(ev.data);
        };
        r.start(1000);
        recorder.current = r;
      } catch {
        recorder.current = null;
      }
    }
  }

  // The <video> only exists once we're recording, so attach the stream then.
  useEffect(() => {
    if (phase === 'motion' && videoRef.current && stream.current) {
      videoRef.current.srcObject = stream.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  function finishMotion() {
    detach.current?.();
    detach.current = null;
    const duration = (performance.now() - t0.current) / 1000;
    const recorded = steps.current.slice();
    const done = (video?: ScanCapture['video']) => {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      onComplete({
        source: 'motion',
        steps: recorded,
        points: buildMotionPath(recorded, DEFAULT_STEP_LENGTH),
        durationSeconds: duration,
        video,
      });
    };
    setPhase('finishing');
    const r = recorder.current;
    recorder.current = null;
    if (r && r.state !== 'inactive') {
      r.onstop = () => {
        const blob = new Blob(chunks.current, { type: r.mimeType });
        done(blob.size ? { url: URL.createObjectURL(blob), mime: r.mimeType } : undefined);
      };
      r.stop();
    } else done();
  }

  async function startAr() {
    setError(null);
    const overlay = overlayRef.current;
    if (!overlay) return;
    setPoints([{ x: 0, y: 0, h: 0, t: 0 }]);
    setElapsed(0);
    t0.current = performance.now();
    setPhase('ar');
    try {
      xr.current = await startXrCapture({
        overlay,
        onSample: (_p, all) => setPoints(all.slice()),
        onTracking: setTracking,
        onEnd: (all) => {
          xr.current = null;
          if (all.length < 2) {
            setPhase('intro');
            setError('AR ended before any movement was tracked. Move the phone slowly at first so it can find the floor.');
            return;
          }
          onComplete({ source: 'ar', points: all, durationSeconds: all[all.length - 1].t });
        },
      });
    } catch (err) {
      setPhase('intro');
      setError(err instanceof Error ? err.message : 'Could not start AR on this device.');
    }
  }

  function loadSample() {
    const s = sampleSteps();
    onComplete({ source: 'motion', steps: s, points: buildMotionPath(s), durationSeconds: s[s.length - 1].t, sample: true });
  }

  const stats = scanStats(points);
  const recording = phase === 'motion' || phase === 'ar';

  return (
    <div className={`scanner phase-${phase}`} role="dialog" aria-modal="true" aria-label="AR Scan">
      {phase === 'intro' && (
        <div className="scanner-intro">
          <button type="button" className="icon-btn scanner-close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
          <div className="scanner-hero brand-hero-card" aria-hidden="true">
            <Image src={banner} alt="" fill sizes="(max-width: 560px) 92vw, 480px" placeholder="blur" />
          </div>
          <span className="section-kicker">AR Scan</span>
          <h2>Walk the route. Get it in 3D.</h2>
          <p>
            Hold your phone upright with the camera facing where you&apos;re going and walk the escape route at a normal pace. The
            route — turns, distance and stairs — is rebuilt in 3D, ready to replay and pin onto your plan.
          </p>

          <div className="scan-modes">
            <button type="button" className="scan-mode" onClick={startMotion}>
              <span className="feature-icon">
                <Icon name="camera" size={20} />
              </span>
              <span>
                <strong>Camera + motion</strong>
                <small>Any phone. Films the walk while counting steps and turns. Tap Stairs when you start a flight.</small>
              </span>
              <Icon name="back" size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
            {arAvailable && (
              <button type="button" className="scan-mode precise" onClick={startAr}>
                <span className="feature-icon">
                  <Icon name="scan" size={20} />
                </span>
                <span>
                  <strong>Precise AR</strong>
                  <small>Tracks your exact position with ARCore — stairs and height are captured automatically, with a live trail on the floor.</small>
                </span>
                <Icon name="back" size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
            )}
          </div>

          <label className="toggle scan-video-toggle">
            <input type="checkbox" checked={recordVideo} onChange={(e) => setRecordVideo(e.target.checked)} />
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
            Keep a video of the walk (stays on this device)
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="button" className="btn-ghost btn-sm scan-sample" onClick={loadSample}>
            <Icon name="play" size={14} /> No phone handy? Load a sample walk
          </button>
        </div>
      )}

      {phase === 'motion' && (
        <video ref={videoRef} className="scanner-video" muted playsInline autoPlay aria-hidden="true" />
      )}

      {/* Doubles as the WebXR DOM overlay root, so it must always exist. */}
      <div ref={overlayRef} className={`scanner-hud${recording ? ' on' : ''}`}>
        {recording && (
          <>
            <div className="hud-top">
              <span className="rec">
                <span className="rec-dot" /> REC <span className="mono">{formatDuration(elapsed)}</span>
              </span>
              <span className="hud-stats mono">
                <span>{stats.meters.toFixed(1)} m</span>
                {phase === 'motion' ? <span>{stepCount} steps</span> : <span>{stats.netHeight >= 0 ? '+' : ''}{stats.netHeight.toFixed(1)} m height</span>}
              </span>
            </div>

            <div className="hud-center" aria-hidden="true">
              <div className="reticle" />
            </div>

            <div className="hud-notes">
              {phase === 'motion' && noCamera && <span className="hud-note">Camera unavailable — still tracking your steps</span>}
              {phase === 'motion' && noSensors && (
                <span className="hud-note warn">
                  {sensorTrouble === 'blocked'
                    ? 'Motion sensors are blocked for this site. Tap the icon next to the address, open Permissions, allow Motion sensors, then start again.'
                    : 'No motion data yet. Allow Motion sensors for this site in your browser’s site settings, then start again.'}
                </span>
              )}
              {phase === 'motion' && tilted && <span className="hud-note warn">Hold the phone upright, camera facing forward</span>}
              {phase === 'ar' && !tracking && <span className="hud-note warn">Tracking lost — slow down and point at the floor</span>}
              {phase === 'ar' && tracking && points.length < 3 && <span className="hud-note">Move slowly for a moment so AR can find the floor</span>}
            </div>

            <div className="hud-bottom">
              <LiveMap points={points} heading={phase === 'motion' ? heading : 0} />
              {phase === 'motion' && (
                <div className="stair-switch" role="radiogroup" aria-label="Stairs">
                  {(
                    [
                      ['down', 'stairs-down', 'Stairs down'],
                      ['level', 'footprints', 'Level'],
                      ['up', 'stairs-up', 'Stairs up'],
                    ] as const
                  ).map(([mode, icon, label]) => (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={stairs === mode}
                      className={stairs === mode ? 'active' : ''}
                      onClick={() => setStairMode(mode)}
                    >
                      <Icon name={icon} size={18} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="stop-btn"
                onClick={() => (phase === 'motion' ? finishMotion() : xr.current?.stop())}
                aria-label="Stop and build 3D route"
              >
                <Icon name="stop" size={22} />
              </button>
            </div>
          </>
        )}
      </div>

      {phase === 'finishing' && (
        <div className="scanner-finishing">
          <span className="spinner" /> Building your 3D route…
        </div>
      )}
    </div>
  );
}
