import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/supabase-server';
import { callClaude, extractJson } from '@/lib/anthropic';
import { findNearestExit } from '@/lib/evacuation-router';
import { polygonCentroid } from '@/lib/evacuation-geometry';
import type { BuildingGraph } from '@/lib/evacuation-types';

const requestSchema = z.object({
  buildingId: z.string().min(1),
  message: z.string().min(1).max(500),
});

const SYSTEM_PROMPT = `You help a user locate a starting room in a building from a natural-language message, for a fire evacuation planner. You are given a JSON list of rooms (id, name, floor) and the user's message. Reply with ONLY a JSON object: {"roomId": string | null, "reason": string}. Pick the single best-matching room id, or null if nothing plausibly matches. Never invent a room id that isn't in the list.`;

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const { buildingId, message } = parsed.data;

  const { data, error } = await auth.supabase
    .from('buildings')
    .select('graph_data')
    .eq('id', buildingId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Building not found' }, { status: 404 });

  const graph = data.graph_data as BuildingGraph;

  if (graph.rooms.length === 0) {
    return NextResponse.json({ reply: 'This building has no rooms drawn yet — add some in the editor first.' });
  }

  const roomList = graph.rooms.map((r) => ({ id: r.id, name: r.name ?? r.id, floor: r.floor, isExit: r.isExit }));

  try {
    const text = await callClaude({
      system: SYSTEM_PROMPT,
      // Leaves room for thinking ahead of the short reply.
      maxTokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Rooms: ${JSON.stringify(roomList)}\n\nUser message: ${message}` },
          ],
        },
      ],
    });

    const picked = extractJson<{ roomId: string | null; reason: string }>(text);
    const room = graph.rooms.find((r) => r.id === picked.roomId);

    if (!room) {
      return NextResponse.json({
        reply: "I couldn't confidently match that to a room on this building's plan. Try naming a room label directly, e.g. \"nearest exit from the kitchen\".",
        matchedRoomId: null,
      });
    }

    const startPoint = polygonCentroid(room.polygon);
    const route = findNearestExit(graph, startPoint, room.floor);

    if (!route) {
      return NextResponse.json({
        reply: `I found "${room.name ?? room.id}", but no evacuation-safe route to an exit exists from there yet — check that exits and stairs are marked and connected.`,
        matchedRoomId: room.id,
      });
    }

    const doorSteps = route.steps.filter((s) => s.type === 'door').length;
    const connectorSteps = route.steps.filter((s) => s.type === 'connector').length;
    const parts = [`From ${room.name ?? room.id}, head to ${route.reachedExitId}`];
    if (connectorSteps > 0) parts.push(`via ${connectorSteps} stairwell${connectorSteps > 1 ? 's' : ''}`);
    if (doorSteps > 0) parts.push(`through ${doorSteps} door${doorSteps > 1 ? 's' : ''}`);
    parts.push(`(~${route.totalDistanceMeters.toFixed(1)}m).`);

    return NextResponse.json({
      reply: parts.join(' '),
      matchedRoomId: room.id,
      route,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI chat failed' },
      { status: 502 }
    );
  }
}
