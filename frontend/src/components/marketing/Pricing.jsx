import React, { useMemo, useState } from "react";
import Reveal from "../ui/Reveal.jsx";
import { Layers, Crown } from "lucide-react";

function Toggle({ value, onChange }) {
  return (
    <div className="mx-auto mb-8 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-sm">
      <button
        type="button"
        onClick={() => onChange("semi")}
        className={`rounded-full px-3 py-1.5 transition ${
          value === "semi"
            ? "bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-900"
            : "text-white hover:bg-white/10"
        }`}
        aria-pressed={value === "semi"}
      >
        Semestral 
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={`rounded-full px-3 py-1.5 transition ${
          value === "annual"
            ? "bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-900"
            : "text-white hover:bg-white/10"
        }`}
        aria-pressed={value === "annual"}
      >
        <span className="flex items-center gap-1">
          Anual
        </span>
      </button>
    </div>
  );
}

export default function Pricing() {
  const [cycle, setCycle] = useState("annual"); // 'semi' | 'annual'
  const isAnnual = cycle === "annual";

  // Recomendação: preço âncora (eq. mensal) Basic 19,90 / Premium 29,90
  // Semestral: 6x esses equivalentes; Anual: 12x
  const pricing = {
    basic: { semiMonthly: 24.9, annualMonthly: 19.9 },
    premium: { semiMonthly: 39.9, annualMonthly: 27.9 },
  };

  const fmt = (n, opts = {}) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: opts.cents === false ? 0 : 2,
      maximumFractionDigits: opts.cents === false ? 0 : 2,
    }).format(n);

  const plans = useMemo(() => {
    const months = cycle === "annual" ? 12 : 6;
    return [
      {
        key: "basic",
        name: "Básico",
        highlight: false,
        monthlyEq: cycle === "annual" ? pricing.basic.annualMonthly : pricing.basic.semiMonthly,
        billedTotal: (cycle === "annual" ? pricing.basic.annualMonthly : pricing.basic.semiMonthly) * months,
        ctaHref: `/cadastro?plano=basic&ciclo=${cycle}`,
        bullets: [
          "Controle completo de despesas e receitas",
          "Planejamento mensal e metas",
          "Lançamentos recorrentes e parcelados",
          "Relatórios essenciais em 1 clique",
          "Tema claro/escuro e backup",
        ],
      },
      {
        key: "premium",
        name: "Premium",
        highlight: true,
        monthlyEq: cycle === "annual" ? pricing.premium.annualMonthly : pricing.premium.semiMonthly,
        billedTotal: (cycle === "annual" ? pricing.premium.annualMonthly : pricing.premium.semiMonthly) * months,
        ctaHref: `/cadastro?plano=premium&ciclo=${cycle}`,
        bullets: [
          "Tudo do Básico",
          "Investimentos: aportes, rentabilidade e proventos",
          "Comparativos e análises avançadas",
          "Dashboards personalizáveis",
          "Suporte prioritário",
        ],
      },
    ];
  }, [cycle]);

  return (
    <div className="w-full text-white">
      <Toggle value={cycle} onChange={setCycle} />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {plans.map((p) => {
          const months = cycle === "annual" ? 12 : 6;
          const perLabel = cycle === "annual" ? "cobrado anualmente" : "cobrado semestralmente";
          const days = cycle === "annual" ? 365 : 182;
          const daily = p.billedTotal / days;          
          return (
            <Reveal
              key={p.key}
              className={`group relative overflow-hidden rounded-2xl border p-6 text-white transition-all duration-200 transform-gpu hover:-translate-y-0.5 hover:shadow-lg ${
                p.highlight
                  ? // PREMIUM: mais destaque + fundo encorpado + zoom sutil no hover
                    "isolate border-emerald-400/40 bg-emerald-400/15 ring-1 ring-emerald-400/25 shadow-xl shadow-emerald-400/20 backdrop-blur-sm hover:scale-[1.02]"
                  : // Básico: neutro
                    "border-white/10 bg-white/5 shadow-sm"
              }`}
            >
              {/* selo popular para Premium (topo direito) */}
              {p.highlight ? (
                <span className="absolute top-3 right-3 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 shadow-sm transition">
                  Mais escolhido
                </span>
              ) : null}  
              <div className="mb-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white/95">
                  {p.key === "premium" ? (
                    <Crown className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                  ) : (
                    <Layers className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                  )}
                  {p.name}
                </h3>
                {/* preço por dia (destaque) */}
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-emerald-200 sm:text-5xl">{fmt(daily)}</span>
                    <span className="text-sm text-white/60">/dia</span>
                  </div>
                  {/* apoio: preço/mês */}
                  <div className="mt-1 text-sm text-white/70">
                    {fmt(p.monthlyEq)} <span className="text-white/60">/mês</span>
                  </div>
                  {/* apoio: total cobrado */}
                  <div className="text-xs text-white/60">
                    {perLabel}: <span className="text-white/80">{fmt(p.billedTotal)}</span> ({months}x)
                  </div>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-white/80">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <a
                href={p.ctaHref}
                className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  p.highlight
                    ? "bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-900 ring-1 ring-emerald-300/30 hover:from-emerald-300 hover:to-teal-300"
                    : "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {p.key === "premium" ? "Quero investir e controlar tudo agora" : "Quero começar a organizar"}
              </a>
            </Reveal>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-white/70">
        Preços de lançamento. Cobrança {isAnnual ? "anual" : "semestral"} única. Você pode cancelar a qualquer momento.
      </p>
    </div>
  );
}