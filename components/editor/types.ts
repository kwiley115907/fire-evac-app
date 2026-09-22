import type { EvacuationRoute } from '@/lib/evacuation-types';

export type Tool = 'select' | 'room' | 'wall' | 'door' | 'connector' | 'route';

export type Selected =
  | { kind: 'room'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'door'; id: string }
  | { kind: 'connector'; id: string }
  | null;

export interface RoutePreview {
  route: EvacuationRoute;
  floor: number;
}
