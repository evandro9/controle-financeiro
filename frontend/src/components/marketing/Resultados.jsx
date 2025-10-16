import React from "react";
import Reveal from "../ui/Reveal.jsx";
import { Trophy, CheckCircle2, FileX, Sparkles, ShieldCheck, Target } from "lucide-react";

// 7 / 30 / 60 dias — foco em prazer imediato + manutenção/ evolução
const COLS = [
  {
    label: "Em 7 dias",
    items: [
      <><strong className="text-white/90 font-semibold">Descubra</strong> para onde vai cada real.</>,
      <>Equilibre suas finanças sem planilhas complicadas.</>,
      <>Defina tetos por categoria e gaste com <strong className="text-white/90 font-semibold">consciência</strong>.</>,
      <>Sinta o <strong className="text-white/90 font-semibold">controle</strong> da sua grana já na primeira semana.</>,
    ],
  },
  {
    label: "Em 30 dias",
    items: [
      <>Feche o mês no <strong className="text-white/90 font-semibold">positivo</strong>.</>,
      <>Melhore sua  <strong className="text-white/90 font-semibold">qualidade</strong> de vida.</>,
      <>Cartão de crédito finalmente <strong className="text-white/90 font-semibold">sob controle</strong>.</>,
      <>Construa e cumpra <strong className="text-white/90 font-semibold">planos ambiciosos</strong> com metas claras.</>,
      <>Comece sua <strong className="text-white/90 font-semibold">reserva de emergência</strong>, mesmo se nunca conseguiu antes.</>,
    ],
  },
  {
    label: "Em 60 dias",
    items: [
      <>Mais dinheiro <strong className="text-white/90 font-semibold">sobrando</strong> todo mês.</>,
      <>Mantenha o saldo no <strong className="text-white/90 font-semibold">azul</strong>, mês após mês.</>,
      <>Planeje os próximos meses com <strong className="text-white/90 font-semibold">clareza</strong> e invista com <strong className="text-white/90 font-semibold">confiança</strong>.</>,
      <>Estruture sua carteira de<strong className="text-white/90 font-semibold"> investimentos</strong> adequada ao seu perfil.</>,
      <>Planeje de forma clara a conquista da <strong className="text-white/90 font-semibold">independência financeira</strong>.</>,
    ],
  },
];

export default function Resultados() {
  return (
    <section id="resultados" className="scroll-mt-24 border-y border-white/10 bg-slate-900 py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Título com ícone (coerente com os outros blocos) */}
        <Reveal
          as="h3"
          className="text-center text-2xl sm:text-3xl font-bold tracking-tight text-white/90"
        >
          <span className="inline-flex items-center justify-center gap-2 whitespace-normal break-words hyphens-none">
            <Trophy className="h-6 w-6 text-emerald-300" aria-hidden="true" />
            <span>
              As primeiras vitórias de quem{" "}
              <span className="text-emerald-300 font-semibold">decide</span>{" "}
              assumir o controle
            </span>
          </span>
        </Reveal>
        <p className="mt-3 text-center text-white/70 text-sm sm:text-base">
          Não é teoria, é resultado de verdade. Experimente suas primeiras conquistas.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {COLS.map((col, i) => (
            <Reveal
              key={col.label}
              delay={i * 80}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-sm"
            >
              <h4 className="text-base font-semibold text-white">{col.label}</h4>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                {col.items.map((t, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" aria-hidden="true" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        {/* Reforços fora dos cards (sem planilhas / sem enrolação / sem sustos) */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-white/80">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
            <FileX className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            Sem planilhas
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
            <Sparkles className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            Sem enrolação
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            Sem sustos
          </span>
        </div>        
      </div>
    </section>
  );
}