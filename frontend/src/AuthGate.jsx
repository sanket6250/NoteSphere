import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { getRegistrationStatus, getSession, registerAccount, signIn, signOut } from './api';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [registrationAvailable, setRegistrationAvailable] = useState(false);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const handleUnauthorized = () => setSession(null);
    const handleRegistrationClosed = () => {
      setRegistrationAvailable(false);
      setMode('login');
    };
    window.addEventListener('notesphere:unauthorized', handleUnauthorized);
    window.addEventListener('notesphere:registration-closed', handleRegistrationClosed);
    getSession()
      .then(async (current) => {
        if (!active) return;
        setSession(current);
        if (!current) {
          const status = await getRegistrationStatus();
          if (active) setRegistrationAvailable(status.available);
        }
      })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setSession((current) => current === undefined ? null : current); });
    return () => {
      active = false;
      window.removeEventListener('notesphere:unauthorized', handleUnauthorized);
      window.removeEventListener('notesphere:registration-closed', handleRegistrationClosed);
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const nextSession = mode === 'register'
        ? await registerAccount({ username, email, password })
        : await signIn(username, password);
      setSession(nextSession);
      setRegistrationAvailable(false);
      setMode('login');
      setPassword('');
    } catch (failure) {
      setPassword('');
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
  const registering = mode === 'register' && registrationAvailable;
  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <span className="dialog-eyebrow">NOTESPHERE</span>
        <h1>{registering ? 'Create your account' : 'Sign in'}</h1>
        <p>{registering ? 'Set up the single account for this NoteSphere workspace.' : 'Sign in to open your private workspace.'}</p>
        {error && <div className="archive-error" role="alert">{error}</div>}
        <label htmlFor="auth-username">{registering ? 'Username' : 'Username or email'}</label>
        <input
          id="auth-username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          minLength={registering ? 3 : undefined}
          maxLength={registering ? 32 : 254}
          pattern={registering ? '[A-Za-z0-9._-]+' : undefined}
          required
        />
        {registering && (
          <>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </>
        )}
        <label htmlFor="auth-password">Password</label>
        <div className="auth-password-field">
          <input
            id="auth-password"
            type={passwordVisible ? 'text' : 'password'}
            autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={registering ? 12 : undefined}
            maxLength={registering ? 72 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            className="auth-password-toggle"
            type="button"
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <button className="dialog-submit" type="submit" disabled={busy}>
          {busy ? (registering ? 'Creating account…' : 'Signing in…') : (registering ? 'Create account' : 'Sign in')}
        </button>
        {registrationAvailable && (
          <button
            className="auth-mode-switch"
            type="button"
            disabled={busy}
            onClick={() => {
              setError('');
              setPassword('');
              setMode(registering ? 'login' : 'register');
            }}
          >
            {registering ? 'Already have an account? Sign in' : 'Create the first account'}
          </button>
        )}
      </form>
    </main>
  );
}
