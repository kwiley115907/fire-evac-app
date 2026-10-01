'use client';

import { Icon } from '@/components/icons';
import type { EgressAudit as Audit } from '@/lib/evacuation-field';
import type { Room } from '@/lib/evacuation-types';

const FT_PER_M = 3.28084;

function RoomChips({ rooms, onFocus }: { rooms: Room[]; onFocus: (room: Room) => void }) {
  return (
    <div className="chips">
      {rooms.slice(0, 12).map((r) => (
        <button key={r.id} type="button" className="chip" onClick={() => onFocus(r)}>
          {r.name || 'Unnamed'} <span className="mono">F{r.floor}</span>
        </button>
      ))}
      {rooms.length > 12 && <span className="chip muted">+{rooms.length - 12} more</span>}
    </div>
  );
}

export function EgressAudit({
  audit,
  limitMeters,
  onLimitChange,
  onFocusRoom,
  hazardCount,
}: {
  audit: Audit;
  limitMeters: number;
  onLimitChange: (m: number) => void;
  onFocusRoom: (room: Room) => void;
  hazardCount: number;
}) {
  if (audit.roomCount === 0) {
    return (
      <div className="audit-empty">
        <Icon name="shield" size={28} />
        <p>Draw some rooms and mark at least one exit — the audit checks every room&apos;s way out.</p>
      </div>
    );
  }

  const critical = audit.unreachable.length;
  const warnings = audit.overLimit.length + audit.singleExit.length;
  const status = critical > 0 ? 'critical' : warnings > 0 ? 'warn' : 'ok';
  const maxArea = Math.max(1, ...audit.exitLoad.map((e) => e.area));

  return (
    <div className="audit">
      <div className={`audit-status ${status}`}>
        <Icon name={status === 'ok' ? 'shield' : 'alert'} size={22} />
        <div>
          <strong>
            {status === 'critical'
              ? `${critical} room${critical === 1 ? ' has' : 's have'} no way out`
              : status === 'warn'
                ? `${warnings} thing${warnings === 1 ? '' : 's'} to review`
                : 'Every room has a way out'}
          </strong>
          <span>
            {audit.roomCount} rooms · {audit.exitCount} exit{audit.exitCount === 1 ? '' : 's'}
            {hazardCount > 0 ? ` · with ${hazardCount} drill hazard${hazardCount === 1 ? '' : 's'}` : ''}
          </span>
        </div>
      </div>

      {critical > 0 && (
        <section className="audit-row bad">
          <h4>No route to any exit</h4>
          <RoomChips rooms={audit.unreachable} onFocus={onFocusRoom} />
        </section>
      )}

      <section className="audit-row">
        <h4>Longest travel</h4>
        {audit.longest ? (
          <button type="button" className="audit-longest" onClick={() => onFocusRoom(audit.longest!.room)}>
            <span>{audit.longest.room.name || 'Unnamed'}</span>
            <span className={`mono ${audit.longest.meters > limitMeters ? 'over' : ''}`}>
              {Math.round(audit.longest.meters)} m <small>/ {Math.round(limitMeters)} m</small>
            </span>
          </button>
        ) : (
          <p className="muted">—</p>
        )}
        <div className="meter">
          <span
            style={{ width: `${Math.min(100, ((audit.longest?.meters ?? 0) / limitMeters) * 100)}%` }}
            className={(audit.longest?.meters ?? 0) > limitMeters ? 'over' : ''}
          />
        </div>
        <label className="limit">
          <span>Travel limit</span>
          <input
            type="number"
            min={5}
            max={500}
            step={1}
            value={Math.round(limitMeters)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) onLimitChange(v);
            }}
          />
          <span className="muted mono">m ≈ {Math.round(limitMeters * FT_PER_M)} ft</span>
        </label>
        <p className="fine">Set this to the exit-access travel distance your code and occupancy allow. Distances follow the drawn room graph.</p>
      </section>

      {audit.overLimit.length > 0 && (
        <section className="audit-row warn">
          <h4>Over the travel limit</h4>
          <RoomChips rooms={audit.overLimit.map((o) => o.room)} onFocus={onFocusRoom} />
        </section>
      )}

      <section className={`audit-row${audit.singleExit.length ? ' warn' : ''}`}>
        <h4>Single point of failure</h4>
        {audit.singleExit.length ? (
          <>
            <p className="muted">Lose one exit and these rooms have no way out.</p>
            <RoomChips rooms={audit.singleExit} onFocus={onFocusRoom} />
          </>
        ) : (
          <p className="muted">Every reachable room has a second exit.</p>
        )}
      </section>

      <section className="audit-row">
        <h4>Exit load</h4>
        <div className="load-list">
          {audit.exitLoad.map(({ exit, rooms, area }) => (
            <div key={exit.id} className="load">
              <div className="load-head">
                <span>{exit.name || 'Exit'}</span>
                <span className="mono muted">
                  {rooms} room{rooms === 1 ? '' : 's'} · {Math.round(area)} m²
                </span>
              </div>
              <div className="meter go">
                <span style={{ width: `${(area / maxArea) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
