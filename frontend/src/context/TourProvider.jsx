import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Joyride, { STATUS, EVENTS, ACTIONS } from 'react-joyride';

/**
 * TourProvider
 * - startTour(tourKey, steps, opts?): dispara um tour identificado (ex.: 'balanco_v1')
 * - hasCompleted(tourKey, userId?): true/false
 * - complete(tourKey, userId?): marca como concluído
 *
 * Armazena conclusão por usuário (localStorage: tour_done::<tourKey>::<userId|anon>).
 * Envia eventos para dataLayer (GTM) se existir.
 */
const TourCtx = createContext(null);

// 🔒 Gate global para desativar tours (consent, telas especiais, etc.)
function isTourDisabled() {
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

// Helper: detectar mobile por UA (para esconder o botão "Não mostrar novamente" no mobile)
function isMobileEnv() {
  try {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

// Lê o tema a partir da classe no <html>
function getIsDark() {
  try {
    return document.documentElement.classList.contains('dark');
  } catch {
    return false;
  }
}

/**
 * Tooltip customizado (Tailwind) em PT-BR com “Passo X de Y”.
 * Mantém coerência visual com o sistema nas variantes dark/light.
 */
function TooltipPT(props) {
  const {
    continuous,
    index,
    isLastStep,
    size,
    step,
    backProps,
    closeProps,
    primaryProps,
    skipProps,
    tooltipProps,
    // arrowProps // (se quiser seta/“flecha”, dá pra implementar aqui depois)
  } = props;

  const nextLabel = isLastStep ? 'Concluir' : 'Próximo';
  const stepText = `Passo ${index + 1} de ${size}`;

  return (
    <div
      {...tooltipProps}
      className={[
        // container
        // largura responsiva: ocupa quase toda a tela no mobile e limita em 420px no desktop
        'z-[10001] w-[92vw] max-w-[420px] sm:w-auto rounded-2xl border shadow-2xl',
        // light
        'bg-white text-gray-800 border-gray-200',
        // dark
        'dark:bg-[#0f172a] dark:text-gray-100 dark:border-gray-700', // slate-900 aprox
      ].join(' ')}
      style={{ padding: 0 }}
    >
      {/* header centralizado */}
      <div className="relative px-4 py-3 border-b border-gray-100 dark:border-gray-700 rounded-t-2xl">
        {step.title && (
          <h4 className="text-[15px] font-semibold leading-5 text-center">
            {step.title}
          </h4>
        )}
        <button
          {...closeProps}
          aria-label="Fechar"
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-xl
                     text-gray-500 hover:text-gray-700 hover:bg-gray-100
                     dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        >
          ×
        </button>
      </div>

      {/* conteúdo centralizado, sem truncar no mobile */}
      <div className="px-4 pt-3 pb-2 text-[14px] leading-relaxed text-center">{step.content}</div>

      {/* footer */}
      <div className="flex items-center justify-between gap-3 px-4 pt-1">
        <span className="text-[12px] text-gray-500 dark:text-gray-400">
          {stepText}
        </span>
        <div className="flex items-center gap-2">
          <button
            {...skipProps}
            title="Pular"
            className="rounded-xl border px-3 py-2 text-sm
                       border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100
                       dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
          >
            Pular
          </button>

          {index > 0 && (
            <button
              {...backProps}
              title="Voltar"
              className="rounded-xl border px-3 py-2 text-sm
                         border-gray-300 text-gray-700 hover:bg-gray-100
                         dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Voltar
            </button>
          )}

          {continuous && (
            <button
              {...primaryProps}
              title={nextLabel}
              className="rounded-xl border px-3.5 py-2 text-sm font-semibold
                         border-emerald-500 bg-emerald-500 text-white
                         hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            >
              {nextLabel}
            </button>
          )}
        </div>
      </div>
      {!isMobileEnv() && (
        <div className="px-4 pb-4 mt-2 flex justify-center">
          {/* Checkbox no padrão do projeto (span absoluto + peer + group), centralizado e fonte levemente maior */}
          <label className="group relative inline-flex items-center text-[13px] text-gray-700 dark:text-darkText select-none">
            <input
              type="checkbox"
              className="peer sr-only"
              onChange={(e) => {
                try {
                  const ev = new CustomEvent('tour:dontshow:toggle', { detail: { checked: !!e.target.checked } });
                  window.dispatchEvent(ev);
                } catch {}
              }}
            />
            <span
              className="
                absolute left-0 h-4 w-4 rounded-[4px] border border-gray-300 bg-white shadow-sm
                transition-colors duration-150 ease-out
                group-hover:border-blue-400
                peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/60
                peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white
                peer-checked:bg-blue-600 peer-checked:border-blue-600
                dark:border-darkBorder dark:bg-darkBg
                dark:group-hover:border-blue-400/70
                dark:peer-focus-visible:ring-offset-darkBg
              "
              aria-hidden="true"
            />
            {/* check overlay (mesmo padrão do ImportarConciliar) */}
            <svg
              className="pointer-events-none absolute left-[2px] top-[4px] h-3 w-3 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>            
            <span className="pl-6">Não mostrar novamente</span>
          </label>
        </div>
      )}
    </div>
  );
}

function storageKey(tourKey, userId) {
  const uid = userId || 'anon';
  return `tour_done::${tourKey}::${uid}`;
}

function pushDL(eventName, payload = {}) {
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...payload });
  } catch (e) {
    // silencioso
  }
}

export function TourProvider({ children, getUserId }) {
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState([]);
  const [tourKey, setTourKey] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [dontShowFlag, setDontShowFlag] = useState(false);
  const optionsRef = useRef({}); // opções do tour atual
  const [isDark, setIsDark] = useState(getIsDark());

  // Ouve mudanças do checkbox "Não mostrar novamente"
  useEffect(() => {
    function onDontShowToggle(ev) {
      try {
        setDontShowFlag(!!(ev && ev.detail && ev.detail.checked));
      } catch {}
    }
    window.addEventListener('tour:dontshow:toggle', onDontShowToggle);
    return () => window.removeEventListener('tour:dontshow:toggle', onDontShowToggle);
  }, []);  

  const userId = useMemo(() => {
    try {
      return typeof getUserId === 'function' ? getUserId() : null;
    } catch {
      return null;
    }
  }, [getUserId]);

  const hasCompleted = useCallback((key, uid = userId) => {
    try {
      return localStorage.getItem(storageKey(key, uid)) === '1';
    } catch {
      return false;
    }
  }, [userId]);

  const complete = useCallback((key, uid = userId) => {
    try {
      localStorage.setItem(storageKey(key, uid), '1');
    } catch {}
  }, [userId]);

  const startTour = useCallback((key, tourSteps, opts = {}) => {
    // 🚫 Não inicia tours quando o gate estiver ativo (ex.: /legal/aceite)
    if (isTourDisabled()) {
      // opcional: console.debug('[tour] bloqueado por gate/legal');
      return false;
    }    
    setTourKey(key);
    setSteps(tourSteps);
    optionsRef.current = opts;
    setStepIndex(0);
    setDontShowFlag(false);
    setRun(true);
    pushDL('tour_start', { tourKey: key, userId });
    return true;
  }, [userId]);

  const stopTour = useCallback(() => {
    setRun(false);
  }, []);

    // Observar mudanças na classe 'dark' (modo escuro/claro)
  useEffect(() => {
    let observer;
    try {
      observer = new MutationObserver(() => setIsDark(getIsDark()));
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch {}
    const onStorage = () => setIsDark(getIsDark());
    window.addEventListener('storage', onStorage);
    return () => {
      try { observer && observer.disconnect(); } catch {}
      window.removeEventListener('storage', onStorage);
    };
  }, []);

    // ⛔ Se o gate ficar ativo enquanto um tour estiver rodando, encerra imediatamente
  useEffect(() => {
    if (run && isTourDisabled()) {
      setRun(false);
    }
  }, [run]);

  // Reage a mudanças de storage (ex.: DISABLE_TOUR setado em outro lugar)
  useEffect(() => {
    function onStorage(e) {
      try {
        if (e && e.key === 'DISABLE_TOUR' && e.newValue === '1') {
          setRun(false);
        }
      } catch {}
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Estilos do Joyride (apenas o que NÃO é o tooltip — que já customizamos por componente).
   * Mantemos z-index alto e calibramos a overlay para cada tema.
   */
  const themeStyles = useMemo(() => {
    return isDark
      ? {
          options: {
            zIndex: 10000,             // tooltip tem z-[10001]
            arrowColor: '#1f2937',     // seta escura no dark
          },
          overlay: { backgroundColor: 'rgba(0,0,0,0.55)' },
          spotlight: { borderRadius: 12, padding: 6 },
        }
      : {
          options: {
            zIndex: 10000,
            arrowColor: '#ffffff',     // seta clara no light
          },
          overlay: { backgroundColor: 'rgba(2,6,23,0.25)' },
          spotlight: { borderRadius: 12, padding: 6 },
        };
  }, [isDark]);

  // Destaque sutil na seta via React Floater (drop-shadow)
  const floaterStyles = useMemo(() => {
    return isDark
      ? {
          arrow: { color: '#1f2937', length: 14, spread: 28 }, // maior e um tom + claro
          container: { filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.45)) drop-shadow(0 0 2px rgba(255,255,255,0.18))' },
        }
      : {
            arrow: { color: '#ffffff', length: 14, spread: 28 },
          container: { filter: 'drop-shadow(0 0 1px rgba(2,6,23,0.25)) drop-shadow(0 0 2px rgba(2,6,23,0.12))' },
        };
  }, [isDark]);

  const value = useMemo(() => ({
    startTour, stopTour, hasCompleted, complete, userId
  }), [startTour, stopTour, hasCompleted, complete, userId]);

  // Bridge global + listener de evento para iniciar o tour "de fora" (ex.: hooks)
  useEffect(() => {
    function onStart(ev) {
      try {
        const { key, steps, opts } = (ev && ev.detail) || {};
        if (key && Array.isArray(steps)) startTour(key, steps, opts || {});
      } catch {}
    }
    function onStop() {
      try { setRun(false); } catch {}
    }    
    try { window.__startTour = (k, s, o) => startTour(k, s, o || {}); } catch {}
    window.addEventListener('tour:stop', onStop);
    return () => {
      window.removeEventListener('tour:stop', onStop);
      try { delete window.__startTour; } catch {}
    };
  }, [startTour]);

  const handleCallback = (data) => {
    const { status, type, action, index } = data;

    // Antes de mostrar um passo: permite rodar side-effects do passo atual (ex.: abrir sidebar)
    if (type === EVENTS.STEP_BEFORE) {
      try {
        const step = steps?.[index];
        const fn = step?.meta && typeof step.meta.onEnter === 'function' ? step.meta.onEnter : null;
        if (fn) fn();
      } catch {}
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
      pushDL('tour_step', { tourKey, stepIndex: index, action });
    }
    const finished = [STATUS.FINISHED, STATUS.SKIPPED].includes(status);
    const closed = action === ACTIONS.CLOSE || type === EVENTS.TOUR_END;
    if (finished || closed) {
      // Marcar como concluído apenas quando FINISHED; SKIPPED não marca.
      if (status === STATUS.FINISHED && tourKey) {
        complete(tourKey, userId);
         pushDL('tour_finish', { tourKey, userId, status: 'FINISHED' });
        // Persistência no backend (completed=true)
        try {
          const token = localStorage.getItem('token');
          const platform = isMobileEnv() ? 'mobile' : 'desktop';
          fetch('/api/user-tours/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ key: tourKey, completed: true, platform }),
          }).catch(() => {});
        } catch {}        
        // 🔒 Persistência no backend (mantém padrão: auth via token)
        try {
          const token = localStorage.getItem('token');
          fetch('/api/user-tours/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ key: tourKey, completed: true, platform: (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) ? 'mobile' : 'desktop' }),
          }).catch(() => {});
        } catch {}        
      } else {
        const label = closed ? 'CLOSED' : 'SKIPPED';
        pushDL('tour_finish', { tourKey, userId, status: label });
        // Se marcou "Não mostrar novamente" e encerrou por Pular ou Fechar → dont_show=true
        if (tourKey && dontShowFlag) {
          try {
            const token = localStorage.getItem('token');
            const platform = isMobileEnv() ? 'mobile' : 'desktop';
            fetch('/api/user-tours/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ key: tourKey, dont_show: true, platform }),
            }).catch(() => {});
          } catch {}
          // Fallback local: impede reabrir mesmo que a API falhe
          try {
            const uid = userId || localStorage.getItem('usuarioId') || 'anon';
            localStorage.setItem(`tour_dontshow::${tourKey}::${uid}`, '1');
          } catch {}          
        }
      }
      setRun(false);
    }
  };

  // Localizações PT-BR e estilos neutros (seguem Tailwind dark/light)
  const joyrideLocale = {
    back: 'Voltar',
    close: 'Fechar',
    last: 'Concluir',
    next: 'Próximo',
    open: 'Abrir',
    skip: 'Pular',
  };

  const spotlightPadding = 6;

  return (
    <TourCtx.Provider value={value}>
      {children}
      <Joyride
        run={run && !isTourDisabled()}
        steps={steps}
        stepIndex={stepIndex}
        continuous
        scrollToFirstStep
        showSkipButton
        showProgress={false}
        disableOverlayClose={false}
        spotlightClicks
        locale={joyrideLocale}
        callback={handleCallback}
        tooltipComponent={TooltipPT}
        // Passa estilos direto para o react-floater (inclui arrow e drop-shadow)
        floaterProps={{ styles: floaterStyles }}        
        styles={themeStyles}
      />
      {/* Contorno extra da seta (garante visibilidade no dark e no light) */}
     <style>{`
        /* classe do react-floater usada pelo Joyride */
        .react-floater .react-floater__arrow{
          transition: filter .2s ease;
        }
        html.dark .react-floater .react-floater__arrow{
          filter: drop-shadow(0 0 1px rgba(255,255,255,.50))
                  drop-shadow(0 0 2px rgba(255,255,255,.20));
        }
        html:not(.dark) .react-floater .react-floater__arrow{
          filter: drop-shadow(0 0 1px rgba(2,6,23,.25)) drop-shadow(0 0 2px rgba(2,6,23,.12));
        }
      `}</style>
    </TourCtx.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourCtx);
  if (!ctx) throw new Error('useTour must be used within <TourProvider/>');
  return ctx;
}