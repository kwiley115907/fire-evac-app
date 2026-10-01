import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/supabase-server';
import { parseAdminOverview } from '@/lib/admin';

// Every account and building. admin_overview() checks is_app_admin() itself
// and raises 42501 for anyone else, so this route adds no trust of its own.
export async function GET() {
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data, error } = await auth.supabase.rpc('admin_overview');
  if (error) {
    const status = error.code === '42501' ? 403 : 500;
    return NextResponse.json({ error: status === 403 ? 'Admins only' : error.message }, { status });
  }

  return NextResponse.json(parseAdminOverview(data));
}
