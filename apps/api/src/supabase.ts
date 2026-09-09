import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Base client for auth-only calls (verifying a caller's access token).
// Never used to read/write app tables directly — see createUserClient.
export const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Per-request client scoped to the caller's own access token. Postgres RLS
// policies (supabase/schema.sql) key off auth.uid(), so every query made
// through this client is automatically restricted to that user's own rows —
// this is the real tenant-isolation boundary, not just app-level filtering.
export function createUserClient(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
