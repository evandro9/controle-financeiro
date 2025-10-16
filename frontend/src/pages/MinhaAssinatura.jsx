// src/pages/MinhaAssinatura.jsx
import React from "react";
import { usePlan } from "../context/PlanContext.jsx";
import { BadgeCheck, CreditCard, Shield, Star, AlertTriangle  } from "lucide-react";

export default function MinhaAssinatura() {
  const { sub, ents, loading } = usePlan();
  const ativo = sub?.status === "active";
  const proxima = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const isPremium = ents?.premium === 'true' || ents?.investimentos === 'true';
  const nivelPlano = isPremium ? 'Premium' : 'Básico';

  // Mapeia rótulo e aviso por status
  const status = sub?.status || 'none';
  const statusLabel = ativo
    ? 'Ativa'
    : status === 'canceled'
      ? 'Assinatura Cancelada'
      : status === 'expired'
        ? 'Assinatura Expirada'
        : status === 'past_due'
          ? 'Pagamento em atraso'
          : 'Sem assinatura';

  const alertText = !ativo && (status === 'canceled'
    ? 'Sua assinatura foi cancelada. Para continuar usando os recursos, reative seu plano.'
    : status === 'expired'
      ? 'Sua assinatura expirou. Reative para voltar a acessar todos os recursos.'
      : status === 'past_due'
        ? 'Pagamento em atraso. Regularize para evitar a suspensão dos recursos.'
        : 'Você não possui uma assinatura ativa no momento.');  

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Banner de status (inativo) */}
      {!ativo && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">Atenção: {statusLabel}</div>
            <div className="text-sm">{alertText}</div>
            <div className="pt-2 flex gap-2">
              <a href="/#planos" className="inline-flex h-9 items-center px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
                Ver planos
              </a>
              <a href="/#planos" className="inline-flex h-9 items-center px-3 rounded-lg border border-gray-300 dark:border-darkBorder bg-white dark:bg-darkBg text-gray-800 dark:text-darkText">
                Assinar agora
              </a>
            </div>
          </div>
        </div>
      )}      
      <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
        <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center gap-2 text-gray-800 dark:text-darkText">
          <Shield className="w-5 h-5 text-emerald-600" />
          Minha Assinatura
        </h2>
        <p className="text-sm text-gray-600 dark:text-darkMuted">
          Veja o status do seu plano e os recursos liberados.
        </p>
        <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      </section>

      <section className="bg-white dark:bg-darkCard rounded-xl shadow-md border border-gray-100 dark:border-darkBorder p-5">
        {loading ? (
          <div className="text-sm text-gray-600 dark:text-darkMuted">Carregando…</div>
        ) : (
          <div className="space-y-4">
            {/* Nível do plano: Básico / Premium */}
            <div className="flex items-center gap-3">
              <Star className={`w-5 h-5 ${isPremium ? 'text-amber-500' : 'text-gray-400'}`} />
              <div>
                <div className="text-sm text-gray-500 dark:text-darkMuted">Nível do plano</div>
                <div className="text-base font-semibold text-gray-800 dark:text-darkText">
                  {nivelPlano}
                </div>
              </div>
            </div>            
            <div className="flex items-center gap-3">
              <BadgeCheck className={`w-5 h-5 ${ativo ? 'text-emerald-500' : 'text-rose-500'}`} />
              <div>
                <div className="text-sm text-gray-500 dark:text-darkMuted">Status</div>
                <div className="text-base font-semibold text-gray-800 dark:text-darkText">
                  {statusLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-indigo-500" />
              <div>
                <div className="text-sm text-gray-500 dark:text-darkMuted">Plano</div>
                <div className="text-base font-semibold text-gray-800 dark:text-darkText">
                  {sub?.plan ? sub.plan.toUpperCase() : '—'}
                </div>
                {proxima && (
                  <div className="text-xs text-gray-500 dark:text-darkMuted mt-1">
                    Próxima renovação: {proxima.toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <a href="#planos" className="inline-flex h-10 items-center px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
                Ver planos
              </a>
              {!ativo && (
                <a href="#planos" className="inline-flex h-10 items-center px-4 rounded-lg border border-gray-300 dark:border-darkBorder bg-white dark:bg-darkBg text-gray-800 dark:text-darkText">
                  Assinar agora
                </a>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}