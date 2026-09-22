'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';

export function AuthCard({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/dashboard');
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo('Check your email to confirm your account, then sign in.');
    }

    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <form onSubmit={handleSubmit} className="auth-card glass-panel">
        <h2>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h2>
        <div className="field-group">
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
          {loading && <span className="spinner" />}
          {mode === 'sign-in' ? 'Sign in' : 'Sign up'}
        </button>
        {error && <p className="error-text">{error}</p>}
        {info && <p className="info-text">{info}</p>}
        <p className="auth-switch">
          {mode === 'sign-in' ? (
            <>
              Need an account? <Link href="/signup">Sign up</Link>
            </>
          ) : (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
