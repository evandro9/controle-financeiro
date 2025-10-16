// Hook sem JSX e sem renderização. Ele apenas:
//  - Lê/atualiza status via API (ou fallback localStorage)
//  - Aplica a regra mobile/desktop
//  - Expõe helpers para o TourProvider decidir abrir/fechar mantendo seu layout atual

// --- Helpers de persistência API ---
async function apiGetStatus(keys = []) {
  try {
    const token = localStorage.getItem('token');
    const qs = encodeURIComponent(keys.join(','));
    const res = await fetch(`/api/user-tours/status?keys=${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json(); // { status: { [key]: { completed, dont_show } } }
  } catch {
    return null; // força fallback local
  }
}

async function apiUpdate(key, payload) {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/user-tours/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key, ...payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// 🔒 Mesmo gate global usado no Provider
function isTourGloballyDisabled() {
  try {
    if (typeof window !== 'undefined') {
      if (window.__DISABLE_TOUR__ === true) return true;
      const p = window.location?.pathname || '';
      if (p && p.startsWith('/legal/')) return true;
    }
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem('DISABLE_TOUR') === '1') return true;
    }
  } catch {}
  return false;
}

// --- Fallback localStorage (caso API indisponível) --- (usa as MESMAS chaves do TourProvider)
function getUid() {
  try { return localStorage.getItem('usuarioId') || 'anon'; } catch { return 'anon'; }
}
function LS_DONE(key, uid)     { return `tour_done::${key}::${uid}`; }
function LS_DONTSHOW(key, uid) { return `tour_dontshow::${key}::${uid}`; }
const readLocal = (key) => {
  const uid = getUid();
  return {
    completed: localStorage.getItem(LS_DONE(key, uid)) === '1',
    dont_show: localStorage.getItem(LS_DONTSHOW(key, uid)) === '1',
  };
};
const writeLocal = (key, { completed, dont_show }) => {
  const uid = getUid();
  if (typeof completed === 'boolean') {
    completed ? localStorage.setItem(LS_DONE(key, uid), '1') : localStorage.removeItem(LS_DONE(key, uid));
  }
  if (typeof dont_show === 'boolean') {
    dont_show ? localStorage.setItem(LS_DONTSHOW(key, uid), '1') : localStorage.removeItem(LS_DONTSHOW(key, uid));
  }
};

export default function useFirstLoginTour(key, steps) {
  const normalizedKey = String(key || '');
  const desktopKey = normalizedKey.replace(/_mobile_/i, '_'); // emparelha variações

  async function loadStatus() {
    const res = await apiGetStatus([desktopKey]);
    if (res && res.status && res.status[desktopKey]) {
      return {
        completed: !!res.status[desktopKey].completed,
        dont_show: !!res.status[desktopKey].dont_show,
      };
    }
    // fallback local
    return readLocal(desktopKey);
  }

  // Regra:
  //  - Desktop: mostra se !completed && !dont_show
  //  - Mobile: mostra enquanto !completed && !dont_show (aviso simples) — o TourProvider decide layout
  async function shouldShow({ isMobile } = {}) {
    if (isTourGloballyDisabled()) return false;
    const { completed, dont_show } = await loadStatus();
    if (isMobile) return !(completed || dont_show);
    return !(completed || dont_show);
  }

  async function markCompleted({ platform } = {}) {
    const ok = await apiUpdate(desktopKey, { completed: true, platform: platform || (isMobileEnv() ? 'mobile' : 'desktop') });
    if (!ok) writeLocal(desktopKey, { completed: true });
    return true;
  }

  async function markDontShow({ platform } = {}) {
    const ok = await apiUpdate(desktopKey, { dont_show: true, platform: platform || (isMobileEnv() ? 'mobile' : 'desktop') });
    if (!ok) writeLocal(desktopKey, { dont_show: true });
    return true;
  }

  // Dispara abertura no Provider via evento/global
  function startWithProvider(k, s, opts) {
    try {
      if (typeof window !== 'undefined') {
        if (typeof window.__startTour === 'function') {
          window.__startTour(k, s, opts || {});
          return true;
        }
        const ev = new CustomEvent('tour:start', { detail: { key: k, steps: s, opts } });
        window.dispatchEvent(ev);
        return true;
      }
    } catch {}
    return false;
  }

  async function maybeStart(opts = {}) {
    if (isTourGloballyDisabled()) return false; 
    const toShow = await shouldShow(opts);
    if (toShow) {
      const s = Array.isArray(steps) ? steps : [];
      startWithProvider(normalizedKey, s, opts);
    }
    return toShow;
  }

  function isMobileEnv() {
    if (typeof navigator === 'undefined') return false;
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  return {
    // leitura/decisão
    loadStatus,
    shouldShow,
    maybeStart,
    // gravação
    markCompleted,
    markDontShow,
  };
}