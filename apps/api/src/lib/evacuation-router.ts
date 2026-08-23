import { BuildingGraph, EvacuationRoute, Point, RouteStep } from './evacuation-types';
import { distance, findRoomAtPoint, polygonCentroid } from './evacuation-geometry';

const FLIGHT_COST_PER_FLOOR = 5;

interface GraphNode {
  id: string;
  floor: number;
  position: Point;
  type: 'room' | 'connector';
}

interface GraphEdge {
  to: string;
  weight: number;
  via: RouteStep;
}

function buildAdjacency(graph: BuildingGraph) {
  const nodes = new Map<string, GraphNode>();
  const adjacency = new Map<string, GraphEdge[]>();

  const addNode = (node: GraphNode) => {
    nodes.set(node.id, node);
    if (!adjacency.has(node.id)) adjacency.set(node.id, []);
  };

  const addEdge = (fromId: string, toId: string, weight: number, via: RouteStep) => {
    if (!adjacency.has(fromId)) adjacency.set(fromId, []);
    adjacency.get(fromId)!.push({ to: toId, weight, via });
  };

  for (const room of graph.rooms) {
    addNode({ id: room.id, floor: room.floor, position: polygonCentroid(room.polygon), type: 'room' });
  }

  for (const door of graph.doors) {
    const roomA = nodes.get(door.roomA);
    const roomB = nodes.get(door.roomB);
    if (!roomA || !roomB) continue;

    const weight = distance(roomA.position, door.position) + distance(door.position, roomB.position);
    const stepThroughDoor: RouteStep = { type: 'door', id: door.id, floor: door.floor, position: door.position };

    addEdge(roomA.id, roomB.id, weight, stepThroughDoor);
    addEdge(roomB.id, roomA.id, weight, stepThroughDoor);
  }

  for (const connector of graph.connectors) {
    if (!connector.evacuationSafe) continue;

    const sortedFloors = [...connector.floors].sort((a, b) => a - b);
    const floorNodeIds: string[] = [];

    for (const floor of sortedFloors) {
      const nodeId = `${connector.id}::floor${floor}`;
      addNode({ id: nodeId, floor, position: connector.position, type: 'connector' });
      floorNodeIds.push(nodeId);

      const room = findRoomAtPoint(connector.position, floor, graph.rooms);
      if (!room) continue;

      const roomCentroid = polygonCentroid(room.polygon);
      const weight = distance(roomCentroid, connector.position);

      addEdge(room.id, nodeId, weight, { type: 'connector', id: connector.id, floor, position: connector.position });
      addEdge(nodeId, room.id, weight, { type: 'room', id: room.id, floor, position: roomCentroid });
    }

    for (let i = 0; i < floorNodeIds.length - 1; i++) {
      const a = floorNodeIds[i];
      const b = floorNodeIds[i + 1];
      const floorGap = Math.abs(nodes.get(b)!.floor - nodes.get(a)!.floor);
      const weight = FLIGHT_COST_PER_FLOOR * floorGap;

      addEdge(a, b, weight, { type: 'connector', id: connector.id, floor: nodes.get(b)!.floor, position: connector.position });
      addEdge(b, a, weight, { type: 'connector', id: connector.id, floor: nodes.get(a)!.floor, position: connector.position });
    }
  }

  return { nodes, adjacency };
}

export function findNearestExit(graph: BuildingGraph, startPoint: Point, startFloor: number): EvacuationRoute | null {
  const startRoom = findRoomAtPoint(startPoint, startFloor, graph.rooms);
  if (!startRoom) return null;

  const { nodes, adjacency } = buildAdjacency(graph);
  const exitRoomIds = new Set(graph.rooms.filter((r) => r.isExit).map((r) => r.id));
  if (exitRoomIds.size === 0) return null;

  const dist = new Map<string, number>();
  const prevStep = new Map<string, { from: string; step: RouteStep }>();
  const visited = new Set<string>();

  for (const id of nodes.keys()) dist.set(id, Infinity);
  dist.set(startRoom.id, 0);

  const queue = new Set(nodes.keys());

  while (queue.size > 0) {
    let currentId: string | null = null;
    let currentDist = Infinity;
    for (const id of queue) {
      const d = dist.get(id)!;
      if (d < currentDist) {
        currentDist = d;
        currentId = id;
      }
    }
    if (currentId === null) break;

    queue.delete(currentId);
    visited.add(currentId);

    if (exitRoomIds.has(currentId)) {
      const steps: RouteStep[] = [];
      let cursor: string | null = currentId;
      while (cursor && prevStep.has(cursor)) {
        const { from, step } = prevStep.get(cursor)!;
        steps.unshift(step);
        cursor = from;
      }
      steps.unshift({ type: 'room', id: startRoom.id, floor: startFloor, position: startPoint });

      return { steps, totalDistanceMeters: dist.get(currentId)!, reachedExitId: currentId };
    }

    for (const edge of adjacency.get(currentId) ?? []) {
      if (visited.has(edge.to)) continue;
      const newDist = currentDist + edge.weight;
      if (newDist < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, newDist);
        prevStep.set(edge.to, { from: currentId, step: edge.via });
      }
    }
  }

  return null;
}
