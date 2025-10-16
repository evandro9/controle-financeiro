import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * BannerGlobal de status da assinatura (versão com MAIS DESTAQUE)
 * - Exibe quando a assinatura não está ativa/expirada
 * - CTA: "Minhas assinaturas" → /dashboard/assinatura
 * - Reaparece após novo login (usa iat do JWT na chave de dismiss)
 * - Discreto no layout (largura limitada e respiro do topo), mas chamativo visualmente
 */
export default function BannerAssinatura() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [dismissKey, setDismissKey] = React.useState('banner_assinatura_dismissed');
  const [animateIcon, setAnimateIcon] = React.useState(true);
  const location = useLocation();

  // Calcula chave de dismiss por login (iat) e lê estado inicial
  React.useEffect(() => {
    let key = 'banner_assinatura_dismissed';
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const [, b64] = token.split('.');
        const payload = b64 ? JSON.parse(atob(b64)) : null;
        const iat = payload?.iat;
        if (iat) key = `banner_assinatura_dismissed_${iat}`;
      }
    } catch {}
    setDismissKey(key);
    setDismissed(sessionStorage.getItem(key) === '1');
  }, [location.key]);

  // Busca status (também após navegação, ex.: pós-login)
  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch('/api/assinatura/status', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { setError(`HTTP ${res.status}`); setLoading(false); return; }
        const json = await res.json();
        setData(json);
      } catch (e) { setError(String(e)); }
      finally { setLoading(false); }
    })();
  }, [location.key]);

  // Anima o ícone só nos primeiros segundos para chamar atenção sem ser irritante
  React.useEffect(() => {
    if (!dismissed) {
      const t = setTimeout(() => setAnimateIcon(false), 3000);
      return () => clearTimeout(t);
    }
  }, [dismissed]);

  if (loading || dismissed) return null;
  if (error) return null;
  if (!data) return null;

  const status = String(data.status || '').toLowerCase();
  const ativo  = Boolean(data.ativo);
  if (ativo && status === 'active') return null;

  // Mensagem
  let titulo = 'Sua assinatura não está ativa';
  let detalhe = 'Alguns recursos podem ficar indisponíveis.';
  if (status === 'canceled') {
    titulo = 'Sua assinatura foi cancelada';
    detalhe = 'Renove para voltar a acessar todos os recursos.';
  } else if (status === 'past_due') {
    titulo = 'Pagamento em atraso';
    detalhe = 'Atualize o pagamento para evitar bloqueios.';
  } else if (status === 'incomplete' || status === 'incomplete_expired') {
    titulo = 'Assinatura incompleta';
    detalhe = 'Conclua a ativação para liberar os recursos.';
  } else if (status === 'trialing') {
    titulo = 'Período de testes';
    detalhe = 'Ao final do período, será necessário ativar a assinatura.';
  }

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  return (
    <div
      className="w-full max-w-[min(92vw,900px)] mx-auto relative
                 rounded-xl border
                 bg-gradient-to-r from-amber-50 to-amber-100
                 dark:from-amber-900/40 dark:to-amber-800/40
                 border-amber-200 dark:border-amber-800
                 ring-1 ring-amber-300/60 dark:ring-amber-700/60
                 shadow-sm shadow-amber-200/50 dark:shadow-amber-900/40
                 px-3 sm:px-4 py-2.5 sm:py-3 mt-2 sm:mt-3 mb-3"
      role="alert"
      aria-live="polite"
    >
      {/* Barra de destaque lateral */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl
                   bg-gradient-to-b from-amber-400 to-amber-600
                   dark:from-amber-300 dark:to-amber-500"
      />
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <AlertTriangle
            className={`h-5 w-5 sm:h-6 sm:w-6 text-amber-700 dark:text-amber-300 ${animateIcon ? 'animate-bounce' : ''}`}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] sm:text-xs uppercase tracking-wide
                             font-bold text-amber-800 dark:text-amber-200
                             bg-amber-200/70 dark:bg-amber-700/40
                             px-1.5 py-0.5 rounded">
              Atenção
            </span>
            <p className="text-sm sm:text-[0.95rem] font-semibold
                          text-amber-900 dark:text-amber-50 truncate">
              {titulo}
            </p>
          </div>
          <p className="text-xs sm:text-sm text-amber-900/80 dark:text-amber-100/80 truncate">
            {detalhe}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/dashboard/assinatura"
            className="inline-flex items-center rounded-md
                       bg-amber-300 dark:bg-amber-400
                       text-amber-950 dark:text-amber-950
                       px-3 py-1.5 text-xs sm:text-sm font-semibold
                       shadow hover:shadow-md
                       hover:bg-amber-400 dark:hover:bg-amber-300
                       focus:outline-none focus:ring-2 focus:ring-amber-500/60
                       transition"
          >
            Minhas assinaturas
          </Link>
          <button
            onClick={handleDismiss}
            aria-label="Fechar aviso"
            className="inline-flex items-center rounded-md border
                       border-amber-300 dark:border-amber-700
                       px-2 py-1 text-xs
                       text-amber-900 dark:text-amber-100
                       hover:bg-amber-100 dark:hover:bg-amber-800/50
                       focus:outline-none focus:ring-2 focus:ring-amber-500/40
                       transition"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}