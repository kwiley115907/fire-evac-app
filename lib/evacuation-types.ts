// Shared schema for evacuation routing. Any future ingestion adapter
// (vector-PDF parser, raster/AI wall detector) should output this shape.

export interface Point {
  x: number;
  y: number;
}

export interface WallSegment {
  id: string;
  floor: number;
  start: Point;
  end: Point;
}

export interface DoorOpening {
  id: string;
  floor: number;
  position: Point;
  roomA: string;
  roomB: string;
  widthMeters: number;
}

export interface Room {
  id: string;
  floor: number;
  polygon: Point[];
  isExit: boolean;
  // Human-readable label ("Kitchen", "Server Room"). Optional so the
  // routing engine and its tests keep working on bare geometry; the editor
  // UI and AI chat resolution rely on it when present.
  name?: string;
}

export type ConnectorType = 'stair' | 'elevator';

export interface VerticalConnector {
  id: string;
  type: ConnectorType;
  position: Point;
  floors: number[];
  evacuationSafe: boolean;
  name?: string;
}

export interface BuildingGraph {
  buildingId: string;
  floors: number[];
  walls: WallSegment[];
  doors: DoorOpening[];
  rooms: Room[];
  connectors: VerticalConnector[];
  // Routes walked and recorded with AR Scan. Display-only: the routing
  // engine never reads them.
  scans?: RouteScan[];
}

// A recorded point in scan space, metres from where recording started:
// x to the right, y forward (the way the camera first faced), h up.
// t is seconds since recording started.
export interface ScanPoint {
  x: number;
  y: number;
  h: number;
  t: number;
}

// Where a scan sits on the plan: its start point, how far it's turned
// (clockwise, degrees), a stretch factor for step-length error, and the
// floor it started on.
export interface ScanPlacement {
  floor: number;
  origin: Point;
  rotationDeg: number;
  scale: number;
}

export interface RouteScan {
  id: string;
  name: string;
  createdAt: string;
  // 'ar' = device pose from WebXR (ARCore); 'motion' = camera + step
  // counting and gyroscope heading.
  source: 'ar' | 'motion';
  durationSeconds: number;
  storyHeight: number;
  points: ScanPoint[];
  placement?: ScanPlacement;
}

export interface RouteStep {
  type: 'room' | 'door' | 'connector';
  id: string;
  floor: number;
  position: Point;
}

export interface EvacuationRoute {
  steps: RouteStep[];
  totalDistanceMeters: number;
  reachedExitId: string;
}
