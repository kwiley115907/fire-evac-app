import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/supabase-server';
import { buildingGraphSchema } from '@/lib/validation';

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  graph: buildingGraphSchema,
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data, error } = await auth.supabase
    .from('buildings')
    .select('id, name, graph_data, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Building not found' }, { status: 404 });

  return NextResponse.json({ id: data.id, name: data.name, graph: data.graph_data, updatedAt: data.updated_at });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = { graph_data: parsed.data.graph };
  if (parsed.data.name) update.name = parsed.data.name;

  const { data, error } = await auth.supabase
    .from('buildings')
    .update(update)
    .eq('id', id)
    .select('id, name, updated_at')
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Building not found' }, { status: 404 });

  return NextResponse.json({ id: data.id, name: data.name, updatedAt: data.updated_at });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // RLS turns a delete the caller isn't allowed into zero rows, not an
  // error, so check something was actually removed.
  const { data, error } = await auth.supabase.from('buildings').delete().eq('id', id).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'Building not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
