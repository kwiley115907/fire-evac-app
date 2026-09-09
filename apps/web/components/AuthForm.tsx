'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase-client';

export function AuthForm() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage(error.message);
    } else if (mode === 'sign-up') {
      setMessage('Check your email to confirm your account, then sign in.');
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', maxWidth: 320 }}>
      <h2 style={{ marginBottom: 0 }}>{mode === 'sign-in' ? 'Sign in' : 'Create an account'}</h2>
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #333', background: '#1a1a1a', color: '#e5e5e5' }}
      />
      <input
        type="password"
        required
        minLength={6}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #333', background: '#1a1a1a', color: '#e5e5e5' }}
      />
      <button type="submit" disabled={loading}>
        {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
          setMessage(null);
        }}
        style={{ background: 'transparent', border: 'none', color: '#8ab4f8', cursor: 'pointer' }}
      >
        {mode === 'sign-in' ? "Need an account? Sign up" : 'Already have an account? Sign in'}
      </button>
      {message && <p>{message}</p>}
    </form>
  );
}
