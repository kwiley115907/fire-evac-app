import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../env';

// Express 5 forwards both thrown errors and rejected promises from route
// handlers here, so this is the single place unexpected failures surface —
// no route handler needs its own try/catch to avoid crashing the process.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Invalid request body', details: err.issues });
  }

  console.error('Unhandled error:', err);

  const message = env.NODE_ENV === 'production' ? 'Internal server error' : String(err);
  res.status(500).json({ error: message });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}
