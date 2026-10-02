'use client';

import { useState } from 'react';
import Link from 'next/link';
import { nextId } from '@/lib/editor-utils';
import type { DoorOpening, Room, WallSegment } from '@/lib/evacuation-types';

interface DetectedRoom {
  id: string;
  name: string;
  polygon: { x: number; y: number }[];
  isExit: boolean;
}
interface DetectedWall {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}
interface DetectedDoor {
  id: string;
  position: { x: number; y: number };
  roomA: string;
  roomB: string;
}

// A real single-storey site plan (two wings of numbered units around a pool
// and office), bundled so anyone can see detection work without a file.
const SAMPLE_PLAN = '/samples/sample-floor-plan.png';

export function AiDetectModal({
  floor,
  demo = false,
  onMerge,
  onClose,
}: {
  floor: number;
  demo?: boolean;
  onMerge: (data: { rooms: Room[]; walls: WallSegment[]; doors: DoorOpening[] }) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [preview, setPreview] = useState<{ rooms: DetectedRoom[]; walls: DetectedWall[]; doors: DetectedDoor[] } | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setNeedsSignIn(false);
    setPreview(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const [, mediaType, base64] = dataUrl.match(/^data:(.+);base64,(.+)$/) ?? [];
      if (!base64) throw new Error('Could not read that image.');

      const res = await fetch('/api/ai-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType, floor }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setNeedsSignIn(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? 'Detection failed');
      if (data.rooms.length === 0) throw new Error('No rooms could be confidently detected in that image.');
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed');
    } finally {
      setBusy(false);
    }
  }

  async function trySample() {
    try {
      const blob = await (await fetch(SAMPLE_PLAN)).blob();
      await handleFile(new File([blob], 'sample-floor-plan.png', { type: 'image/png' }));
    } catch {
      setError('Could not load the sample plan.');
    }
  }

  function acceptAll() {
    if (!preview) return;
    const idMap = new Map<string, string>();
    const rooms: Room[] = preview.rooms.map((r) => {
      const id = nextId('room');
      idMap.set(r.id, id);
      return { id, floor, polygon: r.polygon, isExit: r.isExit, name: r.name };
    });
    const walls: WallSegment[] = preview.walls.map((w) => ({ id: nextId('wall'), floor, start: w.start, end: w.end }));
    const doors: DoorOpening[] = preview.doors
      .filter((d) => idMap.has(d.roomA) && idMap.has(d.roomB))
      .map((d) => ({
        id: nextId('door'),
        floor,
        position: d.position,
        roomA: idMap.get(d.roomA)!,
        roomB: idMap.get(d.roomB)!,
        widthMeters: 0.9,
      }));

    onMerge({ rooms, walls, doors });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <h3>AI floor-plan detection</h3>
        <p>Upload an image of floor {floor}. Claude will draft rooms, walls, and doors for you to review.</p>

        {demo && (
          <p className="info-text">This is the live demo: detected rooms are added for you to try, but not saved.</p>
        )}

        {!preview && (
          <label className={`dropzone${busy ? '' : ''}`}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {busy ? (
              <>
                <span className="spinner" /> Analyzing floor plan…
              </>
            ) : (
              'Click to choose a floor plan image (PNG, JPG, WEBP)'
            )}
          </label>
        )}

        {!preview && !busy && (
          <button type="button" className="btn-ghost btn-sm sample-plan" onClick={trySample}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SAMPLE_PLAN} alt="" width={28} height={50} />
            No plan handy? Try the sample floor plan
          </button>
        )}

        {needsSignIn && (
          <p className="error-text">
            Floor-plan detection needs an account. <Link href="/login">Sign in</Link> or <Link href="/signup">sign up free</Link>.
          </p>
        )}
        {error && <p className="error-text">{error}</p>}

        {preview && (
          <div>
            <p>
              Detected <strong>{preview.rooms.length}</strong> room(s), <strong>{preview.walls.length}</strong> wall
              segment(s), and <strong>{preview.doors.length}</strong> door(s). This will be added to floor {floor} —
              you can edit or delete anything afterward.
            </p>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-dim)', maxHeight: 160, overflowY: 'auto' }}>
              {preview.rooms.map((r) => (
                <li key={r.id}>
                  {r.name} {r.isExit ? '(exit)' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {preview && (
            <button type="button" className="btn-primary" onClick={acceptAll}>
              Add to floor {floor}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
