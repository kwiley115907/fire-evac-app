'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase-client';
import { AuthForm } from '../components/AuthForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Two 10x10 rooms on one floor, connected by a door. Room B is the exit.
const SAMPLE_BUILDING = {
  buildingId: 'sample-building',
  floors: [1],
  walls: [],
  doors: [
    { id: 'door-1', floor: 1, position: { x: 10, y: 5 }, roomA: 'room-a', roomB: 'room-b', widthMeters: 0.9 },
  ],
  rooms: [
    { id: 'room-a', floor: 1, polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], isExit: false },
    { id: 'room-b', floor: 1, polygon: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }], isExit: true },
  ],
  connectors: [],
};

export default function Home() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [log, setLog] = useState('Nothing run yet.');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function authedFetch(path: string, body: unknown) {
    const token = session?.access_token;
    if (!token) throw new Error('Not signed in');

    return fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  async function loadSampleBuilding() {
    setLoading(true);
    try {
      const res = await authedFetch('/buildings', SAMPLE_BUILDING);
      const data = await res.json();
      setLog(`Building saved:\n${JSON.stringify(data, null, 2)}`);
    } catch (err) {
      setLog(`Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function findRoute() {
    setLoading(true);
    try {
      const res = await authedFetch('/route', { buildingId: 'sample-building', point: { x: 2, y: 2 }, floor: 1 });
      const data = await res.json();
      setLog(JSON.stringify(data, null, 2));
    } catch (err) {
      setLog(`Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  if (session === undefined) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: 700, margin: '0 auto' }}>
      <h1>Fire Evacuation Routing — Test Console</h1>
      {!session ? (
        <AuthForm />
      ) : (
        <>
          <p>
            Signed in as {session.user.email}{' '}
            <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          </p>
          <p>API target: {API_URL}</p>
          <button onClick={loadSampleBuilding} disabled={loading}>1. Save sample building</button>{' '}
          <button onClick={findRoute} disabled={loading}>2. Find nearest exit</button>
          <pre style={{ marginTop: '1rem', background: '#111', padding: '1rem', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{log}</pre>
        </>
      )}
    </main>
  );
}
