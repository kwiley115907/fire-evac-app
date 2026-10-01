import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/supabase-server';

const setAdminSchema = z.object({
  userId: z.string().uuid(),
  makeAdmin: z.boolean(),
});

// Grant or remove admin. admin_set_admin() enforces that the caller is an
// admin and refuses to let them remove themselves.
export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = setAdminSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const { error } = await auth.supabase.rpc('admin_set_admin', {
    target: parsed.data.userId,
    make_admin: parsed.data.makeAdmin,
  });
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
