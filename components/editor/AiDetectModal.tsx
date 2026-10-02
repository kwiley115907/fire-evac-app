'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { imageFileToPlanImage, isPdf, openPdf, renderPdfPage, type OpenPdf, type PlanImage } from '@/lib/plan-image';
import { nextId } from '@/lib/editor-utils';
import { Icon } from '@/components/icons';
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
  const [busyLabel, setBusyLabel] = useState('Analyzing floor plan…');
  const [preview, setPreview] = useState<{ rooms: DetectedRoom[]; walls: DetectedWall[]; doors: DetectedDoor[] } | null>(null);
  // A multi-page PDF waiting for the user to pick the page for this floor.
  const [pdf, setPdf] = useState<(OpenPdf & { name: string }) | null>(null);
  const [page, setPage] = useState(1);
  const [pageThumb, setPageThumb] = useState<string | null>(null);
  // Free the PDF worker when the PDF is replaced or the dialog closes.
  const pdfRef = useRef<OpenPdf | null>(null);
  useEffect(() => {
    pdfRef.current = pdf;
  }, [pdf]);
  useEffect(() => () => void pdfRef.current?.destroy(), []);

  // Small render of the chosen page so the user can see it's the right floor.
  useEffect(() => {
    if (!pdf) return;
    let live = true;
    renderPdfPage(pdf, page, 700)
      .then((img) => live && setPageThumb(img.previewUrl))
      .catch(() => live && setPageThumb(null));
    return () => {
      live = false;
    };
  }, [pdf, page]);

  async function handleFile(file: File) {
    setError(null);
    setNeedsSignIn(false);
    setPreview(null);
    setPageThumb(null);
    await pdf?.destroy();
    setPdf(null);
    if (isPdf(file)) {
      setBusy(true);
      setBusyLabel('Opening PDF…');
      try {
        const opened = await openPdf(file);
        if (opened.pages === 1) {
          setBusyLabel('Reading page 1…');
          const img = await renderPdfPage(opened, 1);
          await opened.destroy();
          await detect(img);
        } else {
          setPage(1);
          setPdf({ ...opened, name: file.name });
          setBusy(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not open that PDF.');
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setBusyLabel('Preparing image…');
    try {
      await detect(await imageFileToPlanImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.');
      setBusy(false);
    }
  }

  async function detectPdfPage() {
    if (!pdf) return;
    setBusy(true);
    setBusyLabel(`Reading page ${page}…`);
    setError(null);
    try {
      await detect(await renderPdfPage(pdf, page));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that page.');
      setBusy(false);
    }
  }

  async function detect(img: PlanImage) {
    setBusy(true);
    setBusyLabel('Analyzing floor plan… (10–30 seconds)');
    setError(null);
    setNeedsSignIn(false);
    try {
      const res = await fetch('/api/ai-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: img.base64, mediaType: img.mediaType, floor }),
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
        <p>Upload a PDF or an image of floor {floor}. Claude will draft rooms, walls, and doors for you to review.</p>

        {demo && (
          <p className="info-text">This is the live demo: detected rooms are added for you to try, but not saved.</p>
        )}

        {pdf && !preview && (
          <div className="pdf-pages">
            <p>
              <strong>{pdf.name}</strong> has {pdf.pages} pages. Pick the one that shows floor {floor}.
            </p>
            <div className="pdf-page-nav">
              <button type="button" className="icon-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={busy || page === 1} aria-label="Previous page">
                <Icon name="back" />
              </button>
              <span className="mono">
                Page {page} of {pdf.pages}
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPage((p) => Math.min(pdf.pages, p + 1))}
                disabled={busy || page === pdf.pages}
                aria-label="Next page"
              >
                <Icon name="back" style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>
            <div className="pdf-page-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {pageThumb ? <img src={pageThumb} alt={`Page ${page}`} /> : <span className="spinner" />}
            </div>
            <button type="button" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={detectPdfPage} disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" /> {busyLabel}
                </>
              ) : (
                `Detect rooms on page ${page}`
              )}
            </button>
          </div>
        )}

        {!preview && (
          <label className="dropzone">
            <input
              type="file"
              accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {busy && !pdf ? (
              <>
                <span className="spinner" /> {busyLabel}
              </>
            ) : pdf ? (
              'Choose a different file'
            ) : (
              'Tap to choose a floor plan — PDF, PNG, JPG or WebP'
            )}
          </label>
        )}

        {!preview && !busy && !pdf && (
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
