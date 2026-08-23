'use client';

import { useState } from 'react';

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
  const [log, setLog] = useState('Nothing run yet.');
  const [loading, setLoading] = useState(false);

  async function loadSampleBuilding() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SAMPLE_BUILDING),
      });
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
      const res = await fetch(`${API_URL}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId: 'sample-building', point: { x: 2, y: 2 }, floor: 1 }),
      });
      const data = await res.json();
      setLog(JSON.stringify(data, null, 2));
    } catch (err) {
      setLog(`Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: 700, margin: '0 auto' }}>
      <h1>Fire Evacuation Routing — Test Console</h1>
      <p>API target: {API_URL}</p>
      <button onClick={loadSampleBuilding} disabled={loading}>1. Save sample building</button>{' '}
      <button onClick={findRoute} disabled={loading}>2. Find nearest exit</button>
      <pre style={{ marginTop: '1rem', background: '#111', padding: '1rem', borderRadius: 6, whiteSpace: 'pre-wrap' }}>{log}</pre>
    </main>
  );
}
