'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import { NavBar } from '@/components/NavBar';
import { BuildingEditor } from '@/components/editor/BuildingEditor';
import { BrandSplash } from '@/components/Brand';
import type { BuildingGraph } from '@/lib/evacuation-types';

export default function BuildingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [data, setData] = useState<{ name: string; graph: BuildingGraph; upload: boolean } | null>(null);
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
    fetch(`/api/buildings/${params.id}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Failed to load building');
        // /buildings/<id>?upload=1 (from "Create & upload plan") opens the
        // floor-plan upload straight away; drop the flag so a reload doesn't.
        const upload = new URLSearchParams(window.location.search).get('upload') === '1';
        if (upload) window.history.replaceState(null, '', window.location.pathname);
        setData({ name: body.name, graph: body.graph, upload });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load building'));
  }, [session, router, params.id]);

  if (error) {
    return (
      <div className="shell">
        <NavBar />
        <main className="container">
          <p className="error-text" style={{ padding: '3rem 0' }}>
            {error}
          </p>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="shell">
        <NavBar />
        <BrandSplash label="Loading building…" />
      </div>
    );
  }

  return <BuildingEditor buildingId={params.id} initialName={data.name} initialGraph={data.graph} openDetect={data.upload} />;
}
