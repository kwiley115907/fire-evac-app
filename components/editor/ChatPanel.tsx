'use client';

import { useState } from 'react';
import type { EvacuationRoute } from '@/lib/evacuation-types';

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
}

export function ChatPanel({
  buildingId,
  onRoute,
}: {
  buildingId: string;
  onRoute: (route: EvacuationRoute, floor: number) => void;
}) {
  const [entries, setEntries] = useState<ChatEntry[]>([
    { role: 'assistant', text: 'Ask me where to go — e.g. "nearest exit from the break room".' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;

    setEntries((prev) => [...prev, { role: 'user', text: message }]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Chat failed');

      setEntries((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      if (data.route) {
        onRoute(data.route as EvacuationRoute, data.route.steps[0].floor);
      }
    } catch (err) {
      setEntries((prev) => [
        ...prev,
        { role: 'assistant', text: err instanceof Error ? err.message : 'Something went wrong.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-panel chat-panel">
      <div className="tool-group-label">Evacuation assistant</div>
      <div className="chat-log">
        {entries.map((entry, i) => (
          <div key={i} className={`chat-bubble ${entry.role}`}>
            {entry.text}
          </div>
        ))}
        {busy && <div className="chat-bubble assistant"><span className="spinner" /></div>}
      </div>
      <form className="chat-input-row" onSubmit={send}>
        <input
          placeholder="Where's the nearest exit from…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
