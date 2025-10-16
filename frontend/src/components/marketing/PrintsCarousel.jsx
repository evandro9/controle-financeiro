import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

 /* Carrossel horizontal de prints com setas, scroll-snap e autoplay.
 * Props:
 *  - items: Array<{ src: string, title: string }>
 *  - onOpen: (item) => void   // abre o lightbox
 *  - autoPlay: boolean = true
 *  - autoDelay: number = 5000 (ms)
 */
export default function PrintsCarousel({ items = [], onOpen, autoPlay = true, autoDelay = 5000 }) {
  const scrollerRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [playing, setPlaying] = useState(autoPlay);
  const [current, setCurrent] = useState(0); // página atual
  const ticking = useRef(false);
  const directionRef = useRef(1); // 1 -> avança, -1 -> volta (ping-pong)
  const cardRefs = useRef([]);
  cardRefs.current = new Array(items.length);
  const metricsRef = useRef({ step: 0, perPage: 1, pages: Math.max(1, items.length), firstLeft: 0, pageWidth: 0 });

  const updateNav = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const { firstLeft, pageWidth, pages } = metricsRef.current;
    setAtStart(sc.scrollLeft <= firstLeft + 4);
    setAtEnd(sc.scrollLeft >= firstLeft + pageWidth * (pages - 1) - 4);
  };

  // calcula largura do "passo" entre cards, itens por página e páginas totais
  const recalcMetrics = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const refs = cardRefs.current.filter(Boolean);
    if (refs.length < 1) return;
    const step = refs.length > 1 ? Math.max(1, refs[1].offsetLeft - refs[0].offsetLeft) : sc.clientWidth;
    const perPage = Math.max(1, Math.round(sc.clientWidth / step));
    const pages = Math.max(1, Math.ceil(items.length / perPage));
    const firstLeft = refs[0].offsetLeft || 0;
    const pageWidth = step * perPage;
    metricsRef.current = { step, perPage, pages, firstLeft, pageWidth };
  };

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    requestAnimationFrame(() => {
      recalcMetrics();
      // inicia travado na primeira página
      const { firstLeft } = metricsRef.current;
      sc.scrollLeft = firstLeft;
      updateNav();
      updateCurrent();
    });
    sc.addEventListener("scroll", updateNav, { passive: true });
    const onResize = () => {
      updateNav();
      recalcMetrics();
      updateCurrent();
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      sc.removeEventListener("scroll", updateNav);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const scrollToPage = (pageIndex) => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const { firstLeft, pageWidth, pages } = metricsRef.current;
    const clamped = Math.max(0, Math.min(pages - 1, pageIndex));
    sc.scrollTo({ left: firstLeft + pageWidth * clamped, behavior: "smooth" });
  };

  const scrollByPage = (dir = 1) => {
    const next = current + (dir > 0 ? 1 : -1);
    scrollToPage(next);
  };  

  // Autoplay: respeita prefers-reduced-motion e pausa em hover/foco/toque
  useEffect(() => {
    if (!autoPlay) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    if (!playing) return;
    const id = setInterval(() => {
      const { pages } = metricsRef.current;
      let dir = directionRef.current;
      let next = current + dir;
      if (next >= pages) {
        dir = -1;
        next = current - 1;
      } else if (next < 0) {
        dir = 1;
        next = current + 1;
      }
      directionRef.current = dir;
      scrollToPage(next);
    }, Math.max(3000, autoDelay));
    return () => clearInterval(id);
  }, [playing, autoPlay, autoDelay]);

  const updateCurrent = () => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const { firstLeft, pageWidth, pages } = metricsRef.current;
    if (pageWidth <= 0) return;
    const raw = (sc.scrollLeft - firstLeft) / pageWidth;
    const page = Math.max(0, Math.min(pages - 1, Math.round(raw)));
    setCurrent(page);
  };

  // scroll handler “suave” (throttle via rAF)
  const onScroll = () => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      updateNav();
      updateCurrent();
      ticking.current = false;
    });
  };

  return (
    <div className="relative">
      {/* Botão esquerdo */}
      <button
        type="button"
        onClick={() => scrollByPage(-1)}
        aria-label="Ver anterior"
        aria-disabled={atStart}
        className={`group absolute -left-3 md:-left-12 top-1/2 z-10 -translate-y-1/2 rounded-full border p-2 shadow-lg backdrop-blur-sm transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40
        ${atStart
          ? "pointer-events-none border-white/10 bg-white/5 text-white/40"
          : "border-white/10 bg-white/10 text-white hover:bg-white/15 hover:scale-105 active:scale-95"}`}
      >
        <ChevronLeft className="h-5 w-5 opacity-90 transition-opacity group-hover:opacity-100" />
      </button>

      {/* Scroller */}
      <div
        ref={scrollerRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") scrollByPage(1);
          if (e.key === "ArrowLeft") scrollByPage(-1);
        }}
        onMouseEnter={() => setPlaying(false)}
        onMouseLeave={() => setPlaying(true)}
        onTouchStart={() => setPlaying(false)}
        onTouchEnd={() => setPlaying(true)}
        onFocus={() => setPlaying(false)}
        onBlur={() => setPlaying(true)}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-1 py-1"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((p, idx) => (
          <figure
            key={`${p.title}-${idx}`}
            ref={(el) => (cardRefs.current[idx] = el)}
            className="group relative w-[85%] flex-shrink-0 snap-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:w-[60%] md:w-[48%] lg:w-[32%]"
          >
            {/* Moldura tipo janela */}
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-white">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
              <figcaption className="ml-3 text-xs font-medium text-white/70">{p.title}</figcaption>
            </div>
            <button
              type="button"
              onClick={() => onOpen?.(p)}
              className="relative block text-left"
              aria-label={`Ampliar ${p.title}`}
            >
              <img
                src={p.src}
                alt={p.title}
                className="h-64 w-full cursor-zoom-in object-cover transition duration-300 group-hover:scale-[1.02]"
                onError={(e) => {
                  e.currentTarget.style.opacity = 0.4;
                }}
              />
            </button>
          </figure>
        ))}
      </div>

      {/* Botão direito */}
      <button
        type="button"
        onClick={() => scrollByPage(1)}
        aria-label="Ver próximo"
        aria-disabled={atEnd}
        className={`group absolute -right-3 md:-right-12 top-1/2 z-10 -translate-y-1/2 rounded-full border p-2 shadow-lg backdrop-blur-sm transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40
        ${atEnd
          ? "pointer-events-none border-white/10 bg-white/5 text-white/40"
          : "border-white/10 bg-white/10 text-white hover:bg-white/15 hover:scale-105 active:scale-95"}`}
      >
        <ChevronRight className="h-5 w-5 opacity-90 transition-opacity group-hover:opacity-100" />
      </button>

      {/* Dots de paginação */}
      {items.length > 1 && (
        <div className="mt-5 flex justify-center gap-2">
          {Array.from({ length: metricsRef.current.pages }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToPage(i)}
              aria-label={`Ir para slide ${i + 1}`}
              className={`h-2.5 w-2.5 rounded-full transition ${
                current === i ? "bg-emerald-500" : "bg-white/20 hover:bg-white/30"
              }`}
            />
          ))}
        </div>
      )}

    </div>
  );
}