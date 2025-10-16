import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

/**
 * Carrossel de depoimentos com setas e scroll-snap.
 * Props:
 *  - items: Array<{ n: string, t: string }>
 */
export default function TestimonialsCarousel({ items = [] }) {
  const scrollerRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const metricsRef = useRef({ step: 0, perPage: 1, pages: 1 });

  const updateNav = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    setAtStart(sc.scrollLeft <= 4);
    setAtEnd(sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 4);
  };

  // mede distância entre cards e calcula perPage/páginas
  const recalcMetrics = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const cards = Array.from(sc.querySelectorAll("[data-card='testimonial']"));
    if (cards.length < 2) {
      metricsRef.current = { step: sc.clientWidth, perPage: 1, pages: Math.max(1, items.length) };
      return;
    }
    const step = Math.max(1, cards[1].offsetLeft - cards[0].offsetLeft);
    const perPage = Math.max(1, Math.round(sc.clientWidth / step));
    const pages = Math.max(1, Math.ceil(items.length / perPage));
    metricsRef.current = { step, perPage, pages };
  };

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const onResize = () => {
      recalcMetrics();
      updateNav();
    };
    recalcMetrics();
    updateNav();
    sc.addEventListener("scroll", updateNav, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      sc.removeEventListener("scroll", updateNav);
      window.removeEventListener("resize", onResize);
    };
  }, [items.length]);

  const scrollByPage = (dir = 1) => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const { step, perPage } = metricsRef.current;
    sc.scrollBy({ left: Math.round(step * perPage) * dir, behavior: "smooth" });
  };

  // ===== Utils (avatar, estrelas) =====
  const initials = (name = "") => {
    const parts = name.trim().split(/\s+/);
    if (!parts.length) return "U";
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    return (first + last).toUpperCase();
  };

  const Stars = ({ rating = 5 }) => {
    const max = 5;
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }).map((_, i) => {
          const filled = i < rating;
          return (
            <Star
              key={i}
              className={`h-4 w-4 ${filled ? "text-emerald-300 fill-emerald-300" : "text-white/25"}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative">
      {/* seta esquerda */}
      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        aria-label="Ver anteriores"
        aria-disabled={atStart}
        className={`group absolute -left-3 md:-left-12 top-1/2 z-10 -translate-y-1/2 rounded-full border p-2 shadow-lg backdrop-blur-sm transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40
        ${atStart
          ? "pointer-events-none border-white/10 bg-white/5 text-white/40"
          : "border-white/10 bg-white/10 text-white hover:bg-white/15 hover:scale-105 active:scale-95"}`}
      >
        <ChevronLeft className="h-5 w-5 opacity-90 transition-opacity group-hover:opacity-100" />
      </button>

      {/* faixa rolável */}
      <div
        ref={scrollerRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") scrollByPage(1);
          if (e.key === "ArrowLeft") scrollByPage(-1);
        }}
        className="flex snap-x snap-mandatory gap-5 md:gap-6 overflow-x-auto scroll-smooth px-1 py-1"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((d, i) => {
          // Formato clássico: { n, t } (author/quote também suportados, mas sem destaque/contexto/avatars)
          const name = d.author ?? d.n ?? "Usuário";
          const text = d.quote ?? d.t ?? "";

          return (
            <figure
              data-card="testimonial"
              key={`${name}-${i}`}
              className="group relative w-[85%] flex-shrink-0 snap-center rounded-2xl border border-white/10 bg-white/5 p-5 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md
                         sm:w-[60%] md:w-[48%] lg:w-[31%] xl:w-[23%]"
            >
              {/* Cabeçalho: iniciais + nome + estrelas à direita */}
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20">
                  <span className="text-[10px] font-semibold tracking-wide">{initials(name)}</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-white">{name}</div>
                </div>
                <div className="ml-auto">
                  {/* 5 estrelas fixas no topo direito, cor da marca em dark */}
                  <Stars rating={5} />
                </div>
              </div>

              {/* Depoimento (sem destaque) */}
              <blockquote className="text-sm text-white/90">“{text}”</blockquote>
            </figure>
          );
        })}
      </div>

      {/* seta direita */}
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        aria-label="Ver próximos"
        aria-disabled={atEnd}
        className={`group absolute -right-3 md:-right-12 top-1/2 z-10 -translate-y-1/2 rounded-full border p-2 shadow-lg backdrop-blur-sm transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40
        ${atEnd
          ? "pointer-events-none border-white/10 bg-white/5 text-white/40"
          : "border-white/10 bg-white/10 text-white hover:bg-white/15 hover:scale-105 active:scale-95"}`}
      >
        <ChevronRight className="h-5 w-5 opacity-90 transition-opacity group-hover:opacity-100" />
      </button>
    </div>
  );
}