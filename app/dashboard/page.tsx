'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import type { Point } from '@/lib/evacuation-types';
import { supabase } from '@/lib/supabase-client';
import { NavBar } from '@/components/NavBar';
import { SiteFooter } from '@/components/SiteFooter';
import { Icon } from '@/components/icons';
import { BrandSplash } from '@/components/Brand';

interface BuildingSummary {
  id: string;
  name: string;
  updatedAt: string;
  preview: {
    floors: number;
    rooms: number;
    exits: number;
    outline: { polygon: Point[]; isExit: boolean }[];
  } | null;
}

function Thumb({ preview }: { preview: BuildingSummary['preview'] }) {
  const pts = preview?.outline.flatMap((r) => r.polygon) ?? [];
  if (pts.length === 0) {
    return (
      <div className="building-thumb">
        <Icon name="building" size={30} />
      </div>
    );
  }
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const w = Math.max(...pts.map((p) => p.x)) - minX || 1;
  const h = Math.max(...pts.map((p) => p.y)) - minY || 1;
  const pad = Math.max(w, h) * 0.08;
  return (
    <div className="building-thumb">
      <svg viewBox={`${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {preview!.outline.map((r, i) => (
          <polygon
            key={i}
            points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
            fill={r.isExit ? 'rgba(47,227,154,0.35)' : 'rgba(120,170,220,0.07)'}
            stroke={r.isExit ? '#2fe39a' : 'rgba(160,200,240,0.45)'}
            strokeWidth={1.2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [buildings, setBuildings] = useState<BuildingSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push('/login');
      return;
    }
    fetch('/api/buildings')
      .then((res) => res.json())
      .then(setBuildings)
      .catch(() => setError('Failed to load buildings.'));
  }, [session, router]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Which button submitted: "Create" or "Create & upload floor plan".
    const upload = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'upload';
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create building');
      router.push(upload ? `/buildings/${data.id}?upload=1` : `/buildings/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create building');
      setBusy(false);
    }
  }

  if (session === undefined || (session && buildings === null && !error)) {
    return (
      <div className="shell">
        <NavBar />
        <BrandSplash label="Loading your buildings…" />
      </div>
    );
  }

  return (
    <div className="shell">
      <NavBar />
      <main className="container">
        <div className="page-header brand-strip">
          <div>
            <span className="section-kicker">Sentinel Grid</span>
            <h1>Your buildings</h1>
            <p>Open one to plan routes, run a drill, or audit its exits.</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
              <Icon name="image" size={16} /> Upload floor plan
            </button>
            <button type="button" className="btn-ghost" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} /> New building
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {creating && (
          <div className="modal-overlay" onClick={() => !busy && setCreating(false)}>
            <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
              <h3>Name this building</h3>
              <p>Next, upload a photo of its floor plan and Claude draws the rooms, or draw them yourself.</p>
              <input autoFocus placeholder="e.g. Riverside Office — Building A" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setCreating(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" value="draw" className="btn-ghost" disabled={busy || !newName.trim()}>
                  Create &amp; draw
                </button>
                <button type="submit" value="upload" className="btn-primary" disabled={busy || !newName.trim()}>
                  {busy ? <span className="spinner" /> : <Icon name="image" size={16} />}
                  Create &amp; upload plan
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="building-grid">
          {buildings?.map((b) => (
            <Link key={b.id} href={`/buildings/${b.id}`} className="building-card">
              <Thumb preview={b.preview} />
              <h3>{b.name}</h3>
              <span className="meta">
                {b.preview ? `${b.preview.floors} floor${b.preview.floors === 1 ? '' : 's'} · ${b.preview.rooms} rooms · ${b.preview.exits} exit${b.preview.exits === 1 ? '' : 's'}` : 'Empty'}
              </span>
              <span className="meta">Updated {new Date(b.updatedAt).toLocaleDateString()}</span>
            </Link>
          ))}
          <button type="button" className="building-card new" onClick={() => setCreating(true)}>
            <span className="feature-icon">
              <Icon name="plus" size={20} />
            </span>
            New building
          </button>
          {buildings?.length === 0 && (
            <Link href="/demo" className="building-card new">
              <span className="feature-icon">
                <Icon name="play" size={18} />
              </span>
              Explore the sample office first
            </Link>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
