'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Point } from '@/lib/evacuation-types';
import { findRoomAtPoint } from '@/lib/evacuation-geometry';
import { sampleBuilding } from '@/lib/sample-building';
import { computeEscapeField, flowNetwork, NO_HAZARDS, planEvacuation, routeFromRoom, toggleHazard, type Hazards } from '@/lib/evacuation-field';
import { buildGuide, formatDuration, roomEtas, WALK_SPEED_MPS } from '@/lib/route-directions';
import { PlanView } from '@/components/plan/PlanView';
import { StackView } from '@/components/plan/StackView';
import { Icon } from '@/components/icons';
import type { PickTarget } from '@/components/editor/types';

type DemoView = '3d' | 'flow' | 'plan';
const LIMIT_SECONDS = 61 / WALK_SPEED_MPS;
// Board Room, top floor — a long way from any exit, with two very
// different ways down depending on where the fire is.
const START = { point: { x: 34, y: 5 }, floor: 3 };

// The real routing engine running entirely in the browser on a sample
// three-storey office — tap rooms, start fires, watch it re-plan.
export function LiveDemo() {
  const graph = useMemo(() => sampleBuilding(), []);
  const [view, setView] = useState<DemoView>('3d');
  const [floor, setFloor] = useState(START.floor);
  const [start, setStart] = useState<{ point: Point; floor: number }>(START);
  const [hazards, setHazards] = useState<Hazards>(NO_HAZARDS);
  const [fireMode, setFireMode] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);

  const field = useMemo(() => computeEscapeField(graph, hazards), [graph, hazards]);
  const etas = useMemo(
    () =>
      roomEtas(graph, (id, p) => {
        const room = graph.rooms.find((r) => r.id === id);
        return room ? routeFromRoom(field, room, p) : null;
      }),
    [graph, field]
  );
  const flow = useMemo(() => flowNetwork(graph, field), [graph, field]);
  const plan = useMemo(() => planEvacuation(graph, hazards, start.point, start.floor, field), [graph, hazards, start, field]);
  const route = plan?.primary ?? null;
  const guide = useMemo(() => (route ? buildGuide(graph, route) : null), [graph, route]);
  const firstMove = guide?.maneuvers.find((m) => m.kind !== 'start');

  function say(text: string) {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    setFlash(text);
    flashTimer.current = window.setTimeout(() => setFlash(null), 2600);
  }

  function toggleFire(roomId: string) {
    const next = toggleHazard(hazards, 'rooms', roomId);
    const before = route;
    const after = planEvacuation(graph, next, start.point, start.floor)?.primary ?? null;
    setHazards(next);
    const room = graph.rooms.find((r) => r.id === roomId);
    if (!after) say('No way out from here anymore');
    else if (before && after.reachedExitId !== before.reachedExitId) {
      say(`Rerouted via ${graph.rooms.find((r) => r.id === after.reachedExitId)?.name}`);
    } else say(next.rooms.includes(roomId) ? `${room?.name} is on fire` : `${room?.name} cleared`);
  }

  function pickRoom(roomId: string, point: Point, f: number) {
    if (fireMode) {
      toggleFire(roomId);
      return;
    }
    setStart({ point, floor: f });
    setFloor(f);
  }

  function onPlanPick(target: PickTarget, point: Point) {
    const room = target.kind === 'room' ? graph.rooms.find((r) => r.id === target.id) : findRoomAtPoint(point, floor, graph.rooms);
    if (room) pickRoom(room.id, point, floor);
  }

  return (
    <div className="live-demo">
      {view === '3d' ? (
        <StackView
          graph={graph}
          hazards={hazards}
          etas={etas}
          limitSeconds={LIMIT_SECONDS}
          route={route}
          focusFloor={floor}
          onPickRoom={pickRoom}
          autoRotate
          compact
        />
      ) : (
        <PlanView
          graph={graph}
          floor={floor}
          mode={view === 'flow' ? 'flow' : 'plan'}
          tool={fireMode ? 'hazard' : 'route'}
          hazards={hazards}
          flow={flow}
          etas={etas}
          smokyRooms={field.smokyRooms}
          limitSeconds={LIMIT_SECONDS}
          route={route}
          alternate={null}
          focusLeg={null}
          selected={null}
          onPick={onPlanPick}
          onFloorJump={setFloor}
          compact
        />
      )}

      <div className="live-bar">
        <span className="live-tag">
          <span className="pulse-dot" /> Live engine
        </span>
        <div className="view-switch" role="tablist" aria-label="Demo view">
          {(['3d', 'flow', 'plan'] as DemoView[]).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {v === '3d' ? '3D' : v === 'flow' ? 'Flow' : 'Plan'}
            </button>
          ))}
        </div>
        {view !== '3d' ? (
          <div className="view-switch" aria-label="Floor">
            {[3, 2, 1].map((f) => (
              <button key={f} type="button" className={floor === f ? 'active' : ''} onClick={() => setFloor(f)}>
                F{f}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
      </div>

      <div className="live-card">
        <div>
          <div className="eta-label">{flash ? 'Update' : 'To safety'}</div>
          <div className="eta" style={!route ? { color: 'var(--fire)' } : undefined}>
            {route && guide ? formatDuration(guide.seconds) : '—'}
          </div>
        </div>
        <div className="live-step" aria-live="polite">
          {flash ? (
            <strong>{flash}</strong>
          ) : fireMode ? (
            <>
              <strong>Fire mode:</strong> tap rooms to set them alight
            </>
          ) : guide && firstMove ? (
            <>
              <strong>{firstMove.instruction}</strong> · {firstMove.target}
            </>
          ) : (
            'Tap any room to find its way out'
          )}
        </div>
        <div className="live-actions">
          <button type="button" className={fireMode ? 'on' : ''} onClick={() => setFireMode((m) => !m)} aria-pressed={fireMode}>
            <Icon name="fire" size={14} /> {fireMode ? 'Done' : 'Fire'}
          </button>
          {hazards.rooms.length > 0 && (
            <button type="button" onClick={() => setHazards(NO_HAZARDS)} aria-label="Clear fires">
              <Icon name="close" size={14} />
            </button>
          )}
          <Link href="/demo" className="btn btn-primary btn-sm">
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}
