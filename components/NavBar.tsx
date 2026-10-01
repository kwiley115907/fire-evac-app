'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import { BrandLogo, BrandWordmark } from '@/components/Brand';
import { Icon } from '@/components/icons';

export function NavBar() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Only a hint for showing the link: /admin and its RPCs check again in
  // Postgres. Before supabase/admin.sql is applied the RPC errors, so no link.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.rpc('is_app_admin').then(({ data, error }) => {
      if (!cancelled) setAdminUserId(!error && data === true ? userId : null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const isAdmin = !!userId && adminUserId === userId;

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link href="/" className="brand" aria-label="Sentinel Grid home">
          <BrandLogo />
          <BrandWordmark />
        </Link>
        <nav className="nav-links">
          <Link href="/demo?scan=1" className="hide-xs">
            AR Scan
          </Link>
          <Link href="/demo" className="hide-xs">
            Live demo
          </Link>
          {session ? (
            <>
              {isAdmin && (
                <Link href="/admin" className="nav-admin" aria-label="Admin">
                  <Icon name="shield" size={16} />
                  <span className="nav-label">Admin</span>
                </Link>
              )}
              <Link href="/dashboard">Dashboard</Link>
              <button type="button" className="btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
