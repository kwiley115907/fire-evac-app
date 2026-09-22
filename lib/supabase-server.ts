import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Request-scoped client built from the caller's own session cookies.
// Postgres RLS (supabase/schema.sql) keys off auth.uid(), so every query
// made through this client is automatically restricted to that user's own
// rows — this is the real tenant-isolation boundary, not app-level filtering.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component that can't set cookies (e.g. a
          // page render); a middleware/route handler will refresh instead.
        }
      },
    },
  });
}

// Verifies the caller has a valid session and returns their user id, or
// null. Route handlers should reject with 401 rather than falling back to
// an unauthenticated/admin client.
export async function requireUserId(): Promise<{ userId: string; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, supabase };
}
