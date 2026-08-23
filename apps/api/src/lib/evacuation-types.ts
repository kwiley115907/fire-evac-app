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
}

export type ConnectorType = 'stair' | 'elevator';

export interface VerticalConnector {
  id: string;
  type: ConnectorType;
  position: Point;
  floors: number[];
  evacuationSafe: boolean;
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
