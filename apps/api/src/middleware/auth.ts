import type { NextFunction, Request, Response } from 'express';
import { supabaseAuth, createUserClient } from '../supabase';

// Verifies the caller's Supabase access token and attaches a request-scoped
// Supabase client (req.supabase) that respects RLS as that user. Rejects
// with 401 rather than falling back to an unauthenticated/admin client.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = data.user.id;
  req.supabase = createUserClient(token);
  next();
}
