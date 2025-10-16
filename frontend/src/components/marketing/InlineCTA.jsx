import React from "react";

export default function InlineCTA({
  id,
  tone = "dark",
  primaryLabel = "Quero me inscrever",
  href = "#planos",
}) {
  const map = { dark: "bg-slate-900 border-white/10 text-white" };
  const cls = map[tone] ?? map.dark;
  return (
    <section id={id} className={`relative scroll-mt-24 py-10 overflow-visible ${cls}`}>
      {/* glow de fundo que transborda para os blocos vizinhos */}
      <div className="pointer-events-none absolute -inset-x-0 -inset-y-24 -z-10">
        <div className="mx-auto h-40 w-[26rem] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <a
          href={href}
          aria-label={primaryLabel}
          title={primaryLabel}
          className="relative isolate inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 px-7 py-3.5 text-base font-semibold text-slate-900
                     ring-1 ring-emerald-300/30 shadow-xl shadow-emerald-400/30
                     transition-all duration-200 transform-gpu will-change-transform
                     hover:scale-105 active:scale-95 hover:from-emerald-300 hover:to-teal-300
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60
                     lg:px-10 lg:py-5 lg:text-lg
                     before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-3xl
                     before:bg-gradient-to-r before:from-emerald-400/40 before:to-teal-400/40
                     before:blur-2xl before:opacity-70 hover:before:opacity-90"
        >
          {primaryLabel}
        </a>
      </div>
    </section>
  );
}