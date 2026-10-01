'use client';

import type { RouteScan } from '@/lib/evacuation-types';
import { scanStats, straightenRotation } from '@/lib/ar-scan';
import { formatDuration } from '@/lib/route-directions';
import { Icon } from '@/components/icons';

function summary(scan: RouteScan) {
  const s = scanStats(scan.points, scan.storyHeight);
  const storeys = s.floorsChanged === 0 ? 'level' : `${s.floorsChanged < 0 ? '↓' : '↑'}${Math.abs(s.floorsChanged)} storey${Math.abs(s.floorsChanged) === 1 ? '' : 's'}`;
  return `${s.meters.toFixed(0)} m · ${formatDuration(s.seconds)} · ${storeys}`;
}

export function ScanList({
  scans,
  hidden,
  onNew,
  onOpen,
  onPlace,
  onToggle,
}: {
  scans: RouteScan[];
  hidden: Set<string>;
  onNew: () => void;
  onOpen: (scan: RouteScan) => void;
  onPlace: (scan: RouteScan) => void;
  onToggle: (scan: RouteScan) => void;
}) {
  return (
    <div className="scan-list">
      <button type="button" className="btn-primary scan-new" onClick={onNew}>
        <Icon name="camera" size={17} /> New AR Scan
      </button>
      {scans.length === 0 ? (
        <div className="audit-empty">
          <Icon name="scan" size={28} />
          <p>Walk a route with your phone and it&apos;s rebuilt in 3D, then pinned onto this plan next to the computed way out.</p>
        </div>
      ) : (
        scans.map((scan) => (
          <div key={scan.id} className="scan-item">
            <button type="button" className="scan-item-main" onClick={() => onOpen(scan)}>
              <span className="scan-item-icon">
                <Icon name={scan.source === 'ar' ? 'scan' : 'footprints'} size={18} />
              </span>
              <span className="scan-item-text">
                <strong>{scan.name}</strong>
                <span className="mono">{summary(scan)}</span>
                <span className={scan.placement ? 'placed' : 'unplaced'}>
                  {scan.placement ? `Starts on Floor ${scan.placement.floor}` : 'Not on the plan yet'}
                </span>
              </span>
            </button>
            <div className="scan-item-actions">
              {scan.placement && (
                <button type="button" className="icon-btn" onClick={() => onToggle(scan)} aria-label={hidden.has(scan.id) ? 'Show on plan' : 'Hide from plan'} title={hidden.has(scan.id) ? 'Show' : 'Hide'}>
                  <Icon name={hidden.has(scan.id) ? 'eye-off' : 'eye'} size={16} />
                </button>
              )}
              <button type="button" className="icon-btn" onClick={() => onPlace(scan)} aria-label="Place on plan" title={scan.placement ? 'Move' : 'Place'}>
                <Icon name="pin" size={16} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function PlacementPanel({
  scan,
  floors,
  onChange,
  onFloor,
  onSave,
  onCancel,
}: {
  scan: RouteScan;
  floors: number[];
  onChange: (scan: RouteScan) => void;
  onFloor: (floor: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const p = scan.placement!;
  const set = (patch: Partial<typeof p>) => onChange({ ...scan, placement: { ...p, ...patch } });
  const rotate = (by: number) => set({ rotationDeg: (((p.rotationDeg + by) % 360) + 360) % 360 });
  return (
    <div className="placement">
      <div className="placement-step">
        <span className="placement-num">1</span>
        <div>
          <strong>Tap the plan where you started recording</strong>
          <span>The scan&apos;s start (cyan dot) jumps there. Tap again to fine-tune.</span>
        </div>
      </div>

      <div className="placement-step">
        <span className="placement-num">2</span>
        <div>
          <strong>Starting floor</strong>
          <div className="floor-pills">
            {[...floors]
              .sort((a, b) => a - b)
              .map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`floor-pill${p.floor === f ? ' on' : ''}`}
                  aria-pressed={p.floor === f}
                  onClick={() => {
                    set({ floor: f });
                    onFloor(f);
                  }}
                >
                  F{f}
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className="placement-step">
        <span className="placement-num">3</span>
        <div>
          <strong>
            Line it up <em className="mono">{Math.round(p.rotationDeg) % 360}°</em>
          </strong>
          <div className="rotate-row">
            <button type="button" className="btn-ghost btn-sm" onClick={() => rotate(-90)}>
              −90°
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => rotate(-5)}>
              −5°
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => rotate(5)}>
              +5°
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => rotate(90)}>
              +90°
            </button>
          </div>
          <input type="range" min={0} max={359} step={1} value={Math.round(p.rotationDeg) % 360} onChange={(e) => set({ rotationDeg: Number(e.target.value) })} aria-label="Rotation" />
          <button type="button" className="btn-ghost btn-sm" onClick={() => set({ rotationDeg: (straightenRotation(scan.points, p.rotationDeg) + 360) % 360 })}>
            <Icon name="ruler" size={14} /> Square up to the walls
          </button>
          <label className="stretch">
            <span>
              Stretch <em className="mono">×{p.scale.toFixed(2)}</em>
            </span>
            <input type="range" min={0.6} max={1.4} step={0.01} value={p.scale} onChange={(e) => set({ scale: Number(e.target.value) })} />
          </label>
        </div>
      </div>

      <div className="placement-actions">
        <button type="button" className="btn-primary" onClick={onSave}>
          <Icon name="check" size={16} /> Save placement
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Compact controls floating over the plan on phones, where the full panel
// would cover the very plan you need to tap.
export function PlacementBar({
  scan,
  onChange,
  onSave,
  onCancel,
}: {
  scan: RouteScan;
  onChange: (scan: RouteScan) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const p = scan.placement!;
  const set = (rotationDeg: number) => onChange({ ...scan, placement: { ...p, rotationDeg: ((rotationDeg % 360) + 360) % 360 } });
  return (
    <div className="placement-bar" role="toolbar" aria-label="Place scan">
      <button type="button" onClick={() => set(p.rotationDeg - 90)} aria-label="Rotate 90° left">
        −90°
      </button>
      <button type="button" onClick={() => set(p.rotationDeg - 5)} aria-label="Rotate 5° left">
        −5°
      </button>
      <button type="button" onClick={() => set(p.rotationDeg + 5)} aria-label="Rotate 5° right">
        +5°
      </button>
      <button type="button" onClick={() => set(p.rotationDeg + 90)} aria-label="Rotate 90° right">
        +90°
      </button>
      <button type="button" onClick={() => set(straightenRotation(scan.points, p.rotationDeg))} aria-label="Square up to the walls">
        <Icon name="ruler" size={16} />
      </button>
      <button type="button" className="go" onClick={onSave} aria-label="Save placement">
        <Icon name="check" size={18} />
      </button>
      <button type="button" onClick={onCancel} aria-label="Cancel placement">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
