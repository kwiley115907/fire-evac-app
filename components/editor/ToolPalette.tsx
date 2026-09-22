'use client';

import type { Tool } from './types';

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'select', label: '↖ Select', hint: 'Click an element to edit or delete it' },
  { id: 'room', label: '▭ Draw room', hint: 'Click points, then Finish room' },
  { id: 'wall', label: '／ Draw wall', hint: 'Click a start point, then an end point' },
  { id: 'door', label: '🚪 Place door', hint: 'Click inside one room, then the adjoining room' },
  { id: 'connector', label: '🪜 Stair / lift', hint: 'Click to place, or click an existing one to toggle this floor' },
  { id: 'route', label: '🧭 Find route', hint: 'Click a point inside a room to route to the nearest exit' },
];

export function ToolPalette({
  tool,
  onChange,
  draftCount,
  onFinishRoom,
  onCancelDraft,
}: {
  tool: Tool;
  onChange: (tool: Tool) => void;
  draftCount: number;
  onFinishRoom: () => void;
  onCancelDraft: () => void;
}) {
  const active = TOOLS.find((t) => t.id === tool)!;
  return (
    <div className="tool-group">
      <div className="tool-group-label">Tools</div>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tool-btn${tool === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
      <p style={{ fontSize: '0.78rem', marginTop: '0.5rem' }}>{active.hint}</p>

      {tool === 'room' && draftCount > 0 && (
        <div className="tool-group">
          <button type="button" className="btn-primary btn-sm" onClick={onFinishRoom} disabled={draftCount < 3}>
            Finish room ({draftCount} pts)
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onCancelDraft}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
