'use client';

export function FloorTabs({
  floors,
  current,
  onSelect,
  onAddFloor,
}: {
  floors: number[];
  current: number;
  onSelect: (floor: number) => void;
  onAddFloor: () => void;
}) {
  return (
    <div className="tool-group">
      <div className="tool-group-label">Floors</div>
      <div className="floor-tabs">
        {floors.map((f) => (
          <button
            key={f}
            type="button"
            className={`floor-tab${f === current ? ' active' : ''}`}
            onClick={() => onSelect(f)}
          >
            F{f}
          </button>
        ))}
        <button type="button" className="floor-tab" onClick={onAddFloor} title="Add floor above">
          +
        </button>
      </div>
    </div>
  );
}
