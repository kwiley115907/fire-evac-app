'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BuildingGraph, DoorOpening, EvacuationRoute, Point, Room, WallSegment } from '@/lib/evacuation-types';
import { nextId } from '@/lib/editor-utils';
import { NavBar } from '@/components/NavBar';
import { ToolPalette } from './ToolPalette';
import { FloorTabs } from './FloorTabs';
import { PropertiesPanel } from './PropertiesPanel';
import { BuildingCanvas } from './BuildingCanvas';
import { ChatPanel } from './ChatPanel';
import { AiDetectModal } from './AiDetectModal';
import type { RoutePreview, Selected, Tool } from './types';

const CONNECTOR_HIT_RADIUS = 0.7;

export function BuildingEditor({
  buildingId,
  initialName,
  initialGraph,
}: {
  buildingId: string;
  initialName: string;
  initialGraph: BuildingGraph;
}) {
  const [name] = useState(initialName);
  const [graph, setGraph] = useState<BuildingGraph>(initialGraph);
  const [floor, setFloor] = useState(initialGraph.floors[0] ?? 1);
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<Selected>(null);
  const [draftPolygon, setDraftPolygon] = useState<Point[]>([]);
  const [draftWallStart, setDraftWallStart] = useState<Point | null>(null);
  const [draftDoor, setDraftDoor] = useState<{ roomId: string; point: Point } | null>(null);
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAiDetect, setShowAiDetect] = useState(false);

  function updateGraph(next: BuildingGraph) {
    setGraph(next);
    setDirty(true);
  }

  function changeTool(next: Tool) {
    setTool(next);
    setDraftPolygon([]);
    setDraftWallStart(null);
    setDraftDoor(null);
    if (next !== 'select') setSelected(null);
  }

  async function computeRoute(point: Point) {
    setRouteMessage(null);
    try {
      const res = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, point, floor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRoutePreview(null);
        setRouteMessage(data.error ?? 'No route found.');
        return;
      }
      const route = data as EvacuationRoute;
      setRoutePreview({ route, floor });
      setRouteMessage(`Nearest exit: ${route.reachedExitId} — ${route.totalDistanceMeters.toFixed(1)}m`);
    } catch {
      setRoutePreview(null);
      setRouteMessage('Route request failed.');
    }
  }

  function handleBackgroundClick(point: Point) {
    if (tool === 'room') {
      setDraftPolygon((prev) => [...prev, point]);
      return;
    }
    if (tool === 'wall') {
      if (!draftWallStart) {
        setDraftWallStart(point);
      } else {
        const wall: WallSegment = { id: nextId('wall'), floor, start: draftWallStart, end: point };
        updateGraph({ ...graph, walls: [...graph.walls, wall] });
        setDraftWallStart(null);
      }
      return;
    }
    if (tool === 'connector') {
      const existing = graph.connectors.find(
        (c) => Math.hypot(c.position.x - point.x, c.position.y - point.y) < CONNECTOR_HIT_RADIUS
      );
      if (existing) {
        const hasFloor = existing.floors.includes(floor);
        const nextFloors = hasFloor
          ? existing.floors.filter((f) => f !== floor)
          : [...existing.floors, floor].sort((a, b) => a - b);
        if (nextFloors.length === 0) return;
        updateGraph({
          ...graph,
          connectors: graph.connectors.map((c) => (c.id === existing.id ? { ...c, floors: nextFloors } : c)),
        });
      } else {
        updateGraph({
          ...graph,
          connectors: [
            ...graph.connectors,
            { id: nextId('connector'), type: 'stair', position: point, floors: [floor], evacuationSafe: true },
          ],
        });
      }
      return;
    }
    if (tool === 'select') {
      setSelected(null);
    }
  }

  function handleRoomClick(roomId: string, point: Point) {
    if (tool === 'door') {
      if (!draftDoor) {
        setDraftDoor({ roomId, point });
      } else if (draftDoor.roomId !== roomId) {
        const door: DoorOpening = {
          id: nextId('door'),
          floor,
          position: { x: (draftDoor.point.x + point.x) / 2, y: (draftDoor.point.y + point.y) / 2 },
          roomA: draftDoor.roomId,
          roomB: roomId,
          widthMeters: 0.9,
        };
        updateGraph({ ...graph, doors: [...graph.doors, door] });
        setDraftDoor(null);
      }
      return;
    }
    if (tool === 'route') {
      computeRoute(point);
      return;
    }
    handleBackgroundClick(point);
  }

  function finishRoom() {
    if (draftPolygon.length < 3) return;
    const nameInput = typeof window !== 'undefined' ? window.prompt('Room name (optional):', '') : '';
    const room: Room = {
      id: nextId('room'),
      floor,
      polygon: draftPolygon,
      isExit: false,
      name: nameInput?.trim() || undefined,
    };
    updateGraph({ ...graph, rooms: [...graph.rooms, room] });
    setDraftPolygon([]);
  }

  function addFloor() {
    const next = Math.max(...graph.floors, 0) + 1;
    updateGraph({ ...graph, floors: [...graph.floors, next] });
    setFloor(next);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Save failed');
      }
      setDirty(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shell">
      <NavBar />
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/dashboard" className="btn-ghost btn-sm">
            ← Dashboard
          </Link>
          <h2 style={{ margin: 0 }}>{name}</h2>
        </div>
        <button type="button" className="btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving && <span className="spinner" />}
          {dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>

      <div className="editor-shell">
        <div className="editor-panel glass-panel">
          <FloorTabs floors={graph.floors} current={floor} onSelect={setFloor} onAddFloor={addFloor} />
          <ToolPalette
            tool={tool}
            onChange={changeTool}
            draftCount={draftPolygon.length}
            onFinishRoom={finishRoom}
            onCancelDraft={() => setDraftPolygon([])}
          />
          <div className="tool-group">
            <div className="tool-group-label">Ingest</div>
            <button type="button" className="tool-btn" onClick={() => setShowAiDetect(true)}>
              📷 Detect from image
            </button>
          </div>
          {routeMessage && (
            <div className={`route-banner${routePreview ? '' : ' error'}`}>{routeMessage}</div>
          )}
        </div>

        <BuildingCanvas
          graph={graph}
          floor={floor}
          tool={tool}
          draftPolygon={draftPolygon}
          draftWallStart={draftWallStart}
          draftDoorRoomA={draftDoor?.roomId ?? null}
          selected={selected}
          routePreview={routePreview}
          onBackgroundClick={handleBackgroundClick}
          onRoomClick={handleRoomClick}
          onSelect={setSelected}
        />

        <div className="side-panel">
          <PropertiesPanel graph={graph} selected={selected} onChange={updateGraph} onClose={() => setSelected(null)} />
          <ChatPanel
            buildingId={buildingId}
            onRoute={(route, routeFloor) => {
              setRoutePreview({ route, floor: routeFloor });
              setFloor(routeFloor);
            }}
          />
        </div>
      </div>

      {showAiDetect && (
        <AiDetectModal
          floor={floor}
          onClose={() => setShowAiDetect(false)}
          onMerge={({ rooms, walls, doors }) =>
            updateGraph({
              ...graph,
              rooms: [...graph.rooms, ...rooms],
              walls: [...graph.walls, ...walls],
              doors: [...graph.doors, ...doors],
            })
          }
        />
      )}
    </div>
  );
}
