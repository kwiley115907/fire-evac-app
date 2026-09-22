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
