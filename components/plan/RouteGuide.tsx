'use client';

import type { IconName } from '@/components/icons';
import { Icon } from '@/components/icons';
import { formatDuration, type Maneuver, type RouteGuide as Guide } from '@/lib/route-directions';

function maneuverIcon(m: Maneuver): IconName {
  switch (m.kind) {
    case 'start':
      return 'pin';
    case 'stairs-down':
      return 'stairs-down';
    case 'stairs-up':
      return 'stairs-up';
    case 'exit':
    case 'at-exit':
      return 'exit';
    case 'leave-stair':
      return 'door';
    default:
      if (!m.turn) return 'straight';
      if (m.turn === 'left') return 'turn-left';
      if (m.turn === 'right') return 'turn-right';
      return m.turn;
  }
}

export function RouteGuide({
  guide,
  alternate,
  showAlternate,
  onToggleAlternate,
  activeIndex,
  onFocus,
  playing,
  onTogglePlay,
  onClear,
  hazardCount,
  rerouted,
}: {
  guide: Guide | null;
  alternate: Guide | null;
  showAlternate: boolean;
  onToggleAlternate: () => void;
  activeIndex: number | null;
  onFocus: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  onClear: () => void;
  hazardCount: number;
  rerouted: boolean;
}) {
  if (!guide) {
    return (
      <div className="guide-empty">
        <div className="guide-empty-art" aria-hidden="true">
          <svg viewBox="0 0 120 70" width="160" height="94">
            <rect x="4" y="4" width="112" height="62" rx="8" fill="none" stroke="rgba(160,200,240,0.25)" />
            <path d="M4 36h70M74 4v62" stroke="rgba(160,200,240,0.18)" />
            <path d="M20 54 C 30 40, 50 40, 60 36 S 90 24, 104 14" fill="none" stroke="#2fe39a" strokeWidth="3" strokeLinecap="round" className="life-dash-demo" />
            <circle cx="20" cy="54" r="4.5" fill="#ff5a36" />
            <rect x="96" y="6" width="18" height="10" rx="2" fill="#2fe39a" />
          </svg>
        </div>
        <h3>Tap any room</h3>
        <p>You&apos;ll get the fastest way out, step by step, with a Plan B if that exit is lost.</p>
      </div>
    );
  }

  const shown = showAlternate && alternate ? alternate : guide;
  const floorsDelta = shown.startFloor - shown.exitFloor;
  const doors = shown.maneuvers.filter((m) => m.kind === 'door' || m.kind === 'exit').length;

  return (
    <div className="guide">
      <div className={`guide-hero${showAlternate && alternate ? ' alt' : ''}`}>
        <div className="guide-eta">
          <span className="guide-eta-label">{showAlternate && alternate ? 'Plan B' : 'Time to safety'}</span>
          <span className="guide-eta-value mono">{formatDuration(shown.seconds)}</span>
          <span className="guide-eta-to">
            via <strong>{shown.exitName}</strong>
          </span>
        </div>
        <div className="guide-stats">
          <span>
            <Icon name="ruler" size={14} /> {Math.round(shown.meters)} m
          </span>
          {floorsDelta !== 0 && (
            <span>
              <Icon name={floorsDelta > 0 ? 'stairs-down' : 'stairs-up'} size={14} /> {Math.abs(floorsDelta)} floor{Math.abs(floorsDelta) === 1 ? '' : 's'}
            </span>
          )}
          <span>
            <Icon name="door" size={14} /> {doors} door{doors === 1 ? '' : 's'}
          </span>
        </div>
        {hazardCount > 0 && (
          <div className={`guide-hazard${rerouted ? ' flash' : ''}`}>
            <Icon name="fire" size={14} /> Avoiding {hazardCount} hazard{hazardCount === 1 ? '' : 's'}
          </div>
        )}
        <div className="guide-actions">
          <button type="button" className="btn-primary btn-sm" onClick={onTogglePlay}>
            <Icon name={playing ? 'pause' : 'play'} size={15} />
            {playing ? 'Pause' : 'Walk it'}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onClear}>
            <Icon name="close" size={15} /> Clear
          </button>
        </div>
      </div>

      <ol className="maneuvers">
        {shown.maneuvers.map((m, i) => (
          <li key={i}>
            <button
              type="button"
              className={`maneuver kind-${m.kind}${activeIndex === i ? ' active' : ''}`}
              onClick={() => onFocus(i)}
            >
              <span className="maneuver-icon">
                <Icon name={maneuverIcon(m)} size={18} />
              </span>
              <span className="maneuver-text">
                <strong>{m.instruction}</strong>
                <span>{m.target}</span>
              </span>
              <span className="maneuver-time mono">{i === 0 ? `F${m.floor}` : `+${formatDuration(m.cumulativeSeconds)}`}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className={`planb${alternate ? '' : ' none'}`}>
        {alternate ? (
          <>
            <div>
              <span className="planb-label">{showAlternate ? 'Primary route' : `If ${guide.exitName} is blocked`}</span>
              <strong>
                {showAlternate ? guide.exitName : alternate.exitName} · {formatDuration(showAlternate ? guide.seconds : alternate.seconds)}
              </strong>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={onToggleAlternate}>
              {showAlternate ? 'Back' : 'Show Plan B'}
            </button>
          </>
        ) : (
          <div>
            <span className="planb-label">
              <Icon name="alert" size={14} /> No Plan B
            </span>
            <strong>Every way out of here relies on {guide.exitName}.</strong>
          </div>
        )}
      </div>
    </div>
  );
}
