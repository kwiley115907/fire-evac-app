'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import { NavBar } from '@/components/NavBar';
import { SiteFooter } from '@/components/SiteFooter';

interface BuildingSummary {
  id: string;
  name: string;
  updatedAt: string;
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
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
      router.push(`/buildings/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create building');
      setBusy(false);
    }
  }

  if (session === undefined || (session && buildings === null)) {
    return (
      <div className="shell">
        <NavBar />
        <main className="container">
          <p style={{ padding: '3rem 0' }}>Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <NavBar />
      <main className="container">
        <div className="page-header">
          <h1>Your buildings</h1>
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            + New building
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}

        {creating && (
          <div className="modal-overlay" onClick={() => !busy && setCreating(false)}>
            <form className="modal glass-panel" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
              <h3>Name this building</h3>
              <p>You can add floors, rooms, and exits next.</p>
              <input
                autoFocus
                placeholder="e.g. Riverside Office — Building A"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setCreating(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy || !newName.trim()}>
                  {busy && <span className="spinner" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        )}

        {buildings && buildings.length === 0 ? (
          <div className="empty-state glass-panel">
            <p>No buildings yet. Create one to start mapping evacuation routes.</p>
          </div>
        ) : (
          <div className="building-grid">
            {buildings?.map((b) => (
              <Link key={b.id} href={`/buildings/${b.id}`} className="building-card glass-panel">
                <h3>{b.name}</h3>
                <span className="meta">Updated {new Date(b.updatedAt).toLocaleString()}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
