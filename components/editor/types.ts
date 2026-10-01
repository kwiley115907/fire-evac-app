import type { BBox } from '@/lib/editor-utils';

export type Tool = 'select' | 'room' | 'wall' | 'door' | 'connector' | 'hazard' | 'route';

export type ViewMode = 'plan' | 'flow' | '3d';

export type Selected =
  | { kind: 'room'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'door'; id: string }
  | { kind: 'connector'; id: string }
  | null;

export type PickTarget = Exclude<Selected, null> | { kind: 'empty' };

// Ask the canvas to fly its camera somewhere. `key` changes on every
// request so asking for the same box twice still moves the camera.
export interface CameraRequest {
  box: BBox;
  key: number;
}
