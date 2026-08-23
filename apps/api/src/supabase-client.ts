import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

// Service-role client — backend only, never ship this key to the frontend.
// It bypasses Row Level Security, which is fine for now since every write
// goes through this API rather than directly from the browser.
export const supabase = createClient(supabaseUrl, serviceRoleKey);
