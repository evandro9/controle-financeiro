// frontend/src/components/marketing/NavLanding.jsx
import React, { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

export default function NavLanding() {
  const [open, setOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false); // mantém o DOM montado durante a animação de saída
  const [anim, setAnim] = useState("closed"); // 'closed' | 'enter' | 'open' | 'exit'
  const closeTimer = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");

  // Itens do menu (ordem/labels casando com a landing atual)
  const items = [
    { href: "#manifesto",      label: "Por que este sistema" },
    { href: "#depoimentos",    label: "Depoimentos" },
    { href: "#prints",         label: "Veja por dentro" },
    { href: "#como-funciona",  label: "Como funciona" },
    { href: "#resultados",     label: "O que você conquista" },
    { href: "#planos",         label: "Planos" },
    { href: "#faq",            label: "FAQ" },
  ];

  // Header “glass” ao rolar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

    // controla animações do drawer mobile
  useEffect(() => {
    if (open) {
      // monta e anima entrada
      setPanelVisible(true);
      requestAnimationFrame(() => {
        setAnim("enter");
        requestAnimationFrame(() => setAnim("open"));
      });
      // fecha ao rolar (mobile)
      const onScrollClose = () => {
        if (window.innerWidth < 768) startClose();
      };
      window.addEventListener("scroll", onScrollClose, { passive: true });
      return () => window.removeEventListener("scroll", onScrollClose);
    }
    // quando open false, se não estiver saindo, garante desmontagem
    if (anim === "closed") setPanelVisible(false);
  }, [open]);

  function startClose() {
    if (closeTimer.current || anim === "exit" || anim === "closed") return;
    setAnim("exit");
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setPanelVisible(false);
      setOpen(false);
      setAnim("closed");
    }, 180); // tempo da transição (ms)
  }

  // Scroll-spy simples para realçar item ativo
  useEffect(() => {
    const sections = items
      .map((i) => document.querySelector(i.href))
      .filter(Boolean);

    if (sections.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // pega a seção mais visível
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(`#${visible.target.id}`);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    sections.forEach((sec) => io.observe(sec));
    return () => io.disconnect();
  }, []);

  // FIXO no topo: igual no topo; translúcido ao rolar
  const headerClass =
    "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter] duration-300 " +
    (scrolled
      ? "border-b border-white/10 bg-slate-950/75 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60"
      : "bg-slate-950"); // sem mudar a cor no topo

  const linkBase =
    "rounded-md px-3 py-2 text-sm font-medium transition-colors";
  const linkIdle = "text-white/70 hover:text-white";
  const linkActive = "text-white";

  return (
    <>
    <header className={headerClass}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo / Marca */}
        <a href="#topo" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-400 to-teal-400 ring-1 ring-emerald-300/40" />
          <span className="text-sm font-semibold tracking-tight text-white">
            Meu Orçamento Doméstico
          </span>
        </a>

        {/* Navegação desktop */}
        <nav className="hidden items-center gap-1 md:flex">
          {items.map((it) => (
            <a
              key={it.href}
              href={it.href}
              className={[
                linkBase,
                active === it.href ? linkActive : linkIdle,
              ].join(" ")}
            >
              {it.label}
            </a>
          ))}
        </nav>

        {/* Ações (lado direito) */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/login"
            className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-white/85
                       shadow-sm transition-colors hover:bg-white/10 hover:text-white
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
          >
            Já sou membro
          </a>
        </div>

        {/* Botão mobile */}
        <button
          className="inline-flex items-center justify-center rounded-md p-2 text-white/80 hover:bg-white/10 md:hidden"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Drawer mobile (com animação de entrada/saída) */}
      {(open || panelVisible) && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop (fade) */}
          <div
            className={[
              "absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200",
              anim === "open" ? "opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={startClose}
          />
          {/* Painel (slide + fade) */}
          <nav
            className={[
              "absolute inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto",
              "border-t border-white/10 bg-slate-950 shadow-2xl",
              "transition-all duration-200 transform will-change-transform",
              anim === "open" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
            ].join(" ")}
          >
            {/* título escondido p/ a11y */}
            <h2 id="mobile-menu-title" className="sr-only">Menu</h2>
            {/* itens */}
            <div className="px-3 py-3">
              {items.map((it) => (
                <a
                  key={it.href}
                  href={it.href}
                  onClick={startClose}
                  className={[
                    "block rounded-md px-3 py-2 text-base",
                    active === it.href
                      ? "bg-white/10 text-white"
                      : "text-white/80 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  {it.label}
                </a>
              ))}
              <div className="mt-2 flex items-center gap-2">
                <a
                  href="/login"
                  onClick={startClose}
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-base text-white/85
                             shadow-sm transition-colors hover:bg-white/10 hover:text-white
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/30"
                >
                  Já sou membro
                </a>
              </div>
              {/* padding pro safe area do iOS */}
              <div className="pb-[max(env(safe-area-inset-bottom),0px)]" />
            </div>
          </nav>
        </div>
      )}
    </header>
      {/* spacer para não “comer” o conteúdo por trás do header fixo
          e evitar “flash” branco quando o header está translúcido perto do topo */}
      <div aria-hidden className="h-16 bg-slate-950" />
    </>
  );
}