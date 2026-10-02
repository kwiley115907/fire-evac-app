'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';

/** Step 1: ask for the email and send a reset link to /reset-password. */
export function ForgotPasswordCard() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <form onSubmit={handleSubmit} className="auth-card glass-panel">
        <h2>Reset your password</h2>
        {sent ? (
          <p className="info-text" style={{ textAlign: 'center' }}>
            If an account exists for {email}, a reset link is on its way. Open it on this device, in this browser.
          </p>
        ) : (
          <>
            <div className="field-group">
              <div>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading && <span className="spinner" />}
              Send reset link
            </button>
          </>
        )}
        {error && <p className="error-text">{error}</p>}
        <p className="auth-switch">
          Remembered it? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

type LinkState = 'checking' | 'ready' | 'invalid';

/**
 * Step 2: the emailed link lands here with a one-time code, which the
 * Supabase browser client exchanges for a recovery session on load. Then
 * the user picks a new password.
 */
export function ResetPasswordCard() {
  const router = useRouter();
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setLinkState('ready');
    });
    // Give the client a moment to exchange the code from the URL. No session
    // after that means the link expired, was used, or was opened in another
    // browser (the code only works where it was requested).
    const timer = window.setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => setLinkState(data.session ? 'ready' : 'invalid'));
    }, 1500);
    return () => {
      listener.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('The passwords don’t match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(error.message);
    else router.push('/dashboard');
  }

  return (
    <div className="auth-wrap">
      <form onSubmit={handleSubmit} className="auth-card glass-panel">
        <h2>Choose a new password</h2>
        {linkState === 'checking' && (
          <p className="auth-switch">
            <span className="spinner" /> Checking your reset link…
          </p>
        )}
        {linkState === 'invalid' && (
          <>
            <p className="error-text" style={{ textAlign: 'center' }}>
              This reset link has expired, was already used, or was opened in a different browser.
            </p>
            <p className="auth-switch">
              <Link href="/forgot-password">Send a new link</Link>
            </p>
          </>
        )}
        {linkState === 'ready' && (
          <>
            <div className="field-group">
              <div>
                <label htmlFor="password">New password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="confirm">Confirm new password</label>
                <input
                  id="confirm"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading && <span className="spinner" />}
              Save password
            </button>
          </>
        )}
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
