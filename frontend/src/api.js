const API = import.meta.env.VITE_API_BASE_URL || '';
let csrfState;

async function loadCsrf() {
  if (!csrfState) {
    csrfState = fetch(`${API}/api/auth/csrf`, {
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
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    Object.entries(await csrfHeader()).forEach(([name, value]) => headers.set(name, value));
  }
  const response = await fetch(url, { ...options, method, headers, credentials: 'include' });
  if (
    response.status === 401
    && !url.endsWith('/api/auth/login')
    && !url.endsWith('/api/auth/session')
    && typeof window !== 'undefined'
  ) {
    window.dispatchEvent(new Event('notesphere:unauthorized'));
  }
  return response;
}

export async function signIn(username, password) {
  const response = await apiFetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? 'Incorrect username or password.' : 'Sign-in failed.');
  }
  csrfState = undefined;
  await loadCsrf();
}

export async function signOut() {
  await apiFetch(`${API}/api/auth/logout`, { method: 'POST' });
  csrfState = undefined;
}

export async function getSession() {
  const response = await apiFetch(`${API}/api/auth/session`);
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Could not verify the current session.');
  return response.json();
}
