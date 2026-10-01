import { z } from 'zod';

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const wallSegmentSchema = z.object({
  id: z.string().min(1),
  floor: z.number().int(),
  start: pointSchema,
  end: pointSchema,
});

const doorOpeningSchema = z.object({
  id: z.string().min(1),
  floor: z.number().int(),
  position: pointSchema,
  roomA: z.string().min(1),
  roomB: z.string().min(1),
  widthMeters: z.number().positive(),
});

const roomSchema = z.object({
  id: z.string().min(1),
  floor: z.number().int(),
  polygon: z.array(pointSchema).min(3),
  isExit: z.boolean(),
  name: z.string().max(120).optional(),
});

const verticalConnectorSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['stair', 'elevator']),
  position: pointSchema,
  floors: z.array(z.number().int()).min(1),
  evacuationSafe: z.boolean(),
  name: z.string().max(120).optional(),
});

const scanPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  h: z.number().finite(),
  t: z.number().finite().min(0),
});

const routeScanSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().max(80),
  createdAt: z.string().max(40),
  source: z.enum(['ar', 'motion']),
  durationSeconds: z.number().finite().min(0),
  storyHeight: z.number().finite().positive().max(20),
  points: z.array(scanPointSchema).min(1).max(2000),
  placement: z
    .object({
      floor: z.number().int(),
      origin: pointSchema,
      rotationDeg: z.number().finite(),
      scale: z.number().finite().positive().max(10),
    })
    .optional(),
});

export const buildingGraphSchema = z.object({
  buildingId: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9_-]+$/, 'buildingId may only contain letters, numbers, - and _'),
  floors: z.array(z.number().int()),
  walls: z.array(wallSegmentSchema),
  doors: z.array(doorOpeningSchema),
  rooms: z.array(roomSchema),
  connectors: z.array(verticalConnectorSchema),
  scans: z.array(routeScanSchema).max(30).optional(),
});

export const routeRequestSchema = z.object({
  buildingId: z.string().min(1).max(200),
  point: pointSchema,
  floor: z.number().int(),
});
