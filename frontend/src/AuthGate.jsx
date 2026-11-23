import React, { useEffect, useState } from 'react';
import { getSession, signIn, signOut } from './api';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const handleUnauthorized = () => setSession(null);
    window.addEventListener('notesphere:unauthorized', handleUnauthorized);
    getSession()
      .then((current) => { if (active) setSession(current); })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setSession((current) => current === undefined ? null : current); });
    return () => {
      active = false;
      window.removeEventListener('notesphere:unauthorized', handleUnauthorized);
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await signIn(username, password);
      setSession(session);
      setPassword('');
    } catch (failure) {
      setError(failure.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setError('');
    try {
      await signOut();
      setSession(null);
      return true;
    } catch (failure) {
      setError(failure.message || 'Sign-out failed.');
      return false;
    }
  }

  if (session === undefined) {
    return <main className="auth-screen" role="status">Checking your session…</main>;
  }
  if (session) {
    return typeof children === 'function' ? children({ signOut: logout }) : children;
  }
  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <span className="dialog-eyebrow">NOTESPHERE</span>
        <h1>Sign in</h1>
        <p>Use your configured NoteSphere account to continue.</p>
        {error && <div className="archive-error" role="alert">{error}</div>}
        <label htmlFor="auth-username">Username</label>
        <input
          id="auth-username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className="dialog-submit" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
