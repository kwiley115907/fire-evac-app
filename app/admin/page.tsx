'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import { NavBar } from '@/components/NavBar';
import { SiteFooter } from '@/components/SiteFooter';
import { Icon } from '@/components/icons';
import { BrandSplash } from '@/components/Brand';
import { adminStats, filterAccounts, filterBuildings, type AdminBuilding, type AdminOverview } from '@/lib/admin';

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never';
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

type OverviewResult = AdminOverview | 'forbidden';

async function fetchOverview(): Promise<OverviewResult> {
  const res = await fetch('/api/admin');
  const body = await res.json().catch(() => ({}));
  if (res.status === 403) return 'forbidden';
  if (!res.ok) throw new Error(body.error ?? 'Failed to load the admin console.');
  return body as AdminOverview;
}

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountQuery, setAccountQuery] = useState('');
  const [buildingQuery, setBuildingQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminBuilding | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const applyResult = useCallback((result: OverviewResult) => {
    if (result === 'forbidden') setForbidden(true);
    else setOverview(result);
  }, []);
  const load = useCallback(() => fetchOverview().then(applyResult), [applyResult]);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push('/login');
      return;
    }
    fetchOverview()
      .then(applyResult)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the admin console.'));
  }, [session, router, applyResult]);

  async function setAdmin(userId: string, makeAdmin: boolean) {
    setPendingId(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, makeAdmin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Failed to update admin access.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update admin access.');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/buildings/${confirmDelete.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Failed to delete building.');
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete building.');
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  if (forbidden) {
    return (
      <div className="shell">
        <NavBar />
        <main className="container">
          <div className="empty-state">
            <span className="feature-icon admin-lock">
              <Icon name="shield" size={20} />
            </span>
            <h2>Admins only</h2>
            <p>This account doesn’t have admin access.</p>
            <Link href="/dashboard" className="btn btn-ghost">
              Back to your buildings
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (session === undefined || (session && overview === null && !error)) {
    return (
      <div className="shell">
        <NavBar />
        <BrandSplash label="Loading the admin console…" />
      </div>
    );
  }

  const me = session?.user.id;
  const stats = overview ? adminStats(overview) : null;
  const accounts = overview ? filterAccounts(overview.accounts, accountQuery) : [];
  const buildings = overview ? filterBuildings(overview.buildings, buildingQuery) : [];

  return (
    <div className="shell">
      <NavBar />
      <main className="container admin">
        <div className="page-header brand-strip">
          <div>
            <span className="section-kicker">Sentinel Grid · Owner console</span>
            <h1>Admin</h1>
            <p>Every account and every building on evacuate.today.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={() => load().catch(() => setError('Failed to refresh.'))}>
            <Icon name="redo" size={16} /> Refresh
          </button>
        </div>

        {error && <p className="error-text admin-error">{error}</p>}

        {stats && (
          <div className="admin-stats">
            <div className="card admin-stat">
              <span className="admin-stat-label">Accounts</span>
              <strong>{stats.accounts}</strong>
            </div>
            <div className="card admin-stat">
              <span className="admin-stat-label">New this week</span>
              <strong className="go">{stats.newThisWeek}</strong>
            </div>
            <div className="card admin-stat">
              <span className="admin-stat-label">Buildings</span>
              <strong>{stats.buildings}</strong>
            </div>
            <div className="card admin-stat">
              <span className="admin-stat-label">Admins</span>
              <strong>{stats.admins}</strong>
            </div>
          </div>
        )}

        {overview && (
          <div className="admin-sections">
            <section className="card admin-section">
              <div className="admin-section-head">
                <h2>
                  Accounts <span className="admin-count">{accounts.length}</span>
                </h2>
                <input type="search" placeholder="Search by email" value={accountQuery} onChange={(e) => setAccountQuery(e.target.value)} aria-label="Search accounts" />
              </div>
              <ul className="admin-list">
                {accounts.map((a) => (
                  <li key={a.id} className="admin-row">
                    <div className="admin-row-main">
                      <span className="admin-row-title">
                        {a.email ?? 'No email'}
                        {a.isAdmin && <span className="admin-badge">Admin</span>}
                        {a.id === me && <span className="admin-badge you">You</span>}
                      </span>
                      <span className="admin-row-meta">
                        Joined {formatDate(a.joinedAt)} · Last sign-in {formatDate(a.lastSignInAt)} · {plural(a.buildingCount, 'building')}
                      </span>
                    </div>
                    <div className="admin-row-actions">
                      {a.isAdmin ? (
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          disabled={a.id === me || pendingId === a.id}
                          title={a.id === me ? 'You can’t remove your own admin access' : undefined}
                          onClick={() => setAdmin(a.id, false)}
                        >
                          {pendingId === a.id && <span className="spinner" />}
                          Remove admin
                        </button>
                      ) : (
                        <button type="button" className="btn-sm" disabled={pendingId === a.id} onClick={() => setAdmin(a.id, true)}>
                          {pendingId === a.id ? <span className="spinner" /> : <Icon name="shield" size={14} />}
                          Make admin
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {accounts.length === 0 && <li className="admin-empty">No accounts match “{accountQuery}”.</li>}
              </ul>
            </section>

            <section className="card admin-section">
              <div className="admin-section-head">
                <h2>
                  Buildings <span className="admin-count">{buildings.length}</span>
                </h2>
                <input type="search" placeholder="Search by name or owner" value={buildingQuery} onChange={(e) => setBuildingQuery(e.target.value)} aria-label="Search buildings" />
              </div>
              <ul className="admin-list">
                {buildings.map((b) => (
                  <li key={b.id} className="admin-row">
                    <div className="admin-row-main">
                      <span className="admin-row-title">
                        {b.name}
                        {b.ownerId === me && <span className="admin-badge you">Yours</span>}
                      </span>
                      <span className="admin-row-meta">
                        {b.ownerEmail ?? 'Unknown owner'} · {plural(b.floors, 'floor')} · {plural(b.rooms, 'room')} · {plural(b.exits, 'exit')} · Updated {formatDate(b.updatedAt)}
                      </span>
                    </div>
                    <div className="admin-row-actions">
                      <Link href={`/buildings/${b.id}`} className="btn btn-sm">
                        Open
                      </Link>
                      <button type="button" className="btn-danger btn-sm" onClick={() => setConfirmDelete(b)}>
                        <Icon name="trash" size={14} /> Delete
                      </button>
                    </div>
                  </li>
                ))}
                {buildings.length === 0 && (
                  <li className="admin-empty">{buildingQuery ? `No buildings match “${buildingQuery}”.` : 'No buildings yet.'}</li>
                )}
              </ul>
            </section>
          </div>
        )}

        {confirmDelete && (
          <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(null)}>
            <div className="modal" role="alertdialog" aria-labelledby="admin-delete-title" onClick={(e) => e.stopPropagation()}>
              <h3 id="admin-delete-title">Delete “{confirmDelete.name}”?</h3>
              <p>
                This permanently removes the building and its floor plans
                {confirmDelete.ownerId === me ? '' : ` from ${confirmDelete.ownerEmail ?? 'its owner'}’s account`}. It can’t be undone.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                  Cancel
                </button>
                <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting && <span className="spinner" />}
                  Delete building
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
