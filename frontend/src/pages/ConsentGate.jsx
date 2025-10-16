import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ConsentGate() {
  const [termsChecked, setTermsChecked] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [versions, setVersions] = useState({ terms: 'v0', privacy: 'v0' });
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  
  // --- Tema: helpers ---
  function applyThemeFromLocalStorage() {
    try {
      const theme = localStorage.getItem('theme');
      const root = document.documentElement;
      if (theme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    } catch {}
  }

  async function syncThemeFromServerIfAvailable() {
    // Usa o endpoint real do projeto
    const token = localStorage.getItem('token') || '';
    try {
      const r = await fetch('/api/user-preferences/theme', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (r.ok) {
        const j = await r.json();
        const serverTheme = j?.theme;
        if (serverTheme === 'dark' || serverTheme === 'light') {
          try { localStorage.setItem('theme', serverTheme); } catch {}
          applyThemeFromLocalStorage();
          return;
        }
      }
    } catch {}
    // fallback: aplica o que já existir no localStorage
    applyThemeFromLocalStorage();
  }

  useEffect(() => {
    // Encerra qualquer tour pendente imediatamente
    try { window.dispatchEvent(new CustomEvent('tour:stop')); } catch {}    
    (async () => {
      try {
        const r = await fetch('/api/legal/versions');
        if (r.ok) {
          const j = await r.json();
          setVersions({
            terms: j.terms || 'v0',
            privacy: j.privacy || 'v0',
          });
        }
      } catch {}
    })();
  }, []);

  // 🔒 Liga o flag global ao montar (garantia extra) e limpa ao desmontar
  useEffect(() => {
    try {
      localStorage.setItem('DISABLE_TOUR', '1');
      window.__DISABLE_TOUR__ = true;
    } catch {}
    return () => {
      try {
        localStorage.removeItem('DISABLE_TOUR');
        delete window.__DISABLE_TOUR__;
      } catch {}
    };
  }, []);

  // ⏱️ Ao montar, já sincroniza e aplica o tema (evita piscar claro → escuro)
  useEffect(() => {
    syncThemeFromServerIfAvailable();
  }, []);

  async function aceitar() {
    if (!termsChecked || sending) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token') || '';
      const r = await fetch('/api/consents/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          terms: true,
          privacy: true,
          marketingOptIn: !!marketing,
        }),
      });
      if (r.ok) {
        // ✅ Reaplica o tema imediatamente antes de navegar (garante página destino no tema certo)
        applyThemeFromLocalStorage();
        // ✅ volta para a rota anterior ao gate, senão vai para /dashboard
        try {
          localStorage.removeItem('DISABLE_TOUR');
          delete window.__DISABLE_TOUR__;
        } catch {}
        let dest = '/dashboard';
        try {
          const stored = localStorage.getItem('afterConsentRedirect');
          if (stored && typeof stored === 'string') dest = stored;
        } catch {}
        try { localStorage.removeItem('afterConsentRedirect'); } catch {}
        navigate(dest, { replace: true });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center text-white">
      <div className="w-full max-w-lg border border-gray-700 rounded-xl p-6 bg-gray-800 shadow-xl">
        <h1 className="text-2xl font-semibold mb-1 text-white">Atualização de Termos</h1>
        <p className="text-sm text-gray-400 mb-4">
          Para continuar usando o sistema, confirme seu aceite aos documentos atualizados.
        </p>

        <div className="space-y-3 mb-6 text-sm">
          <label className="flex items-start gap-2 select-none cursor-pointer">
            <input
              type="checkbox"
              className="mt-1.5"
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
            />
            <span className="text-gray-300">
              Li e concordo com os{' '}
              <a className="text-orange-400 hover:underline" href="/legal/termos" target="_blank" rel="noreferrer">
                Termos de Uso (v{versions.terms})
              </a>{' '}
              e a{' '}
              <a className="text-orange-400 hover:underline" href="/legal/privacidade" target="_blank" rel="noreferrer">
                Política de Privacidade (v{versions.privacy})
              </a>.
            </span>
          </label>

          <label className="flex items-start gap-2 select-none cursor-pointer">
            <input
              type="checkbox"
              className="mt-1.5"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
            />
            <span className="text-gray-300">
              Aceito receber comunicações de marketing (opcional).
            </span>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
            disabled={!termsChecked || sending}
            onClick={aceitar}
          >
            {sending ? 'Salvando…' : 'Aceitar e continuar'}
          </button>
          <a
            className="px-4 py-2 rounded border border-gray-600 text-gray-300 hover:bg-gray-700"
            href="/logout"
          >
            Sair
          </a>
        </div>
      </div>
    </div>
  );
}