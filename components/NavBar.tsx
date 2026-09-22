'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';

export function NavBar() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">SG</span>
          Sentinel Grid
        </Link>
        <nav className="nav-links">
          {session ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <button
                type="button"
                className="btn-sm"
                onClick={() => supabase.auth.signOut()}
              >
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
