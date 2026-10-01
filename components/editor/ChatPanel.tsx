'use client';

import { useState } from 'react';
import type { EvacuationRoute } from '@/lib/evacuation-types';
import { Icon } from '@/components/icons';

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = ['Nearest exit from the server room', 'Way out of the break room', 'How do I get out of the lab?'];

export function ChatPanel({
  buildingId,
  dirty,
  onRoute,
}: {
  buildingId: string;
  dirty: boolean;
  onRoute: (route: EvacuationRoute) => void;
}) {
  const [entries, setEntries] = useState<ChatEntry[]>([
    { role: 'assistant', text: 'Describe where someone is — "the room by the kitchen", "server room" — and I’ll find it and plot the way out.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(message: string) {
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
      if (data.route) onRoute(data.route as EvacuationRoute);
    } catch (err) {
      setEntries((prev) => [...prev, { role: 'assistant', text: err instanceof Error ? err.message : 'Something went wrong.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      {dirty && (
        <p className="chat-note">
          <Icon name="alert" size={14} /> The assistant reads your last saved version — save to include recent edits.
        </p>
      )}
      <div className="chat-log">
        {entries.map((entry, i) => (
          <div key={i} className={`chat-bubble ${entry.role}`}>
            {entry.text}
          </div>
        ))}
        {busy && (
          <div className="chat-bubble assistant">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
      </div>
      {entries.length === 1 && (
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input.trim());
        }}
      >
        <input placeholder="Where is the person?" value={input} onChange={(e) => setInput(e.target.value)} disabled={busy} />
        <button type="submit" className="btn-primary btn-sm" disabled={busy || !input.trim()} aria-label="Ask">
          <Icon name="route" size={16} />
        </button>
      </form>
    </div>
  );
}
