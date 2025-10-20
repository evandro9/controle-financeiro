// frontend/src/services/http.js
const RAW = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();

function normalizeBase(raw) {
  const r = (raw || '').trim();
  if (!r || r === '/') return '/api';
  // Absoluta?
  if (/^https?:\/\//i.test(r)) {
    try {
      const u = new URL(r);
      // garante que o pathname termine com /api
      const p = u.pathname || '/';
      if (p === '/' || !/\/api(\/|$)/.test(p)) {
        u.pathname = p.replace(/\/$/, '') + '/api';
      }
      // remove barra final
      return u.toString().replace(/\/$/, '');
    } catch {
      return '/api';
    }
  }
  // Relativa
  return r.startsWith('/api') ? r : `/api${r.startsWith('/') ? '' : '/'}${r}`;
}

export const API_BASE = normalizeBase(RAW);

export async function apiFetch(path, opts = {}) {
  let url = path;
  if (!/^https?:\/\//i.test(url)) {
    url = `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  }

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