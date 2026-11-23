import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch } from './api.js';

test('public registration requests do not forward stale authorization headers', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/api/auth/csrf')) {
      return new Response(JSON.stringify({ headerName: 'X-XSRF-TOKEN', token: 'csrf-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(null, { status: 401 });
  };

  try {
    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer expired-token',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    assert.equal(response.status, 401);
    const registration = calls.find(({ url }) => url.endsWith('/api/auth/register'));
    assert.ok(registration);
    assert.equal(new Headers(registration.options.headers).get('Authorization'), null);
    assert.equal(registration.options.credentials, 'include');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
