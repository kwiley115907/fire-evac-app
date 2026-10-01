'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { BuildingGraph, DoorOpening, EvacuationRoute, Point, Room, RouteScan, WallSegment } from '@/lib/evacuation-types';
import { findRoomAtPoint } from '@/lib/evacuation-geometry';
import { contentBounds, focusBox, nextId, sharedBoundaryPoint, snapPoint } from '@/lib/editor-utils';
import { DEFAULT_STORY_HEIGHT, newScanId, placedFloorPaths, placePoint, simplifyScan, straightenRotation, type ScanStep } from '@/lib/ar-scan';
import {
  auditEgress,
  computeEscapeField,
  flowNetwork,
  hazardCount as countHazards,
  NO_HAZARDS,
  planEvacuation,
  routeFromRoom,
  toggleHazard,
  type Hazards,
} from '@/lib/evacuation-field';
import { buildGuide, formatDuration, roomEtas, routeFloorPaths, WALK_SPEED_MPS } from '@/lib/route-directions';
import { Icon } from '@/components/icons';
import { PlanView } from '@/components/plan/PlanView';
import { StackView } from '@/components/plan/StackView';
import { RouteGuide } from '@/components/plan/RouteGuide';
import { EgressAudit } from '@/components/plan/EgressAudit';
import { heatColor } from '@/components/plan/palette';
import { FloorRail, ToolRail, TOOLS, toolsFor, ViewSwitch } from './ToolRail';
import { PropertiesPanel } from './PropertiesPanel';
import { ChatPanel } from './ChatPanel';
import { AiDetectModal } from './AiDetectModal';
import { ArScanner, type ScanCapture } from '@/components/scan/ArScanner';
import { ScanReview } from '@/components/scan/ScanReview';
import { PlacementBar, PlacementPanel, ScanList } from '@/components/scan/ScanPanels';
import type { CameraRequest, PickTarget, Selected, Tool, ViewMode } from './types';

const CONNECTOR_HIT_RADIUS = 0.9;
const DEFAULT_LIMIT_METERS = 61; // 200 ft — a common unsprinklered exit-access limit; adjustable in the audit.

type Tab = 'guide' | 'inspect' | 'audit' | 'scans' | 'ask';
interface Toast {
  text: string;
  tone: 'go' | 'fire' | 'info';
  key: number;
}
interface History {
  past: BuildingGraph[];
  present: BuildingGraph;
  future: BuildingGraph[];
}

export function BuildingEditor({
  buildingId,
  initialName,
  initialGraph,
  demo = false,
  initialRoute = null,
  openScanner = false,
}: {
  buildingId: string;
  initialName: string;
  initialGraph: BuildingGraph;
  demo?: boolean;
  initialRoute?: { point: Point; floor: number } | null;
  openScanner?: boolean;
}) {
  const [history, setHistory] = useState<History>({ past: [], present: initialGraph, future: [] });
  const graph = history.present;
  const [floorState, setFloor] = useState(initialRoute?.floor ?? initialGraph.floors[0] ?? 1);
  const floor = graph.floors.includes(floorState) ? floorState : (graph.floors[0] ?? 1);
  const [view, setView] = useState<ViewMode>(demo ? 'flow' : 'plan');
  const [tool, setTool] = useState<Tool>(initialGraph.rooms.length === 0 ? 'room' : 'route');
  const [selected, setSelected] = useState<Selected>(null);
  const [draftPolygon, setDraftPolygon] = useState<Point[]>([]);
  const [draftWallStart, setDraftWallStart] = useState<Point | null>(null);
  const [draftDoor, setDraftDoor] = useState<{ roomId: string; point: Point } | null>(null);
  const [hazards, setHazards] = useState<Hazards>(NO_HAZARDS);
  const [routeStart, setRouteStart] = useState<{ point: Point; floor: number } | null>(initialRoute);
  const [showAlt, setShowAlt] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>(initialGraph.rooms.length === 0 ? 'inspect' : 'guide');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [limitMeters, setLimitMeters] = useState(DEFAULT_LIMIT_METERS);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showAiDetect, setShowAiDetect] = useState(false);
  const [namingRoom, setNamingRoom] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(openScanner);
  const [review, setReview] = useState<{ scan: RouteScan; steps?: ScanStep[]; isNew: boolean; sample?: boolean } | null>(null);
  const [placing, setPlacing] = useState<RouteScan | null>(null);
  const [hiddenScans, setHiddenScans] = useState<Set<string>>(() => new Set());
  const [videos, setVideos] = useState<Record<string, { url: string; mime: string }>>({});
  const toastTimer = useRef<number | null>(null);

  // ---------- derived ----------
  const field = useMemo(() => computeEscapeField(graph, hazards), [graph, hazards]);
  const etas = useMemo(
    () =>
      roomEtas(graph, (id, start) => {
        const room = graph.rooms.find((r) => r.id === id);
        return room ? routeFromRoom(field, room, start) : null;
      }),
    [graph, field]
  );
  const flow = useMemo(() => flowNetwork(graph, field), [graph, field]);
  const plan = useMemo(
    () => (routeStart ? planEvacuation(graph, hazards, routeStart.point, routeStart.floor, field) : null),
    [graph, hazards, routeStart, field]
  );
  const guide = useMemo(() => (plan?.primary ? buildGuide(graph, plan.primary) : null), [graph, plan]);
  const altGuide = useMemo(() => (plan?.alternate ? buildGuide(graph, plan.alternate) : null), [graph, plan]);
  const usingAlt = showAlt && !!plan?.alternate;
  const shownRoute: EvacuationRoute | null = usingAlt ? plan!.alternate : (plan?.primary ?? null);
  const shownGuide = usingAlt ? altGuide : guide;
  const audit = useMemo(
    () => (tab === 'audit' ? auditEgress(graph, hazards, limitMeters) : null),
    [tab, graph, hazards, limitMeters]
  );
  const limitSeconds = limitMeters / WALK_SPEED_MPS;
  const nHazards = countHazards(hazards);
  const trappedRooms = graph.rooms.some((r) => !r.isExit && !field.distance.has(r.id));

  const routeFloors = useMemo(
    () => new Set(shownRoute ? routeFloorPaths(graph, shownRoute).map((p) => p.floor) : []),
    [graph, shownRoute]
  );
  const hazardFloors = useMemo(() => {
    const s = new Set<number>();
    for (const id of hazards.rooms) {
      const r = graph.rooms.find((x) => x.id === id);
      if (r) s.add(r.floor);
    }
    for (const id of hazards.doors) {
      const d = graph.doors.find((x) => x.id === id);
      if (d) s.add(d.floor);
    }
    for (const id of hazards.connectors) graph.connectors.find((c) => c.id === id)?.floors.forEach((f) => s.add(f));
    return s;
  }, [graph, hazards]);

  const focusLeg =
    activeStep !== null && shownGuide?.maneuvers[activeStep]?.floor === floor
      ? shownGuide.maneuvers[activeStep].points
      : null;

  // ---------- helpers ----------
  const showToast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ text, tone, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    []
  );

  function updateGraph(next: BuildingGraph) {
    setHistory((h) => ({ past: [...h.past.slice(-99), h.present], present: next, future: [] }));
    setDirty(true);
  }

  function undo() {
    setHistory((h) =>
      h.past.length
        ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
        : h
    );
    setDirty(true);
  }

  function redo() {
    setHistory((h) =>
      h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h
    );
    setDirty(true);
  }

  function resetDrafts() {
    setDraftPolygon([]);
    setDraftWallStart(null);
    setDraftDoor(null);
  }

  function changeTool(next: Tool) {
    setTool(next);
    resetDrafts();
    if (next !== 'select') setSelected(null);
  }

  function changeView(next: ViewMode) {
    setView(next);
    resetDrafts();
    if (!toolsFor(next).some((t) => t.id === tool)) setTool('route');
  }

  function flyTo(points: Point[], pad = 4) {
    const box = focusBox(points, pad);
    if (box) setCameraRequest({ box, key: Date.now() });
  }

  function focusRoom(room: Room) {
    setFloor(room.floor);
    if (view !== '3d') flyTo(room.polygon, 3);
  }

  function startRoute(point: Point, atFloor: number) {
    const next = planEvacuation(graph, hazards, point, atFloor, field);
    if (!next) {
      showToast('Tap inside a room to plan its way out', 'info');
      return;
    }
    setRouteStart({ point, floor: atFloor });
    setShowAlt(false);
    setActiveStep(null);
    setPlaying(false);
    setTab('guide');
    setSheetOpen(true);
    if (!next.primary) showToast(`No way out of ${next.room.name || 'this room'} — check doors, stairs and exits`, 'fire');
  }

  function clearRoute() {
    setRouteStart(null);
    setPlaying(false);
    setActiveStep(null);
    setShowAlt(false);
  }

  function focusManeuver(index: number) {
    const m = shownGuide?.maneuvers[index];
    if (!m) return;
    setActiveStep(index);
    setFloor(m.floor);
    if (view !== '3d') flyTo(m.points);
  }

  function applyHazard(kind: keyof Hazards, id: string, name: string) {
    const next = toggleHazard(hazards, kind, id);
    const added = next[kind].includes(id);
    const what = kind === 'rooms' ? 'on fire' : 'blocked';
    setHazards(next);
    if (!routeStart) {
      showToast(added ? `${name} ${what} — every route re-planned` : `${name} cleared`, added ? 'fire' : 'info');
      return;
    }
    const before = plan?.primary ?? null;
    const after = planEvacuation(graph, next, routeStart.point, routeStart.floor)?.primary ?? null;
    if (!after) showToast('No way out from your position anymore', 'fire');
    else if (
      !before ||
      after.reachedExitId !== before.reachedExitId ||
      Math.abs(after.totalDistanceMeters - before.totalDistanceMeters) > 0.01
    ) {
      const exit = graph.rooms.find((r) => r.id === after.reachedExitId);
      showToast(`Rerouted — now via ${exit?.name || 'another exit'}`, 'go');
    } else showToast(added ? `${name} ${what} — your route is unaffected` : `${name} cleared`, 'info');
  }

  function finishRoom() {
    if (draftPolygon.length < 3) return;
    const room: Room = { id: nextId('room'), floor, polygon: draftPolygon, isExit: false };
    updateGraph({ ...graph, rooms: [...graph.rooms, room] });
    setDraftPolygon([]);
    setSelected({ kind: 'room', id: room.id });
    setNamingRoom(room.id);
    setTab('inspect');
    setSheetOpen(true);
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.kind === 'room') {
      updateGraph({
        ...graph,
        rooms: graph.rooms.filter((r) => r.id !== selected.id),
        doors: graph.doors.filter((d) => d.roomA !== selected.id && d.roomB !== selected.id),
      });
    } else if (selected.kind === 'wall') updateGraph({ ...graph, walls: graph.walls.filter((w) => w.id !== selected.id) });
    else if (selected.kind === 'door') updateGraph({ ...graph, doors: graph.doors.filter((d) => d.id !== selected.id) });
    else updateGraph({ ...graph, connectors: graph.connectors.filter((c) => c.id !== selected.id) });
    setSelected(null);
  }

  function addFloor() {
    const next = Math.max(...graph.floors, 0) + 1;
    updateGraph({ ...graph, floors: [...graph.floors, next] });
    setFloor(next);
    showToast(`Floor ${next} added — the floor below shows as a faint outline`, 'info');
  }

  function nameOf(target: PickTarget): string {
    if (target.kind === 'room') return graph.rooms.find((r) => r.id === target.id)?.name || 'Room';
    if (target.kind === 'connector') return graph.connectors.find((c) => c.id === target.id)?.name || 'Stair';
    return 'Door';
  }

  // ---------- AR Scan ----------
  const scans = useMemo(() => graph.scans ?? [], [graph.scans]);

  function upsertScan(scan: RouteScan) {
    const exists = scans.some((x) => x.id === scan.id);
    if (!exists && scans.length >= 30) {
      showToast('This building already has 30 scans — delete one first', 'fire');
      return false;
    }
    updateGraph({ ...graph, scans: exists ? scans.map((x) => (x.id === scan.id ? scan : x)) : [...scans, scan] });
    return true;
  }

  function onCaptured(capture: ScanCapture) {
    setScannerOpen(false);
    const scan: RouteScan = {
      id: newScanId(),
      name: capture.sample
        ? 'Sample walk'
        : `Route scan · ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
      createdAt: new Date().toISOString(),
      source: capture.source,
      durationSeconds: capture.durationSeconds,
      storyHeight: DEFAULT_STORY_HEIGHT,
      points: simplifyScan(capture.points),
    };
    if (capture.video) setVideos((v) => ({ ...v, [scan.id]: capture.video! }));
    setReview({ scan, steps: capture.steps, isNew: true, sample: capture.sample });
  }

  function startPlacing(scan: RouteScan) {
    const box = contentBounds(graph, floor);
    setReview(null);
    setPlacing({
      ...scan,
      placement: scan.placement ?? {
        floor,
        origin: box ? { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 } : { x: 12, y: 8 },
        rotationDeg: (straightenRotation(scan.points, 0) + 360) % 360,
        scale: 1,
      },
    });
    if (scan.placement) setFloor(scan.placement.floor);
    if (view === '3d') setView('plan');
    setTab('scans');
    setSheetOpen(false); // phones: keep the plan visible to tap on
    showToast('Tap the plan where you started recording', 'info');
  }

  function savePlacement() {
    if (!placing) return;
    if (!upsertScan(placing)) return;
    setHiddenScans((h) => {
      const next = new Set(h);
      next.delete(placing.id);
      return next;
    });
    setPlacing(null);
    setSheetOpen(false);
    setView('3d');
    showToast(`${placing.name} placed — here it is in 3D`, 'go');
  }

  function deleteScan(id: string) {
    updateGraph({ ...graph, scans: scans.filter((x) => x.id !== id) });
    const v = videos[id];
    if (v) URL.revokeObjectURL(v.url);
  }

  const shownScans = (placing ? [...scans.filter((x) => x.id !== placing.id), placing] : scans).filter(
    (x) => x.placement && (!hiddenScans.has(x.id) || x.id === placing?.id)
  );
  const sortedFloors = [...graph.floors].sort((a, b) => a - b);
  const planScans = shownScans.flatMap((x) =>
    placedFloorPaths(x, graph.floors)
      .map((run, i) => ({ ...run, i }))
      .filter((run) => run.floor === floor)
      .map((run) => ({ id: `${x.id}-${run.i}`, points: run.points, active: x.id === placing?.id, start: run.i === 0 }))
  );
  const stackScans = shownScans.map((x) => {
    const base = Math.max(0, sortedFloors.indexOf(x.placement!.floor));
    return {
      id: x.id,
      active: x.id === placing?.id,
      points: x.points.map((p) => ({ ...placePoint(p, x.placement!), level: base + p.h / x.storyHeight })),
    };
  });

  // ---------- canvas picks ----------
  function handlePick(target: PickTarget, raw: Point) {
    if (placing?.placement) {
      setPlacing({ ...placing, placement: { ...placing.placement, origin: raw, floor } });
      return;
    }

    if (tool === 'route') {
      if (findRoomAtPoint(raw, floor, graph.rooms)) startRoute(raw, floor);
      else showToast('Tap inside a room to plan its way out', 'info');
      return;
    }

    if (tool === 'hazard') {
      if (target.kind === 'room') applyHazard('rooms', target.id, nameOf(target));
      else if (target.kind === 'door') applyHazard('doors', target.id, nameOf(target));
      else if (target.kind === 'connector') applyHazard('connectors', target.id, nameOf(target));
      return;
    }

    if (tool === 'select') {
      if (target.kind === 'empty') setSelected(null);
      else {
        setSelected(target);
        setTab('inspect');
        setSheetOpen(true);
      }
      return;
    }

    const point = snapPoint(graph, floor, raw);

    if (tool === 'room') {
      const first = draftPolygon[0];
      if (first && draftPolygon.length >= 3 && Math.hypot(first.x - point.x, first.y - point.y) < 0.4) {
        finishRoom();
        return;
      }
      setDraftPolygon((prev) => [...prev, point]);
      return;
    }

    if (tool === 'wall') {
      if (!draftWallStart) setDraftWallStart(point);
      else {
        const wall: WallSegment = { id: nextId('wall'), floor, start: draftWallStart, end: point };
        updateGraph({ ...graph, walls: [...graph.walls, wall] });
        setDraftWallStart(null);
      }
      return;
    }

    if (tool === 'door') {
      if (target.kind !== 'room') {
        setDraftDoor(null);
        return;
      }
      if (!draftDoor) {
        setDraftDoor({ roomId: target.id, point: raw });
        return;
      }
      if (draftDoor.roomId === target.id) return;
      const a = graph.rooms.find((r) => r.id === draftDoor.roomId);
      const b = graph.rooms.find((r) => r.id === target.id);
      if (!a || !b) return;
      const hint = { x: (draftDoor.point.x + raw.x) / 2, y: (draftDoor.point.y + raw.y) / 2 };
      const door: DoorOpening = {
        id: nextId('door'),
        floor,
        position: sharedBoundaryPoint(a.polygon, b.polygon, hint),
        roomA: a.id,
        roomB: b.id,
        widthMeters: 0.9,
      };
      updateGraph({ ...graph, doors: [...graph.doors, door] });
      setDraftDoor(null);
      showToast(`Door added: ${a.name || 'room'} ↔ ${b.name || 'room'}`, 'go');
      return;
    }

    if (tool === 'connector') {
      const existing =
        target.kind === 'connector'
          ? graph.connectors.find((c) => c.id === target.id)
          : graph.connectors.find((c) => Math.hypot(c.position.x - raw.x, c.position.y - raw.y) < CONNECTOR_HIT_RADIUS);
      if (existing) {
        const has = existing.floors.includes(floor);
        const floors = has
          ? existing.floors.filter((f) => f !== floor)
          : [...existing.floors, floor].sort((x, y) => x - y);
        if (floors.length === 0) return;
        updateGraph({ ...graph, connectors: graph.connectors.map((c) => (c.id === existing.id ? { ...c, floors } : c)) });
        showToast(`${existing.name || 'Stair'} ${has ? 'removed from' : 'now serves'} floor ${floor}`, 'info');
        return;
      }
      if (!findRoomAtPoint(point, floor, graph.rooms)) {
        showToast('Place stairs inside a room so routes can reach them', 'fire');
        return;
      }
      // A new stair links this floor with the one below it, if there is one.
      const sorted = [...graph.floors].sort((x, y) => x - y);
      const below = sorted[sorted.indexOf(floor) - 1];
      updateGraph({
        ...graph,
        connectors: [
          ...graph.connectors,
          {
            id: nextId('connector'),
            type: 'stair',
            position: point,
            floors: below === undefined ? [floor] : [below, floor],
            evacuationSafe: true,
          },
        ],
      });
    }
  }

  // ---------- keyboard ----------
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === 's') {
        e.preventDefault();
        if (!demo && dirty && !saving) save();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === 'Escape') {
        setPlacing(null);
        resetDrafts();
        setSelected(null);
        setPlaying(false);
        return;
      }
      if (e.key === 'Enter' && tool === 'room') {
        finishRoom();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === '1') return changeView('plan');
      if (e.key === '2') return changeView('flow');
      if (e.key === '3') return changeView('3d');
      const t = TOOLS.find((x) => x.key.toLowerCase() === key);
      if (t && toolsFor(view).includes(t)) changeTool(t.id);
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!dirty || demo) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, demo]);

  // ---------- "Walk it" playback ----------
  useEffect(() => {
    if (!playing || !shownGuide) return;
    const id = window.setTimeout(
      () => {
        const next = activeStep === null ? 0 : activeStep + 1;
        if (next >= shownGuide.maneuvers.length) {
          setPlaying(false);
          return;
        }
        const m = shownGuide.maneuvers[next];
        setActiveStep(next);
        setFloor(m.floor);
        if (view !== '3d') {
          const box = focusBox(m.points, 4);
          if (box) setCameraRequest({ box, key: Date.now() });
        }
      },
      activeStep === null ? 150 : 1800
    );
    return () => window.clearTimeout(id);
  }, [playing, activeStep, shownGuide, view]);

  async function save() {
    if (demo) return;
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
      showToast('Saved', 'go');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'fire');
    } finally {
      setSaving(false);
    }
  }

  // ---------- render ----------
  const activeTool = TOOLS.find((t) => t.id === tool)!;
  const hint = placing
    ? 'Tap where you started recording, then turn it to line up with the walls'
    : draftDoor
    ? 'Now click the room on the other side of the door'
    : tool === 'room' && draftPolygon.length > 0
      ? `${draftPolygon.length} corner${draftPolygon.length === 1 ? '' : 's'} · click the first corner or press Enter to close it`
      : tool === 'wall' && draftWallStart
        ? 'Click where the wall ends'
        : activeTool.hint;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'guide', label: 'Guide' },
    { id: 'inspect', label: 'Inspect' },
    { id: 'audit', label: 'Audit' },
    { id: 'scans', label: 'Scans' },
    ...(demo ? [] : [{ id: 'ask' as Tab, label: 'Ask AI' }]),
  ];

  return (
    <div className="deck">
      <header className="deck-top">
        <div className="deck-top-left">
          <Link href={demo ? '/' : '/dashboard'} className="icon-btn" aria-label={demo ? 'Home' : 'Back to dashboard'}>
            <Icon name="back" />
          </Link>
          <div className="deck-title">
            <span className="deck-eyebrow">{demo ? 'Live demo · nothing is saved' : 'Building'}</span>
            <h1>{initialName}</h1>
          </div>
        </div>
        <div className="deck-top-right">
          <button type="button" className="btn-ghost btn-sm scan-top" onClick={() => setScannerOpen(true)} title="AR Scan">
            <Icon name="camera" size={16} />
            <span className="hide-sm">AR Scan</span>
          </button>
          {nHazards > 0 && (
            <button type="button" className="scenario-chip" onClick={() => setHazards(NO_HAZARDS)} title="Clear all drill hazards">
              <Icon name="fire" size={15} />
              <span>
                Drill · {nHazards}
                <span className="hide-sm"> hazard{nHazards === 1 ? '' : 's'}</span>
              </span>
              <Icon name="close" size={14} />
            </button>
          )}
          <button type="button" className="icon-btn hide-sm" onClick={undo} disabled={history.past.length === 0} aria-label="Undo" title="Undo · Ctrl+Z">
            <Icon name="undo" />
          </button>
          <button type="button" className="icon-btn hide-sm" onClick={redo} disabled={history.future.length === 0} aria-label="Redo" title="Redo · Ctrl+Shift+Z">
            <Icon name="redo" />
          </button>
          {demo ? (
            <Link href="/signup" className="btn btn-primary btn-sm">
              Save yours<span className="hide-sm">&nbsp;— free</span>
            </Link>
          ) : (
            <button type="button" className="btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
              {saving ? <span className="spinner" /> : <Icon name="check" size={15} />}
              {dirty ? 'Save' : 'Saved'}
            </button>
          )}
        </div>
      </header>

      <div className="deck-body">
        <ToolRail
          tool={tool}
          view={view}
          onChange={changeTool}
          onDetect={demo ? undefined : () => setShowAiDetect(true)}
          onScan={() => setScannerOpen(true)}
          draftCount={draftPolygon.length}
          onFinishRoom={finishRoom}
          onCancelDraft={() => setDraftPolygon([])}
        />

        <main className={`deck-stage view-${view}`}>
          {view === '3d' ? (
            <StackView
              graph={graph}
              hazards={hazards}
              etas={etas}
              limitSeconds={limitSeconds}
              route={shownRoute}
              focusFloor={floor}
              overlays={stackScans}
              onPickRoom={(roomId, point, f) => {
                if (tool === 'hazard') applyHazard('rooms', roomId, graph.rooms.find((r) => r.id === roomId)?.name || 'Room');
                else {
                  setFloor(f);
                  startRoute(point, f);
                }
              }}
            />
          ) : (
            <PlanView
              graph={graph}
              floor={floor}
              mode={view === 'flow' ? 'flow' : 'plan'}
              tool={tool}
              hazards={hazards}
              flow={flow}
              etas={etas}
              smokyRooms={field.smokyRooms}
              limitSeconds={limitSeconds}
              route={shownRoute}
              alternate={usingAlt ? null : (plan?.alternate ?? null)}
              focusLeg={focusLeg}
              selected={selected}
              draftPolygon={draftPolygon}
              draftWallStart={draftWallStart}
              draftDoorRoomA={draftDoor?.roomId ?? null}
              cameraRequest={cameraRequest}
              onPick={handlePick}
              onFloorJump={setFloor}
              scanPaths={planScans}
            />
          )}

          <div className="stage-top">
            <ViewSwitch value={view} onChange={changeView} />
            <div className="stage-hint" key={hint}>
              {hint}
            </div>
          </div>

          <FloorRail
            floors={graph.floors}
            current={floor}
            onSelect={setFloor}
            onAdd={view === 'plan' ? addFloor : undefined}
            routeFloors={routeFloors}
            startFloor={routeStart?.floor ?? null}
            hazardFloors={hazardFloors}
          />

          {view === 'flow' && !placing && <FlowLegend limitSeconds={limitSeconds} />}

          {placing && view !== '3d' && (
            <PlacementBar scan={placing} onChange={setPlacing} onSave={savePlacement} onCancel={() => setPlacing(null)} />
          )}

          {toast && (
            <div className={`toast ${toast.tone}${placing ? ' raised' : ''}`} key={toast.key} role="status">
              <Icon name={toast.tone === 'fire' ? 'fire' : toast.tone === 'go' ? 'route' : 'sparkle'} size={16} />
              {toast.text}
            </div>
          )}
        </main>

        <aside className={`deck-panel${sheetOpen ? ' open' : ''}`}>
          <button type="button" className="sheet-handle" onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}>
            <span className="sheet-grip" aria-hidden="true" />
            <span className="sheet-summary">
              {shownGuide ? (
                <>
                  <span className="mono sheet-eta">{formatDuration(shownGuide.seconds)}</span>
                  <span>to {shownGuide.exitName}</span>
                </>
              ) : (
                <span>{tabs.find((t) => t.id === tab)?.label}</span>
              )}
            </span>
            <Icon name={sheetOpen ? 'chevronDown' : 'chevronUp'} size={18} />
          </button>
          <div className="panel-tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'active' : ''}
                onClick={() => {
                  setTab(t.id);
                  setSheetOpen(true);
                }}
              >
                {t.label}
                {t.id === 'audit' && trappedRooms && <span className="tab-dot" aria-label="Rooms with no way out" />}
              </button>
            ))}
          </div>
          <div className="panel-body">
            {tab === 'guide' && (
              <RouteGuide
                guide={guide}
                alternate={altGuide}
                showAlternate={usingAlt}
                onToggleAlternate={() => {
                  setShowAlt((s) => !s);
                  setActiveStep(null);
                  setPlaying(false);
                }}
                activeIndex={activeStep}
                onFocus={focusManeuver}
                playing={playing}
                onTogglePlay={() => {
                  if (playing) setPlaying(false);
                  else {
                    setActiveStep(null);
                    setPlaying(true);
                  }
                }}
                onClear={clearRoute}
                hazardCount={nHazards}
                rerouted={toast?.tone === 'go'}
              />
            )}
            {tab === 'inspect' && (
              <PropertiesPanel
                graph={graph}
                selected={selected}
                onChange={updateGraph}
                onClose={() => setSelected(null)}
                autoFocusName={selected?.kind === 'room' && selected.id === namingRoom}
                onNamed={() => setNamingRoom(null)}
              />
            )}
            {tab === 'audit' && audit && (
              <EgressAudit
                audit={audit}
                limitMeters={limitMeters}
                onLimitChange={setLimitMeters}
                onFocusRoom={focusRoom}
                hazardCount={nHazards}
              />
            )}
            {tab === 'scans' &&
              (placing ? (
                <PlacementPanel
                  scan={placing}
                  floors={graph.floors}
                  onChange={setPlacing}
                  onFloor={setFloor}
                  onSave={savePlacement}
                  onCancel={() => setPlacing(null)}
                />
              ) : (
                <ScanList
                  scans={scans}
                  hidden={hiddenScans}
                  onNew={() => setScannerOpen(true)}
                  onOpen={(scan) => setReview({ scan, isNew: false })}
                  onPlace={startPlacing}
                  onToggle={(scan) =>
                    setHiddenScans((h) => {
                      const next = new Set(h);
                      if (next.has(scan.id)) next.delete(scan.id);
                      else next.add(scan.id);
                      return next;
                    })
                  }
                />
              ))}
            {tab === 'ask' && !demo && (
              <ChatPanel
                buildingId={buildingId}
                dirty={dirty}
                onRoute={(route) => {
                  const start = route.steps[0];
                  setFloor(start.floor);
                  startRoute(start.position, start.floor);
                }}
              />
            )}
          </div>
        </aside>
      </div>

      {scannerOpen && <ArScanner onClose={() => setScannerOpen(false)} onComplete={onCaptured} />}

      {review && (
        <ScanReview
          key={review.scan.id}
          scan={review.scan}
          steps={review.steps}
          video={videos[review.scan.id]}
          isNew={review.isNew}
          sample={review.sample}
          canPlace={graph.rooms.length > 0}
          onPlace={startPlacing}
          onSave={(scan) => {
            if (upsertScan(scan)) {
              setReview(null);
              setTab('scans');
              setSheetOpen(true);
            }
          }}
          onDiscard={() => {
            if (!review.isNew) deleteScan(review.scan.id);
            else {
              const v = videos[review.scan.id];
              if (v) URL.revokeObjectURL(v.url);
            }
            setReview(null);
          }}
          onClose={(scan) => {
            // Closing a fresh scan keeps it rather than throwing a walk away.
            if (review.isNew && upsertScan(scan)) {
              setTab('scans');
              showToast('Scan kept under Scans', 'info');
            }
            setReview(null);
          }}
        />
      )}

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

function FlowLegend({ limitSeconds }: { limitSeconds: number }) {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((f) => heatColor(f)).join(', ');
  return (
    <div className="flow-legend" aria-label="Legend">
      <div className="legend-title">Time to safety</div>
      <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${stops})` }} />
      <div className="legend-scale mono">
        <span>0:00</span>
        <span>{formatDuration(limitSeconds / 2)}</span>
        <span>{formatDuration(limitSeconds)}+</span>
      </div>
      <div className="legend-keys">
        <span>
          <i className="sw fire" /> Fire
        </span>
        <span>
          <i className="sw smoke" /> Smoke
        </span>
        <span>
          <i className="sw trapped" /> No way out
        </span>
      </div>
    </div>
  );
}
