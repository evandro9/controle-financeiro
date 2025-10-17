import React, { useState, useEffect, useContext, useRef } from "react";
import { Menu } from "lucide-react";
import BannerDemo from "../BannerDemo";
import BannerAssinatura from '../BannerAssinatura';
import { initIdleLogout, registrarAtividade, setAccessToken, API_BASE } from '../../services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThemeContext } from "../../context/ThemeContext";

/**
 * AppShell
 * - Header fixo
 * - Sidebar fixa no desktop (≥ lg)
 * - Sidebar em drawer no mobile
 * - Área de conteúdo com container responsivo
 *
 * Uso:
 * <AppShell sidebar={<Sidebar/>}>
 *   {...conteúdo da página/rotas...}
 * </AppShell>
 */
export default function AppShell({ sidebar, children, headerOverride, headerRight }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const location = useLocation();
  const { isThemeReady } = useContext(ThemeContext) || {};
  const navigate = useNavigate();
  const gate = !isThemeReady; // evita alterar ordem de hooks (sem early return)
  const [checkingConsent, setCheckingConsent] = useState(false);

  // Inatividade: desloga após X minutos sem ação do usuário (sem refresh)
  useEffect(() => {
    const idleMin = Number(import.meta.env.VITE_IDLE_MINUTES) || 15;
    initIdleLogout({
      minutos: idleMin,
      onLogout: () => {
        try { setAccessToken(null); } catch {}
        window.location.assign('/login');
      }
    });
  }, []);

  // Troca de rota conta como atividade
  useEffect(() => {
    registrarAtividade();
  }, [location.key]);

    // Gate de reaceite (Termos/Privacidade): checa ANTES de montar children
  useEffect(() => {
    (async () => {
      try {
        const path = location?.pathname || '';
        // Evita loop em rotas públicas e na própria página de aceite
        if (path.startsWith('/login') || path.startsWith('/legal/')) {
          setCheckingConsent(false);
          return;
        }
        const token = localStorage.getItem('token');
        if (!token) { setCheckingConsent(false); return; }
        setCheckingConsent(true);
        const r = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) { setCheckingConsent(false); return; }
        const j = await r.json();
        if (j && j.requiresConsent) {
          // ✅ guarda para onde devemos voltar depois do aceite
          try {
            if (!path.startsWith('/legal/')) {
              localStorage.setItem('afterConsentRedirect', path || '/dashboard');
            }
          } catch {}      
          // 🔒 desliga tours imediatamente (antes de navegar)
          try {
            localStorage.setItem('DISABLE_TOUR', '1');
            window.__DISABLE_TOUR__ = true;
          } catch {}    
          navigate('/legal/aceite', { replace: true });
        } else {
          setCheckingConsent(false);          
        }
      } catch {}
      setCheckingConsent(false);
    })();
  }, [location.pathname, navigate]);

  // --- demo detection + banner state ---
const [isDemo, setIsDemo] = useState(false);
const [showDemoBanner, setShowDemoBanner] = useState(false);

useEffect(() => {
  let flag = false;
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const [, b64] = token.split('.');
      if (b64) {
        const payload = JSON.parse(atob(b64));
        const pid = payload?.id;
        const pmail = (payload?.email || '').toLowerCase();
        flag = pid === 0 || String(pid) === '0' || pmail === 'demo@site.com';
      }
    }
  } catch {}
  if (!flag) {
    const uid = localStorage.getItem('usuarioId');
    const email = (localStorage.getItem('emailUsuario') || '').toLowerCase();
    flag = uid === '0' || email === 'demo@site.com';
  }
  setIsDemo(flag);
}, []);

useEffect(() => {
  if (isDemo && localStorage.getItem('hideDemoBanner') !== '1') {
    setShowDemoBanner(true);
  }
}, [isDemo]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {gate ? (
        // Gate de tema: tela neutra com spinner (sem quebrar ordem dos hooks)
        <div className="fixed inset-0 flex items-center justify-center bg-white text-gray-700 dark:bg-[#0f1115] dark:text-gray-200">
          <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-transparent animate-spin dark:border-gray-600"></div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex">
            {/* Sidebar desktop (cola no topo da janela) */}
            <aside className="hidden lg:block shrink-0 h-dvh">
              {sidebar /* desktop: sem onRequestClose (não é drawer) */}
            </aside>

            {/* Coluna da direita: header (sticky) + conteúdo */}
            <div className="flex-1 h-dvh flex flex-col overflow-x-hidden">
              <header className="sticky top-0 z-40 h-14 bg-card/70 backdrop-blur px-3 sm:px-4 lg:px-6 flex items-center relative">
                {/* Botão menu só no mobile */}
                <button
                  data-tour="sidebar-toggle-mobile"
                  className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border hover:bg-accent/20 transition translate-y-[6px] ml-2"
                  onClick={() => setOpen(true)}
                  aria-label="Abrir menu"
                >
                  <Menu className="size-5" />
                </button>
                {isDemo && showDemoBanner && (
                  /* Mostra o aviso no header somente ≥ sm (no mobile, fica oculto) */
                  <div className="hidden sm:flex mt-0 absolute inset-0 items-center justify-center pointer-events-none" aria-live="polite">
                    <div className="pointer-events-auto w-fit max-w-[min(92vw,900px)]">
                      <div className="flex items-center gap-3 rounded-xl border px-3 py-1.5 text-sm shadow-sm
                                      bg-amber-50 text-amber-900 border-amber-300
                                      dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800">
                        <span className="uppercase tracking-wide text-[10px] font-semibold rounded-md px-1.5 py-0.5
                                         bg-amber-200/70 text-amber-900
                                         dark:bg-amber-900/40 dark:text-amber-100">
                          Conta demo
                        </span>
                        <span className="hidden sm:inline whitespace-nowrap">
                          Alguns dados podem apresentar falhas e serão resetados periodicamente.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="ml-auto h-full flex items-center gap-2">
                  {headerRight ?? headerOverride ?? (
                    <div className="font-semibold select-none">Meu Orçamento</div>
                  )}
                </div>
              </header>

              {/* ⚠️ min-h-0 + overflow-auto: evita scroll no body quando não há conteúdo */}
              <main className="flex-1 min-h-0 overflow-auto">
                <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-4 lg:px-6 py-0">
                  {/* Banner de assinatura agora no conteúdo, com respiro do topo */}
                  <div className="pt-3 sm:pt-4">
                    <BannerAssinatura />
                  </div>
                  <div className="flex-1 overflow-y-auto pb-16 sm:pb-20">
                    {/* ✅ só monta children após checar o gate */}
                    {!checkingConsent && children}
                  </div>
                </div>
              </main>
              {/* Banner mobile (aparece só em < sm) */}
              <BannerDemo />
            </div>
          </div>

          {/* Drawer mobile (animação + overlay que fecha) */}
          <div
            className={`lg:hidden fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`}
            role="dialog"
            aria-modal="true"
            aria-hidden={!open}
          >
            {/* Overlay em forma de botão: cobre 100% e SEMPRE fecha */}
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
              className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
            />

            {/* Painel com slide da esquerda (sem pseudo-elemento) */}
            <div
              ref={panelRef}
              className={[
                "absolute left-0 top-0 w-auto inline-block bg-card overflow-hidden shadow-none",
                "transform-gpu will-change-transform transition-transform motion-safe:duration-300",
                open ? "translate-x-0 ease-out" : "-translate-x-full ease-in",
              ].join(" ")}
              onClick={(e) => {
                // clicar em link/trigger navega e fecha
                const el = e.target.closest('a,[data-nav],[data-close-on-click]');
                if (el) setOpen(false);
              }}
            >
              <div className="h-[100dvh] overflow-y-auto no-scrollbar px-3 [-webkit-overflow-scrolling:touch]">
                {React.isValidElement(sidebar)
                  ? React.cloneElement(sidebar, { onRequestClose: () => setOpen(false) })
                  : sidebar}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}