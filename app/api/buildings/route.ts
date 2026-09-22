import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireUserId } from '@/lib/supabase-server';
import type { BuildingGraph } from '@/lib/evacuation-types';

const createBuildingSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET() {
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data, error } = await auth.supabase
    .from('buildings')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    data.map((row) => ({ id: row.id, name: row.name, updatedAt: row.updated_at }))
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = createBuildingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const clientBuildingId = randomUUID();
  const graph: BuildingGraph = {
    buildingId: clientBuildingId,
    floors: [1],
    walls: [],
    doors: [],
    rooms: [],
    connectors: [],
  };

  const { data, error } = await auth.supabase
    .from('buildings')
    .insert({
      owner_id: auth.userId,
      client_building_id: clientBuildingId,
      name: parsed.data.name,
      graph_data: graph,
    })
    .select('id, name, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id, name: data.name, updatedAt: data.updated_at }, { status: 201 });
}
