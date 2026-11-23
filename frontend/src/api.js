import { API_BASE_URL } from './apiBaseUrl.js';

let csrfState;

async function loadCsrf() {
  if (!csrfState) {
    csrfState = fetch(`${API_BASE_URL}/api/auth/csrf`, {
      credentials: 'include',
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error('Could not establish a secure session.');
      return response.json();
    }).catch((error) => {
      csrfState = undefined;
      throw error;
    });
  }
  return csrfState;
}

export async function csrfHeader() {
  const csrf = await loadCsrf();
  return { [csrf.headerName]: csrf.token };
}

export async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  const publicAuthEndpoint = url.endsWith('/api/auth/register') || url.endsWith('/api/auth/login');
  if (publicAuthEndpoint) headers.delete('Authorization');
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    Object.entries(await csrfHeader()).forEach(([name, value]) => headers.set(name, value));
  }
  const response = await fetch(url, { ...options, method, headers, credentials: 'include' });
  if (
    response.status === 401
    && !url.endsWith('/api/auth/login')
    && !url.endsWith('/api/auth/register')
    && !url.endsWith('/api/auth/session')
    && typeof window !== 'undefined'
  ) {
    window.dispatchEvent(new Event('notesphere:unauthorized'));
  }
  return response;
}

export async function signIn(username, password) {
  const response = await apiFetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error('Too many sign-in attempts. Try again later.');
    throw new Error(response.status === 401 ? 'Invalid username or password.' : 'Sign-in failed.');
  }
  const session = await response.json();
  csrfState = undefined;
  await loadCsrf();
  return session;
}

export async function registerAccount({ username, email, password }) {
  const response = await apiFetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  if (!response.ok) {
    let message = 'Account creation failed.';
    if (response.status === 409) {
      message = 'An account already exists. Sign in instead.';
      window.dispatchEvent(new Event('notesphere:registration-closed'));
    } else {
      try {
        const body = await response.json();
        message = body.message || body.detail || message;
      } catch {
        message = 'Account creation failed.';
      }
    }
    throw new Error(message);
  }
  const session = await response.json();
  csrfState = undefined;
  await loadCsrf();
  return session;
}

export async function getRegistrationStatus() {
  const response = await fetch(`${API_BASE_URL}/api/auth/registration`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Could not check account setup status.');
  return response.json();
}

export async function signOut() {
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
    if (!response.ok && response.status !== 401) throw new Error('Sign-out failed.');
  } finally {
    csrfState = undefined;
  }
}

export async function getSession() {
  const response = await apiFetch(`${API_BASE_URL}/api/auth/session`);
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Could not verify the current session.');
  return response.json();
}
