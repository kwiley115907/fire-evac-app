import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/supabase-server';
import { findNearestExit } from '@/lib/evacuation-router';
import type { BuildingGraph } from '@/lib/evacuation-types';

const requestSchema = z.object({
  buildingId: z.string().min(1),
  point: z.object({ x: z.number().finite(), y: z.number().finite() }),
  floor: z.number().int(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const { buildingId, point, floor } = parsed.data;

  const { data, error } = await auth.supabase
    .from('buildings')
    .select('graph_data')
    .eq('id', buildingId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Building not found' }, { status: 404 });

  const graph = data.graph_data as BuildingGraph;
  const result = findNearestExit(graph, point, floor);

  if (!result) {
    return NextResponse.json({ error: 'No route found from that point to any exit' }, { status: 422 });
  }

  return NextResponse.json(result);
}
