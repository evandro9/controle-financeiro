// frontend/src/services/apiProxyPatch.js
// Habilita um patch global de URL para redirecionar chamadas "perdidas"
// (localhost:3001 e rotas sem /api) para a base correta.

const rawBaseEnv = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

function computeApiBase(raw) {
  if (!raw) return '/api'; // dev fallback => Vite proxy/relative
  // Se já terminar com /api, mantém.
  if (/\/api$/i.test(raw)) return raw;

  try {
    const u = new URL(raw, window.location.origin);
    const isFrontendHost =
      u.hostname === window.location.hostname || /\.vercel\.app$/i.test(u.hostname);
    // Se for o host do frontend (Vercel/domínio do app), acrescenta /api (usa o rewrite da Vercel).
    // Se for host de backend (Render etc.), não acrescenta /api.
    return isFrontendHost ? `${raw}/api` : raw;
  } catch {
    // Se der erro no parse, trata como frontend e põe /api.
    return `${raw}/api`;
  }
}

const API_BASE = computeApiBase(rawBaseEnv);
window.__API_BASE = API_BASE;
console.info('[API proxy patch] enabled →', API_BASE);

// Helper para montar URL destino sem duplicar /api
function toApiUrl(path) {
  const baseHasApi = /\/api$/i.test(API_BASE);
  if (path.startsWith('/api')) {
    return baseHasApi ? `${API_BASE}${path.slice(4)}` : `${API_BASE}${path}`;
  }
  return baseHasApi ? `${API_BASE}${path}` : `${API_BASE}${path}`;
}

// ========== Patch em fetch ==========
(function patchFetch() {
  if (typeof window === 'undefined' || !window.fetch) return;
  const origFetch = window.fetch;

  window.fetch = (input, init) => {
    try {
      // Extrai a URL de string ou Request
      const isRequestObj = typeof Request !== 'undefined' && input instanceof Request;
      const url = isRequestObj ? input.url : String(input || '');

      let target = null;

      // 1) http://localhost:3001/...
      if (/^https?:\/\/(localhost|127\.0\.0\.1):3001\//i.test(url)) {
        const rest = url.replace(/^https?:\/\/[^/]+/i, '');
        target = toApiUrl(rest);
      }

      // 2) Rotas de API sem /api (analises, lancamentos, dashboard, investimentos, planos, planejamentos,
      //    patrimonio, proventos, regras, indices, importacoes, benchmarks, valores)
      if (!target && /^\/(analises|lancamentos|dashboard|investimentos|planos|planejamentos|patrimonio|proventos|regras|indices|importacoes|benchmarks|valores)\b/i.test(url)) {
        target = toApiUrl(url);
      }

      if (target) {
        if (isRequestObj) {
          const req = new Request(target, input);
          return origFetch(req, init);
        }
        return origFetch(target, init);
      }

      return origFetch(input, init);
    } catch {
      return origFetch(input, init);
    }
  };
})();

// ========== Patch em XMLHttpRequest (pega axios) ==========
(function patchXHR() {
  if (typeof XMLHttpRequest === 'undefined') return;
  const origOpen = XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      let newUrl = url;

      // 1) http://localhost:3001/...
      if (/^https?:\/\/(localhost|127\.0\.0\.1):3001\//i.test(url)) {
        const restPath = url.replace(/^https?:\/\/[^/]+/i, '');
        newUrl = toApiUrl(restPath);
      }
      // 2) Rotas de API sem /api
      else if (/^\/(analises|lancamentos|dashboard|investimentos|planos|planejamentos|patrimonio|proventos|regras|indices|importacoes|benchmarks|valores)\b/i.test(url)) {
        newUrl = toApiUrl(url);
      }
      // 3) Já vem como /api quando a base também termina com /api → evita duplicar
      else if (/^\/api\b/i.test(url) && /\/api$/i.test(API_BASE)) {
        newUrl = `${API_BASE}${url.slice(4)}`;
      }

      return origOpen.call(this, method, newUrl, ...rest);
    } catch {
      return origOpen.call(this, method, url, ...rest);
    }
  };
})();