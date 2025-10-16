import React, { useEffect, useRef, useState } from "react";

function useCountUp(target, startWhenVisible = true, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!startWhenVisible) return;
    let started = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started) {
          started = true;
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min(1, (now - t0) / duration);
            setValue(Math.floor(p * target));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [target, startWhenVisible, duration]);
  return { ref, value };
}

export default function Counters() {
  const a = useCountUp(12000); // usuários
  const b = useCountUp(250000); // lançamentos
  const c = useCountUp(49); // NPS 4,9 → 49/10
  return (
    <section className="relative bg-slate-900 py-12 overflow-visible">
      {/* RECEBE só os ~30% finais do glow do HERO (mesma cor, mesmo tamanho, topo negativo 70% da altura) */}
      <div
        className="pointer-events-none absolute left-[-7rem] h-[22rem] w-[20rem] rounded-full bg-teal-400/15 blur-3xl"
        style={{ top: "calc(-26rem * 0.70)" }}
      />
      {/* RECEBE ~30% iniciais do glow do bloco de baixo (topo direito do Manifesto) */}
      <div
        className="pointer-events-none absolute right-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl"
        style={{ bottom: "calc(-16rem * 0.70)" }}
      />

      {/* glow central do próprio bloco (mantido) */}
      <div className="pointer-events-none absolute -inset-x-0 -inset-y-24 -z-10">
        <div className="mx-auto h-40 w-[30rem] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 text-center sm:grid-cols-3 sm:px-6 lg:px-8">
        <div ref={a.ref}>
          <div className="text-2xl font-extrabold text-white/90">{a.value.toLocaleString()}+</div>
          <div className="text-xs uppercase tracking-wide text-white/70">pessoas impactadas</div>
        </div>
        <div ref={b.ref}>
          <div className="text-2xl font-extrabold text-white/90">{b.value.toLocaleString()}+</div>
          <div className="text-xs uppercase tracking-wide text-white/60">lançamentos registrados</div>
        </div>
        <div ref={c.ref}>
          <div className="text-2xl font-extrabold text-white/90">{(c.value/10).toFixed(1)}/5</div>
          <div className="text-xs uppercase tracking-wide text-white/60">satisfação (NPS)</div>
        </div>
      </div>
    </section>
  );
}