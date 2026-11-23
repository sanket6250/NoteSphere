import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiBaseUrl } from './apiBaseUrl.js';

test('normalizes a Render backend URL with a trailing slash or /api suffix', () => {
  assert.equal(normalizeApiBaseUrl('https://notes-api.onrender.com/'), 'https://notes-api.onrender.com');
  assert.equal(normalizeApiBaseUrl('https://notes-api.onrender.com/api/'), 'https://notes-api.onrender.com');
  assert.equal(normalizeApiBaseUrl('https://notes-api.onrender.com/api/api'), 'https://notes-api.onrender.com');
});

test('keeps same-origin mode empty and trims whitespace', () => {
  assert.equal(normalizeApiBaseUrl(''), '');
  assert.equal(normalizeApiBaseUrl('  https://notes-api.onrender.com  '), 'https://notes-api.onrender.com');
});
