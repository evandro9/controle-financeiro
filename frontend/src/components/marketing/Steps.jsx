import React from "react";
import { ListChecks, LogIn, PieChart, Map, ShieldCheck } from "lucide-react";
import Reveal from "../ui/Reveal.jsx";

const DATA = [
  { icon: ListChecks, title: "Escolha seu plano", desc: "Defina o que faz sentido hoje; você pode mudar depois." },
  { icon: LogIn, title: "Entre e conecte", desc: "Cadastre suas contas em segundos" },
  { icon: PieChart, title: "Desfrute do controle total", desc: "Organize seus dados do seu jeito e acompanhe tudo em um só lugar." },
];

export default function Steps({
  subtitle = "Comece a organizar tudo em menos de 3 minutos.",
  safetyCopy = "100% seguro — seus dados nunca serão compartilhados.",
}) {
  return (
    <section id="como-funciona" className="relative scroll-mt-24 border-y border-white/10 bg-slate-950 py-12 sm:py-16 lg:py-20">
      {/* glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute bottom-5 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Título com ícone — mesmo “peso” visual dos outros blocos */}
        <Reveal
          as="h3"
          className="flex items-center justify-center gap-2 text-center text-2xl sm:text-3xl font-bold tracking-tight text-white/90"
        >
          <Map className="h-6 w-6 text-emerald-300" aria-hidden="true" /> Como funciona
        </Reveal>
        {/* Subtítulo chamativo */}
        <p className="mt-3 text-center text-sm sm:text-base text-white/80">{subtitle}</p>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {DATA.map((s, i) => (
            <Reveal key={s.title} delay={i*80} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-sm">
              <s.icon className="mb-3 h-7 w-7 text-emerald-300" aria-hidden="true" />
              <h4 className="text-base font-semibold text-white">{s.title}</h4>
              <p className="mt-2 text-sm text-white/80">{s.desc}</p>
            </Reveal>
          ))}
        </div>
        {/* Micro-copy de segurança (discreta) */}
        {safetyCopy ? (
          <p className="mt-6 text-center text-xs text-white/60">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              {safetyCopy}
            </span>
          </p>
        ) : null}        
      </div>
    </section>
  );
}