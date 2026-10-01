'use client';

import type { BuildingGraph } from '@/lib/evacuation-types';
import { polygonArea } from '@/lib/evacuation-geometry';
import { Icon } from '@/components/icons';
import type { Selected } from './types';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      {label}
    </label>
  );
}

export function PropertiesPanel({
  graph,
  selected,
  onChange,
  onClose,
  autoFocusName = false,
  onNamed,
}: {
  graph: BuildingGraph;
  selected: Selected;
  onChange: (graph: BuildingGraph) => void;
  onClose: () => void;
  autoFocusName?: boolean;
  onNamed?: () => void;
}) {
  if (!selected) {
    return (
      <div className="inspect-empty">
        <Icon name="select" size={26} />
        <p>
          Pick the <strong>Select</strong> tool and click a room, door, wall or stair to edit it.
        </p>
        <div className="kbd-help">
          <span>
            <kbd>R</kbd> room
          </span>
          <span>
            <kbd>D</kbd> door
          </span>
          <span>
            <kbd>S</kbd> stair
          </span>
          <span>
            <kbd>F</kbd> hazard
          </span>
          <span>
            <kbd>G</kbd> guide
          </span>
          <span>
            <kbd>1</kbd>
            <kbd>2</kbd>
            <kbd>3</kbd> views
          </span>
        </div>
      </div>
    );
  }

  const roomName = (id: string) => graph.rooms.find((r) => r.id === id)?.name || 'Unnamed room';

  if (selected.kind === 'room') {
    const room = graph.rooms.find((r) => r.id === selected.id);
    if (!room) return null;
    const doors = graph.doors.filter((d) => d.roomA === room.id || d.roomB === room.id);
    return (
      <div className="inspect">
        <div className="inspect-head">
          <span className="inspect-kind">Room · Floor {room.floor}</span>
          <span className="mono muted">{Math.round(polygonArea(room.polygon))} m²</span>
        </div>
        <label className="field">
          <span>Name</span>
          <input
            // Focus the name as soon as a room is drawn so you can just type.
            autoFocus={autoFocusName}
            value={room.name ?? ''}
            placeholder="e.g. Server Room"
            onChange={(e) =>
              onChange({ ...graph, rooms: graph.rooms.map((r) => (r.id === room.id ? { ...r, name: e.target.value } : r)) })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
                onNamed?.();
              }
            }}
          />
        </label>
        <Toggle
          checked={room.isExit}
          label="This is an exit"
          onChange={(isExit) => onChange({ ...graph, rooms: graph.rooms.map((r) => (r.id === room.id ? { ...r, isExit } : r)) })}
        />
        <div className="inspect-list">
          <span className="inspect-kind">Doors ({doors.length})</span>
          {doors.length === 0 ? (
            <p className="warn-text">No doors yet, so nobody can get in or out. Use the Door tool.</p>
          ) : (
            doors.map((d) => (
              <span key={d.id} className="inspect-item">
                <Icon name="door" size={14} /> {roomName(d.roomA === room.id ? d.roomB : d.roomA)}
              </span>
            ))
          )}
        </div>
        <button
          type="button"
          className="btn-danger btn-sm"
          onClick={() => {
            onChange({
              ...graph,
              rooms: graph.rooms.filter((r) => r.id !== room.id),
              doors: graph.doors.filter((d) => d.roomA !== room.id && d.roomB !== room.id),
            });
            onClose();
          }}
        >
          <Icon name="trash" size={15} /> Delete room
        </button>
      </div>
    );
  }

  if (selected.kind === 'connector') {
    const connector = graph.connectors.find((c) => c.id === selected.id);
    if (!connector) return null;
    const update = (patch: Partial<typeof connector>) =>
      onChange({ ...graph, connectors: graph.connectors.map((c) => (c.id === connector.id ? { ...c, ...patch } : c)) });
    return (
      <div className="inspect">
        <div className="inspect-head">
          <span className="inspect-kind">{connector.type === 'stair' ? 'Stairwell' : 'Elevator'}</span>
        </div>
        <label className="field">
          <span>Name</span>
          <input value={connector.name ?? ''} placeholder="e.g. East Stair" onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={connector.type} onChange={(e) => update({ type: e.target.value as 'stair' | 'elevator' })}>
            <option value="stair">Stairwell</option>
            <option value="elevator">Elevator</option>
          </select>
        </label>
        <Toggle checked={connector.evacuationSafe} label="Safe to use during evacuation" onChange={(evacuationSafe) => update({ evacuationSafe })} />
        <div className="inspect-list">
          <span className="inspect-kind">Serves floors</span>
          <div className="floor-pills">
            {[...graph.floors]
              .sort((a, b) => a - b)
              .map((f) => {
                const on = connector.floors.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    className={`floor-pill${on ? ' on' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      const floors = on ? connector.floors.filter((x) => x !== f) : [...connector.floors, f].sort((a, b) => a - b);
                      if (floors.length) update({ floors });
                    }}
                  >
                    F{f}
                  </button>
                );
              })}
          </div>
        </div>
        <button
          type="button"
          className="btn-danger btn-sm"
          onClick={() => {
            onChange({ ...graph, connectors: graph.connectors.filter((c) => c.id !== connector.id) });
            onClose();
          }}
        >
          <Icon name="trash" size={15} /> Delete
        </button>
      </div>
    );
  }

  if (selected.kind === 'door') {
    const door = graph.doors.find((d) => d.id === selected.id);
    if (!door) return null;
    return (
      <div className="inspect">
        <div className="inspect-head">
          <span className="inspect-kind">Door · Floor {door.floor}</span>
        </div>
        <p className="inspect-link">
          {roomName(door.roomA)} <Icon name="door" size={14} /> {roomName(door.roomB)}
        </p>
        <label className="field">
          <span>Clear width (m)</span>
          <input
            type="number"
            min={0.5}
            max={6}
            step={0.1}
            value={door.widthMeters}
            onChange={(e) => {
              const widthMeters = Number(e.target.value);
              if (widthMeters > 0) onChange({ ...graph, doors: graph.doors.map((d) => (d.id === door.id ? { ...d, widthMeters } : d)) });
            }}
          />
        </label>
        <button
          type="button"
          className="btn-danger btn-sm"
          onClick={() => {
            onChange({ ...graph, doors: graph.doors.filter((d) => d.id !== door.id) });
            onClose();
          }}
        >
          <Icon name="trash" size={15} /> Delete door
        </button>
      </div>
    );
  }

  const wall = graph.walls.find((w) => w.id === selected.id);
  if (!wall) return null;
  return (
    <div className="inspect">
      <div className="inspect-head">
        <span className="inspect-kind">Wall · Floor {wall.floor}</span>
        <span className="mono muted">{Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y).toFixed(1)} m</span>
      </div>
      <button
        type="button"
        className="btn-danger btn-sm"
        onClick={() => {
          onChange({ ...graph, walls: graph.walls.filter((w) => w.id !== wall.id) });
          onClose();
        }}
      >
        <Icon name="trash" size={15} /> Delete wall
      </button>
    </div>
  );
}
