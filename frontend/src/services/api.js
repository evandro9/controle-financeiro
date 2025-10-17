// frontend/src/services/api.js

// =========================
// Base URL da API (inteligente)
// =========================
const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();

function buildApiBase(b) {
  if (!b) return '/api'; // fallback p/ dev
  const raw = b.replace(/\/+$/, ''); // tira barra no final

  // Se já termina com /api, mantém
  if (/\/api$/i.test(raw)) return raw;

  // Se a base aponta para o MESMO host do frontend (Vercel/domínio do app),
  // usamos /api porque o vercel.json faz o proxy.
  // Se aponta para um host de backend (Render etc.), NÃO adicionamos /api.
  try {
    const u = new URL(raw, window.location.origin);
    const host = u.hostname;
    const isFrontendHost =
      host === window.location.hostname || host.endsWith('.vercel.app');
    return isFrontendHost ? `${raw}/api` : raw;
  } catch {
    // Se não deu pra parsear (caminho relativo), trata como frontend
    return `${raw}/api`;
  }
}

export const API_BASE = buildApiBase(rawBase);
const API_URL = API_BASE;

if (!rawBase) {
  console.warn(
    '[API] VITE_API_BASE_URL não definido; usando fallback relativo "/api". ' +
    'Em produção isso chama o domínio do frontend e pode causar 405.'
  );
}

// =========================
// Sessão por INATIVIDADE
// =========================
const LS_TOKEN_KEY = 'token'; // mantém seu padrão atual
let __idleTimerId = null;
let __idleMs = 15 * 60 * 1000;
let __lastActivity = Date.now();
let __onLogout = null;

function __clearTimer() {
  if (__idleTimerId) clearTimeout(__idleTimerId);
  __idleTimerId = null;
}
function __schedule() {
  __clearTimer();
  const delta = Date.now() - __lastActivity;
  const left = Math.max(__idleMs - delta, 0);
  __idleTimerId = setTimeout(() => {
    const since = Date.now() - __lastActivity;
    if (since >= __idleMs) {
      try { localStorage.removeItem(LS_TOKEN_KEY); } catch {}
      if (typeof __onLogout === 'function') __onLogout();
      else window.location.assign('/login');
    } else {
      __schedule();
    }
  }, left);
}

export function registrarAtividade() {
  __lastActivity = Date.now();
  __schedule();
}

export function initIdleLogout({ minutos = 15, onLogout } = {}) {
  __idleMs = Math.max(1, Number(minutos)) * 60 * 1000;
  __onLogout = onLogout || null;

  // listeners de atividade (uma vez só)
  if (!window.__idleListenersInstalled) {
    const mark = () => registrarAtividade();
    ['pointerdown','keydown','mousemove','wheel','touchstart'].forEach(ev =>
      window.addEventListener(ev, mark, { passive: true })
    );
    window.addEventListener('focus', mark);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') mark();
    });
    window.__idleListenersInstalled = true;
  }

  registrarAtividade(); // agenda o timer inicial
}

// (opcional) helpers de token que algumas telas podem usar
export function getAccessToken() {
  try { return localStorage.getItem(LS_TOKEN_KEY) || null; } catch { return null; }
}
export function setAccessToken(token) {
  try {
    if (!token) localStorage.removeItem(LS_TOKEN_KEY);
    else localStorage.setItem(LS_TOKEN_KEY, token);
  } catch {}
}

export async function login(email, senha) {
  let res;
  try {
    res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: email, senha })
    });
  } catch (e) {
    throw new Error('Falha de rede ao tentar logar. Verifique sua conexão.');
  }

  if (!res.ok) {
    // tenta ler mensagem da API; se falhar, joga uma genérica
    let errorMsg = 'Erro no login';
    try {
      const error = await res.json();
      errorMsg = error.error || error.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

// ---- Compat Layer: corrige chamadas sem /api e localhost:3001 ----
(function patchFetchForApiProxy() {
  if (typeof window === 'undefined' || !window.fetch) return;
  const origFetch = window.fetch;

  const apiBases = [
    API_BASE,                                    // base calculada (vercel com /api, render sem /api)
    (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, ''), // raw base
  ].filter(Boolean);

  function toApiUrl(path) {
    // Se API_BASE termina com /api e a rota já começar com /api, evitamos duplicar
    const hasApiSuffix = /\/api$/i.test(API_BASE);
    if (path.startsWith('/api')) {
      return hasApiSuffix ? `${API_BASE}${path.slice(4)}` : `${API_BASE}${path}`;
    }
    // Rota sem /api (ex.: /analises/...): prefixa conforme API_BASE
    return hasApiSuffix ? `${API_BASE}${path}` : `${API_BASE}${path}`;
  }

  window.fetch = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';

      // 1) Corrige hardcodes para http://localhost:3001/...
      if (/^https?:\/\/(localhost|127\.0\.0\.1):3001\//i.test(url)) {
        const rest = url.replace(/^https?:\/\/[^/]+/, ''); // mantém o path original
        const target = toApiUrl(rest.startsWith('/api') ? rest : rest);
        return origFetch(target, init);
      }

      // 2) Corrige chamadas que começam sem /api mas são de API (ex.: /analises, /lancamentos, etc)
      //    Você pode ampliar a lista conforme necessário.
      const isApiNoPrefix = /^\/(analises|lancamentos|dashboard|investimentos|planos|planejamentos|patrimonio|proventos|regras|indices|importacoes|benchmarks|valores)/i.test(url);
      if (isApiNoPrefix) {
        const target = toApiUrl(url);
        return origFetch(target, init);
      }

      // 3) Se já está usando a própria base da API (Render ou Vercel), mantém
      if (apiBases.some((b) => b && url.startsWith(b))) {
        return origFetch(input, init);
      }

      // Caso contrário, segue normal
      return origFetch(input, init);
    } catch {
      return origFetch(input, init);
    }
  };
})();

  return res.json();
}