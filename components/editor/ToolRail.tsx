'use client';

import { Icon, type IconName } from '@/components/icons';
import type { Tool, ViewMode } from './types';

export const TOOLS: { id: Tool; label: string; key: string; icon: IconName; hint: string; scenario?: boolean }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: 'select', hint: 'Click anything to edit it · drag to pan · scroll or pinch to zoom' },
  { id: 'room', label: 'Room', key: 'R', icon: 'room', hint: 'Click each corner of the room · Enter to finish · Esc to cancel' },
  { id: 'wall', label: 'Wall', key: 'W', icon: 'wall', hint: 'Click a start point, then an end point' },
  { id: 'door', label: 'Door', key: 'D', icon: 'door', hint: 'Click a room, then its neighbour — the door snaps onto the wall they share' },
  { id: 'connector', label: 'Stair', key: 'S', icon: 'stairs', hint: 'Click inside a room to drop a stair · click one again to add or remove this floor' },
  { id: 'hazard', label: 'Hazard', key: 'F', icon: 'fire', hint: 'Drill: click a room to set it on fire, a door or stair to block it — routes re-plan live', scenario: true },
  { id: 'route', label: 'Guide', key: 'G', icon: 'route', hint: 'Click anywhere inside a room to get its way out', scenario: true },
];

export function toolsFor(view: ViewMode) {
  return view === 'plan' ? TOOLS : TOOLS.filter((t) => t.scenario);
}

export function ToolRail({
  tool,
  view,
  onChange,
  onDetect,
  draftCount,
  onFinishRoom,
  onCancelDraft,
}: {
  tool: Tool;
  view: ViewMode;
  onChange: (tool: Tool) => void;
  onDetect?: () => void;
  draftCount: number;
  onFinishRoom: () => void;
  onCancelDraft: () => void;
}) {
  const tools = toolsFor(view);
  return (
    <nav className="tool-rail" aria-label="Tools">
      {tools.map((t, i) => (
        <span key={t.id} className="tool-slot">
          {i > 0 && t.scenario && !tools[i - 1].scenario && <span className="tool-sep" aria-hidden="true" />}
          <button
            type="button"
            className={`tool${tool === t.id ? ' active' : ''}${t.id === 'hazard' ? ' tool-fire' : ''}${t.id === 'route' ? ' tool-go' : ''}`}
            onClick={() => onChange(t.id)}
            aria-pressed={tool === t.id}
            aria-label={`${t.label} (${t.key})`}
            title={`${t.label} · ${t.key}`}
          >
            <Icon name={t.icon} size={20} />
            <span className="tool-label">{t.label}</span>
            <kbd>{t.key}</kbd>
          </button>
        </span>
      ))}
      {view === 'plan' && onDetect && (
        <span className="tool-slot">
          <span className="tool-sep" aria-hidden="true" />
          <button type="button" className="tool tool-ai" onClick={onDetect} title="Detect rooms from a floor-plan image" aria-label="Detect from image">
            <Icon name="sparkle" size={20} />
            <span className="tool-label">Detect</span>
          </button>
        </span>
      )}
      {tool === 'room' && draftCount > 0 && (
        <div className="draft-actions">
          <button type="button" className="btn-primary btn-sm" onClick={onFinishRoom} disabled={draftCount < 3}>
            <Icon name="check" size={15} /> Finish ({draftCount})
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onCancelDraft}>
            Cancel
          </button>
        </div>
      )}
    </nav>
  );
}

export function FloorRail({
  floors,
  current,
  onSelect,
  onAdd,
  routeFloors,
  startFloor,
  hazardFloors,
}: {
  floors: number[];
  current: number;
  onSelect: (floor: number) => void;
  onAdd?: () => void;
  routeFloors: Set<number>;
  startFloor: number | null;
  hazardFloors: Set<number>;
}) {
  const ordered = [...floors].sort((a, b) => b - a);
  return (
    <div className="floor-rail" role="tablist" aria-label="Floors">
      {onAdd && (
        <button type="button" className="floor-btn add" onClick={onAdd} title="Add a floor above" aria-label="Add floor">
          <Icon name="plus" size={16} />
        </button>
      )}
      {ordered.map((f) => (
        <button
          key={f}
          type="button"
          role="tab"
          aria-selected={f === current}
          className={`floor-btn${f === current ? ' active' : ''}${routeFloors.has(f) ? ' on-route' : ''}`}
          onClick={() => onSelect(f)}
          title={`Floor ${f}`}
        >
          <span className="mono">{f}</span>
          {startFloor === f && <span className="floor-dot start" aria-label="You are here" />}
          {hazardFloors.has(f) && <span className="floor-dot hazard" aria-label="Hazard on this floor" />}
        </button>
      ))}
    </div>
  );
}

export function ViewSwitch({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const options: { id: ViewMode; label: string; icon: IconName }[] = [
    { id: 'plan', label: 'Plan', icon: 'plan' },
    { id: 'flow', label: 'Flow', icon: 'flow' },
    { id: '3d', label: '3D', icon: 'layers' },
  ];
  return (
    <div className="view-switch" role="tablist" aria-label="View">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          className={value === o.id ? 'active' : ''}
          onClick={() => onChange(o.id)}
        >
          <Icon name={o.icon} size={16} />
          {o.label}
        </button>
      ))}
    </div>
  );
}
