// A three-storey office used by the landing-page demo and /demo. Plain
// metres, 40 x 24 m footprint, two stairs plus an elevator that is
// (correctly) not evacuation-safe.

import type { BuildingGraph, DoorOpening, Point, Room } from './evacuation-types';

function rect(x0: number, y0: number, x1: number, y1: number): Point[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function room(id: string, floor: number, name: string, poly: Point[], isExit = false): Room {
  return { id, floor, name, polygon: poly, isExit };
}

function door(id: string, floor: number, x: number, y: number, roomA: string, roomB: string, widthMeters = 0.9): DoorOpening {
  return { id, floor, position: { x, y }, roomA, roomB, widthMeters };
}

// Floors 2 and 3 share a structural grid; only the tenants change.
function upperFloor(floor: number, names: [string, string, string, string, string, string, string]): { rooms: Room[]; doors: DoorOpening[] } {
  const [west, mid, east, sw, south, se, corridor] = names;
  const f = `f${floor}`;
  const rooms = [
    room(`${f}-west`, floor, west, rect(0, 0, 20, 10)),
    room(`${f}-mid`, floor, mid, rect(20, 0, 28, 10)),
    room(`${f}-east`, floor, east, rect(28, 0, 40, 10)),
    room(`${f}-corridor`, floor, corridor, rect(0, 10, 40, 14)),
    room(`${f}-sw`, floor, sw, rect(0, 14, 14, 24)),
    room(`${f}-south`, floor, south, rect(14, 14, 26, 24)),
    room(`${f}-se`, floor, se, rect(26, 14, 36, 24)),
    room(`${f}-stair-east`, floor, 'East Stairwell', rect(36, 14, 40, 24)),
  ];
  const doors = [
    door(`${f}-d-west`, floor, 10, 10, `${f}-west`, `${f}-corridor`, 1.8),
    door(`${f}-d-mid`, floor, 24, 10, `${f}-mid`, `${f}-corridor`),
    door(`${f}-d-east`, floor, 34, 10, `${f}-east`, `${f}-corridor`),
    door(`${f}-d-west-mid`, floor, 20, 5, `${f}-west`, `${f}-mid`),
    door(`${f}-d-sw`, floor, 7, 14, `${f}-sw`, `${f}-corridor`),
    door(`${f}-d-south`, floor, 20, 14, `${f}-south`, `${f}-corridor`),
    door(`${f}-d-se`, floor, 31, 14, `${f}-se`, `${f}-corridor`),
    door(`${f}-d-stair`, floor, 38, 14, `${f}-stair-east`, `${f}-corridor`, 1.1),
  ];
  return { rooms, doors };
}

export function sampleBuilding(): BuildingGraph {
  const ground: Room[] = [
    room('f1-lobby', 1, 'Lobby', rect(0, 0, 12, 10)),
    room('f1-101', 1, 'Office 101', rect(12, 0, 20, 10)),
    room('f1-102', 1, 'Office 102', rect(20, 0, 28, 10)),
    room('f1-conf', 1, 'Conference A', rect(28, 0, 40, 10)),
    room('f1-corridor', 1, 'Main Corridor', rect(0, 10, 40, 14)),
    room('f1-break', 1, 'Break Room', rect(0, 14, 10, 24)),
    room('f1-server', 1, 'Server Room', rect(10, 14, 18, 24)),
    room('f1-storage', 1, 'Storage', rect(18, 14, 26, 24)),
    room('f1-workshop', 1, 'Workshop', rect(26, 14, 36, 24)),
    room('f1-stair-east', 1, 'East Stairwell', rect(36, 14, 40, 24)),
    room('exit-front', 1, 'Front Exit', rect(4, -3, 8, 0), true),
    room('exit-east', 1, 'East Exit', rect(40, 10, 43, 14), true),
    room('exit-rear', 1, 'Rear Exit', rect(2, 24, 6, 27), true),
  ];
  const groundDoors: DoorOpening[] = [
    door('f1-d-front', 1, 6, 0, 'f1-lobby', 'exit-front', 1.8),
    door('f1-d-lobby', 1, 6, 10, 'f1-lobby', 'f1-corridor', 1.8),
    door('f1-d-101', 1, 16, 10, 'f1-101', 'f1-corridor'),
    door('f1-d-102', 1, 24, 10, 'f1-102', 'f1-corridor'),
    door('f1-d-101-102', 1, 20, 5, 'f1-101', 'f1-102'),
    door('f1-d-conf', 1, 34, 10, 'f1-conf', 'f1-corridor'),
    door('f1-d-east', 1, 40, 12, 'f1-corridor', 'exit-east', 1.8),
    door('f1-d-break', 1, 5, 14, 'f1-break', 'f1-corridor'),
    door('f1-d-server', 1, 14, 14, 'f1-server', 'f1-corridor'),
    door('f1-d-server-storage', 1, 18, 19, 'f1-server', 'f1-storage'),
    door('f1-d-storage', 1, 22, 14, 'f1-storage', 'f1-corridor'),
    door('f1-d-workshop', 1, 31, 14, 'f1-workshop', 'f1-corridor'),
    door('f1-d-stair', 1, 38, 14, 'f1-stair-east', 'f1-corridor', 1.1),
    door('f1-d-rear', 1, 4, 24, 'f1-break', 'exit-rear'),
  ];

  const second = upperFloor(2, ['Open Office', 'Meeting 201', 'Exec Suite', 'Lab', 'Training Room', 'Copy Room', 'Corridor 2']);
  const third = upperFloor(3, ['Design Studio', 'Library', 'Board Room', 'Wellness', 'Kitchen', 'Archive', 'Corridor 3']);

  return {
    buildingId: 'sample-office',
    floors: [1, 2, 3],
    walls: [],
    rooms: [...ground, ...second.rooms, ...third.rooms],
    doors: [...groundDoors, ...second.doors, ...third.doors],
    connectors: [
      { id: 'stair-west', type: 'stair', name: 'West Stair', position: { x: 3, y: 3 }, floors: [1, 2, 3], evacuationSafe: true },
      { id: 'stair-east', type: 'stair', name: 'East Stair', position: { x: 38, y: 19 }, floors: [1, 2, 3], evacuationSafe: true },
      { id: 'elevator', type: 'elevator', name: 'Elevator', position: { x: 8, y: 12 }, floors: [1, 2, 3], evacuationSafe: false },
    ],
  };
}
