import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/supabase-server';
import { callClaude, extractJson } from '@/lib/anthropic';

const requestSchema = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  floor: z.number().int(),
});

interface DraftPoint {
  x: number;
  y: number;
}

interface DetectedGraph {
  rooms: { id: string; name: string; polygon: DraftPoint[]; isExit: boolean }[];
  walls: { id: string; start: DraftPoint; end: DraftPoint }[];
  doors: { id: string; position: DraftPoint; roomA: string; roomB: string }[];
}

const SYSTEM_PROMPT = `You analyze uploaded floor plan images for a fire evacuation planning tool and extract an approximate room/wall/door layout as strict JSON.

Rules:
- Output ONLY a single JSON object, no prose, no markdown fences.
- Coordinates are in meters on an arbitrary but internally consistent grid, origin near the top-left of the plan, x increasing right, y increasing down. Estimate real-world scale from typical door widths (~0.9m) and room proportions.
- Shape: {"rooms":[{"id":string,"name":string,"polygon":[{"x":number,"y":number}, ...at least 3 points, clockwise or counter-clockwise, no self-intersections],"isExit":boolean}],"walls":[{"id":string,"start":{"x":number,"y":number},"end":{"x":number,"y":number}}],"doors":[{"id":string,"position":{"x":number,"y":number},"roomA":string,"roomB":string}]}
- Mark a room isExit:true only if it is clearly an exterior door, exit stairwell, or the outside/egress area.
- Every door's roomA/roomB must reference room ids you included in "rooms".
- Use short kebab-case ids (e.g. "room-1", "door-1").
- If you cannot confidently identify any rooms, return {"rooms":[],"walls":[],"doors":[]}.`;

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if (!auth) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const { imageBase64, mediaType, floor } = parsed.data;

  try {
    const text = await callClaude({
      system: SYSTEM_PROMPT,
      maxTokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: `This is floor ${floor} of a building. Extract the room/wall/door layout as instructed.` },
          ],
        },
      ],
    });

    const detected = extractJson<DetectedGraph>(text);

    const roomIds = new Set(detected.rooms.map((r) => r.id));
    const validDoors = detected.doors.filter((d) => roomIds.has(d.roomA) && roomIds.has(d.roomB));

    return NextResponse.json({
      rooms: detected.rooms.filter((r) => Array.isArray(r.polygon) && r.polygon.length >= 3),
      walls: detected.walls ?? [],
      doors: validDoors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI detection failed' },
      { status: 502 }
    );
  }
}
