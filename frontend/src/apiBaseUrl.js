export function normalizeApiBaseUrl(value) {
  const baseUrl = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
  return baseUrl.replace(/(?:\/api)+$/i, '');
}

const buildEnvironment = import.meta.env || {};
export const API_BASE_URL = normalizeApiBaseUrl(buildEnvironment.VITE_API_BASE_URL || '');

if (buildEnvironment.PROD && /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::|\/|$)/i.test(API_BASE_URL)) {
  throw new Error('VITE_API_BASE_URL must not point to localhost in production.');
}
