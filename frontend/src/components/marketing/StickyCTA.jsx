import React, { useEffect, useState } from "react";

export default function StickyCTA() {
  const [show, setShow] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  // observa o bloco final (#cta-final) ou o <footer> e esconde quando entrar na viewport
  useEffect(() => {
    const target =
      document.getElementById("cta-final") ||
      document.querySelector("footer");
    if (!target) return;
    const obs = new IntersectionObserver(
      ([entry]) => setAtEnd(entry.isIntersecting),
      { root: null, threshold: 0.01 }
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  // controla exibição: só mostra após rolar um pouco e se não estiver no final da página
  useEffect(() => {
    const onScroll = () => {
      const pastTop = window.scrollY > 480;
      // fallback extra: esconde se estiver muito perto do rodapé, mesmo sem sentinel
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 200;
      setShow(pastTop && !atEnd && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [atEnd]);

  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 bottom-0 z-40 transition duration-300 ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto mb-4 max-w-4xl rounded-2xl border border-white/10 bg-slate-950/90 p-3 shadow-xl backdrop-blur">
        <div className="flex flex-col items-center justify-between gap-3 text-white sm:flex-row">
          <p className="text-sm text-white/80">
            Pronto para começar? Leva poucos minutos para configurar.
          </p>
          <div className="flex gap-2">
            <a href="#planos" className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow ring-1 ring-emerald-300/30 hover:from-emerald-300 hover:to-teal-300">
              Quero organizar minhas finanças
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}