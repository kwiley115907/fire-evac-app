'use client';

import { useRef } from 'react';
import type { BuildingGraph, Point } from '@/lib/evacuation-types';
import { floorBounds } from '@/lib/editor-utils';
import type { RoutePreview, Selected, Tool } from './types';

const SCALE = 28;

export function BuildingCanvas({
  graph,
  floor,
  tool,
  draftPolygon,
  draftWallStart,
  draftDoorRoomA,
  selected,
  routePreview,
  onBackgroundClick,
  onRoomClick,
  onSelect,
}: {
  graph: BuildingGraph;
  floor: number;
  tool: Tool;
  draftPolygon: Point[];
  draftWallStart: Point | null;
  draftDoorRoomA: string | null;
  selected: Selected;
  routePreview: RoutePreview | null;
  onBackgroundClick: (point: Point) => void;
  onRoomClick: (roomId: string, point: Point) => void;
  onSelect: (selected: Selected) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const bbox = floorBounds(graph, floor);
  const widthM = bbox.maxX - bbox.minX;
  const heightM = bbox.maxY - bbox.minY;

  function toPoint(e: React.MouseEvent<SVGSVGElement>): Point | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(local.x * 10) / 10, y: Math.round(local.y * 10) / 10 };
  }

  const rooms = graph.rooms.filter((r) => r.floor === floor);
  const walls = graph.walls.filter((w) => w.floor === floor);
  const doors = graph.doors.filter((d) => d.floor === floor);
  const connectors = graph.connectors.filter((c) => c.floors.includes(floor));

  const routeOnFloor =
    routePreview && routePreview.floor === floor
      ? routePreview.route.steps.filter((s) => s.floor === floor)
      : [];

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        viewBox={`${bbox.minX} ${bbox.minY} ${widthM} ${heightM}`}
        width={Math.max(widthM * SCALE, 400)}
        height={Math.max(heightM * SCALE, 300)}
        onClick={(e) => {
          const point = toPoint(e);
          if (point) onBackgroundClick(point);
        }}
      >
        {walls.map((w) => (
          <line
            key={w.id}
            x1={w.start.x}
            y1={w.start.y}
            x2={w.end.x}
            y2={w.end.y}
            stroke={selected?.kind === 'wall' && selected.id === w.id ? '#35d7ff' : 'rgba(232,242,247,0.55)'}
            strokeWidth={selected?.kind === 'wall' && selected.id === w.id ? 3 : 2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            onClick={(e) => {
              e.stopPropagation();
              if (tool === 'select') onSelect({ kind: 'wall', id: w.id });
            }}
            style={{ cursor: tool === 'select' ? 'pointer' : undefined }}
          />
        ))}

        {rooms.map((room) => {
          const isSelected = selected?.kind === 'room' && selected.id === room.id;
          const points = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
          const cx = room.polygon.reduce((s, p) => s + p.x, 0) / room.polygon.length;
          const cy = room.polygon.reduce((s, p) => s + p.y, 0) / room.polygon.length;
          return (
            <g key={room.id}>
              <polygon
                points={points}
                fill={room.isExit ? 'rgba(61,220,151,0.14)' : 'rgba(53,215,255,0.08)'}
                stroke={isSelected ? '#7af0ff' : room.isExit ? 'rgba(61,220,151,0.6)' : 'rgba(53,215,255,0.4)'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                vectorEffect="non-scaling-stroke"
                onClick={(e) => {
                  e.stopPropagation();
                  if (tool === 'select') onSelect({ kind: 'room', id: room.id });
                  else onRoomClick(room.id, { x: cx, y: cy });
                }}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={cx}
                y={cy}
                fontSize={0.55}
                textAnchor="middle"
                fill="#e8f2f7"
                style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
              >
                {room.name ?? room.id}
                {room.isExit ? ' 🚪' : ''}
              </text>
            </g>
          );
        })}

        {doors.map((d) => (
          <circle
            key={d.id}
            cx={d.position.x}
            cy={d.position.y}
            r={0.35}
            fill={selected?.kind === 'door' && selected.id === d.id ? '#7af0ff' : '#ffb648'}
            stroke="#05070a"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
            onClick={(e) => {
              e.stopPropagation();
              if (tool === 'select') onSelect({ kind: 'door', id: d.id });
            }}
            style={{ cursor: tool === 'select' ? 'pointer' : undefined }}
          />
        ))}

        {connectors.map((c) => (
          <g key={c.id}>
            <rect
              x={c.position.x - 0.4}
              y={c.position.y - 0.4}
              width={0.8}
              height={0.8}
              fill={c.evacuationSafe ? 'rgba(61,220,151,0.85)' : 'rgba(255,77,94,0.85)'}
              stroke={selected?.kind === 'connector' && selected.id === c.id ? '#7af0ff' : '#05070a'}
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
              transform={`rotate(45 ${c.position.x} ${c.position.y})`}
              onClick={(e) => {
                e.stopPropagation();
                if (tool === 'select') onSelect({ kind: 'connector', id: c.id });
                else onBackgroundClick(c.position);
              }}
              style={{ cursor: 'pointer' }}
            />
            <text x={c.position.x} y={c.position.y - 0.7} fontSize={0.4} textAnchor="middle" fill="#8ba0ad" style={{ pointerEvents: 'none', fontFamily: 'monospace' }}>
              {c.type === 'stair' ? 'stair' : 'lift'}
            </text>
          </g>
        ))}

        {draftPolygon.length > 0 && (
          <polyline
            points={draftPolygon.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#35d7ff"
            strokeDasharray="0.2,0.2"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {draftPolygon.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={0.15} fill="#35d7ff" />
        ))}

        {draftWallStart && (
          <circle cx={draftWallStart.x} cy={draftWallStart.y} r={0.2} fill="#35d7ff" />
        )}

        {draftDoorRoomA && (
          <text x={bbox.minX + 0.5} y={bbox.minY + 1} fontSize={0.5} fill="#ffb648" fontFamily="monospace">
            Pick the second room for the door…
          </text>
        )}

        {routeOnFloor.length > 1 && (
          <polyline
            points={routeOnFloor.map((s) => `${s.position.x},${s.position.y}`).join(' ')}
            fill="none"
            stroke="#35d7ff"
            strokeWidth={3.5}
            strokeDasharray="0.4,0.3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.9}
          />
        )}
      </svg>
    </div>
  );
}
