// frontend/src/services/http.js
const RAW = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();
export const API_BASE = RAW && RAW !== '/' ? RAW : '/api';

export async function apiFetch(path, opts = {}) {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  const raw = (localStorage.getItem('token') || '').trim();
  const auth = raw && !raw.startsWith('Bearer ') ? `Bearer ${raw}` : raw;

  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(auth ? { Authorization: auth } : {}) },
  });

  const ctype = res.headers.get('content-type') || '';
  if (!res.ok) {
    const body = ctype.includes('application/json') ? JSON.stringify(await res.json()) : await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }

  return ctype.includes('application/json') ? res.json() : res.text();
}