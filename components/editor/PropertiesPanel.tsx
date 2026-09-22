'use client';

import type { BuildingGraph } from '@/lib/evacuation-types';
import type { Selected } from './types';

export function PropertiesPanel({
  graph,
  selected,
  onChange,
  onClose,
}: {
  graph: BuildingGraph;
  selected: Selected;
  onChange: (graph: BuildingGraph) => void;
  onClose: () => void;
}) {
  if (!selected) {
    return (
      <div className="glass-panel card">
        <div className="tool-group-label">Properties</div>
        <p style={{ marginTop: '0.5rem' }}>Select a room, wall, door, or connector to edit it here.</p>
      </div>
    );
  }

  if (selected.kind === 'room') {
    const room = graph.rooms.find((r) => r.id === selected.id);
    if (!room) return null;
    return (
      <div className="glass-panel card">
        <div className="tool-group-label">Room</div>
        <div className="field-group">
          <div>
            <label>Name</label>
            <input
              value={room.name ?? ''}
              placeholder={room.id}
              onChange={(e) =>
                onChange({
                  ...graph,
                  rooms: graph.rooms.map((r) => (r.id === room.id ? { ...r, name: e.target.value } : r)),
                })
              }
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={room.isExit}
              onChange={(e) =>
                onChange({
                  ...graph,
                  rooms: graph.rooms.map((r) => (r.id === room.id ? { ...r, isExit: e.target.checked } : r)),
                })
              }
            />
            Marked as exit
          </label>
        </div>
        <div className="modal-actions" style={{ marginTop: 0 }}>
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
            Delete room
          </button>
        </div>
      </div>
    );
  }

  if (selected.kind === 'connector') {
    const connector = graph.connectors.find((c) => c.id === selected.id);
    if (!connector) return null;
    return (
      <div className="glass-panel card">
        <div className="tool-group-label">Stair / Elevator</div>
        <div className="field-group">
          <div>
            <label>Name</label>
            <input
              value={connector.name ?? ''}
              placeholder={connector.id}
              onChange={(e) =>
                onChange({
                  ...graph,
                  connectors: graph.connectors.map((c) => (c.id === connector.id ? { ...c, name: e.target.value } : c)),
                })
              }
            />
          </div>
          <div>
            <label>Type</label>
            <select
              value={connector.type}
              onChange={(e) =>
                onChange({
                  ...graph,
                  connectors: graph.connectors.map((c) =>
                    c.id === connector.id ? { ...c, type: e.target.value as 'stair' | 'elevator' } : c
                  ),
                })
              }
            >
              <option value="stair">Stairwell</option>
              <option value="elevator">Elevator</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={connector.evacuationSafe}
              onChange={(e) =>
                onChange({
                  ...graph,
                  connectors: graph.connectors.map((c) =>
                    c.id === connector.id ? { ...c, evacuationSafe: e.target.checked } : c
                  ),
                })
              }
            />
            Safe to use during evacuation
          </label>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>Present on floors: {connector.floors.join(', ')}</p>
        </div>
        <div className="modal-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={() => {
              onChange({ ...graph, connectors: graph.connectors.filter((c) => c.id !== connector.id) });
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  if (selected.kind === 'door') {
    const door = graph.doors.find((d) => d.id === selected.id);
    if (!door) return null;
    return (
      <div className="glass-panel card">
        <div className="tool-group-label">Door</div>
        <p style={{ margin: 0 }}>
          Connects <code>{door.roomA}</code> ↔ <code>{door.roomB}</code>
        </p>
        <div className="modal-actions" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={() => {
              onChange({ ...graph, doors: graph.doors.filter((d) => d.id !== door.id) });
              onClose();
            }}
          >
            Delete door
          </button>
        </div>
      </div>
    );
  }

  if (selected.kind === 'wall') {
    const wall = graph.walls.find((w) => w.id === selected.id);
    if (!wall) return null;
    return (
      <div className="glass-panel card">
        <div className="tool-group-label">Wall</div>
        <div className="modal-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={() => {
              onChange({ ...graph, walls: graph.walls.filter((w) => w.id !== wall.id) });
              onClose();
            }}
          >
            Delete wall
          </button>
        </div>
      </div>
    );
  }

  return null;
}
