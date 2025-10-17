// frontend/src/services/fetchAuth.js
export function installApiAuthFetch() {
  if (typeof window === 'undefined' || !window.fetch) return;

  const origFetch = window.fetch;

  window.fetch = (input, init = {}) => {
    try {
      // Descobre a URL independente se "input" é string ou Request
      const url = typeof input === 'string'
        ? input
        : (input && typeof input.url === 'string' ? input.url : '');

      // Só intercepta chamadas para /api/...
      const needsAuth =
        typeof url === 'string' &&
        (url.startsWith('/api/') || url.includes('/api/'));

      if (!needsAuth) {
        return origFetch(input, init);
      }

      // Pega o token do localStorage
      let token = null;
      try { token = localStorage.getItem('token'); } catch {}

      // Monta headers preservando os existentes
      const baseHeaders = (init && init.headers) || {};
      const headers = new Headers(baseHeaders);

      // Garante Accept e Content-Type (quando não houver)
      if (!headers.has('Accept')) headers.set('Accept', 'application/json');
      // Content-Type só quando for POST/PUT/PATCH com body json
      // (não vamos forçar aqui para não quebrar uploads etc.)

      // Injeta Authorization se ainda não existir e tivermos token
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const newInit = { ...init, headers };
      return origFetch(input, newInit);
    } catch {
      // Se algo der errado, segue o fetch normal
      return origFetch(input, init);
    }
  };
}