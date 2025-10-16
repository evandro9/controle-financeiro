export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
const API_URL = API_BASE;

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
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, senha })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Erro no login');
  }

  return res.json();
}
