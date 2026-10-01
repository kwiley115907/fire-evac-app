'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RouteScan } from '@/lib/evacuation-types';
import { buildMotionPath, DEFAULT_STEP_LENGTH, scanStats, simplifyScan, type ScanStep } from '@/lib/ar-scan';
import { formatDuration } from '@/lib/route-directions';
import { Icon } from '@/components/icons';
import { ScanViewer3D, useScanPlayback } from './ScanViewer3D';

// Replay a recorded walk in 3D, tidy it up (name, stride, storey height)
// and decide what to do with it.
export function ScanReview({
  scan: initial,
  steps,
  video,
  isNew,
  sample = false,
  canPlace,
  onPlace,
  onSave,
  onDiscard,
  onClose,
}: {
  scan: RouteScan;
  steps?: ScanStep[];
  video?: { url: string; mime: string };
  isNew: boolean;
  sample?: boolean;
  canPlace: boolean;
  onPlace: (scan: RouteScan) => void;
  onSave?: (scan: RouteScan) => void;
  onDiscard: () => void;
  onClose: (scan: RouteScan) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [stride, setStride] = useState(DEFAULT_STEP_LENGTH);
  const [storyHeight, setStoryHeight] = useState(initial.storyHeight);

  const points = useMemo(
    () => (steps && steps.length ? simplifyScan(buildMotionPath(steps, stride)) : initial.points),
    [steps, stride, initial.points]
  );
  const stats = scanStats(points, storyHeight);
  const duration = Math.max(stats.seconds, 0.1);
  const playback = useScanPlayback(duration);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Keep the video frame on the scrubber when paused.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || playback.playing || playback.time === null) return;
    if (Math.abs(v.currentTime - playback.time) > 0.2) v.currentTime = playback.time;
  }, [playback.time, playback.playing]);

  const result = (): RouteScan => ({ ...initial, name: name.trim() || 'Route scan', storyHeight, points, durationSeconds: stats.seconds });
  const floors = stats.floorsChanged;
  const ext = video?.mime.includes('mp4') ? 'mp4' : 'webm';

  return (
    <div className="scan-review" role="dialog" aria-modal="true" aria-label="Scanned route">
      <div className="scan-review-inner">
        <header className="scan-review-head">
          <div>
            <span className="section-kicker">{isNew ? (sample ? 'Sample walk' : 'Scan complete') : 'Recorded route'}</span>
            <input className="scan-name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Scan name" maxLength={80} />
          </div>
          <button type="button" className="icon-btn" onClick={() => onClose(result())} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        <div className="scan-stage">
          <ScanViewer3D points={points} storyHeight={storyHeight} playhead={playback.time} />
          {video && (
            <video ref={videoRef} className="scan-pip" src={video.url} muted playsInline preload="metadata" aria-label="Recorded video" />
          )}
          <div className="scan-player">
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                const v = videoRef.current;
                if (v) {
                  if (playback.playing) v.pause();
                  else {
                    v.currentTime = playback.time === null || playback.time >= duration ? 0 : playback.time;
                    v.play().catch(() => {});
                  }
                }
                playback.toggle();
              }}
              aria-label={playback.playing ? 'Pause replay' : 'Replay the walk'}
            >
              <Icon name={playback.playing ? 'pause' : 'play'} />
            </button>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.05}
              value={playback.time ?? 0}
              onChange={(e) => {
                videoRef.current?.pause();
                playback.pause();
                playback.setTime(Number(e.target.value));
              }}
              aria-label="Scrub through the walk"
            />
            <span className="mono">
              {playback.label} / {formatDuration(duration)}
            </span>
          </div>
        </div>

        <div className="scan-stats">
          <div>
            <span>Distance</span>
            <strong className="mono">{stats.meters.toFixed(1)} m</strong>
          </div>
          <div>
            <span>Time</span>
            <strong className="mono">{formatDuration(stats.seconds)}</strong>
          </div>
          <div>
            <span>Storeys</span>
            <strong className="mono">{floors === 0 ? 'Level' : `${floors < 0 ? '↓' : '↑'} ${Math.abs(floors)}`}</strong>
          </div>
          <div>
            <span>Pace</span>
            <strong className="mono">{stats.seconds > 0 ? (stats.meters / stats.seconds).toFixed(2) : '—'} m/s</strong>
          </div>
        </div>

        <div className="scan-tune">
          {steps && steps.length > 0 && (
            <label>
              <span>
                Stride <em className="mono">{stride.toFixed(2)} m</em>
              </span>
              <input type="range" min={0.45} max={0.95} step={0.01} value={stride} onChange={(e) => setStride(Number(e.target.value))} />
            </label>
          )}
          <label>
            <span>
              Floor-to-floor height <em className="mono">{storyHeight.toFixed(1)} m</em>
            </span>
            <input type="range" min={2.4} max={6} step={0.1} value={storyHeight} onChange={(e) => setStoryHeight(Number(e.target.value))} />
          </label>
          <p className="fine">
            {initial.source === 'ar'
              ? 'Captured with precise AR tracking.'
              : 'Captured from steps and turns. If the length looks off, adjust the stride; you can also stretch it when you place it on the plan.'}
          </p>
        </div>

        <footer className="scan-actions">
          {canPlace && (
            <button type="button" className="btn-primary" onClick={() => onPlace(result())}>
              <Icon name="pin" size={16} /> {isNew || !initial.placement ? 'Place on plan' : 'Move on plan'}
            </button>
          )}
          {onSave && (
            <button type="button" className="btn-ghost" onClick={() => onSave(result())}>
              <Icon name="check" size={16} /> {isNew ? 'Keep without placing' : 'Save changes'}
            </button>
          )}
          {video && (
            <a className="btn btn-ghost" href={video.url} download={`${name.trim() || 'route-scan'}.${ext}`}>
              <Icon name="download" size={16} /> Video
            </a>
          )}
          <button type="button" className="btn-danger" onClick={onDiscard}>
            <Icon name="trash" size={16} /> {isNew ? 'Discard' : 'Delete'}
          </button>
        </footer>
      </div>
    </div>
  );
}
