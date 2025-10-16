import React, { useEffect, useRef, useState } from "react";

/**
 * Aplica uma animação de entrada quando o elemento entra no viewport.
 * Uso: <Reveal><SeuConteudo/></Reveal>
 */
export default function Reveal({
  as: Tag = "div",
  children,
  className = "",
  delay = 0,
  once = true,
  ...props
}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setShown(true), delay);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setShown(false);
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay, once]);

  const base =
    "transform transition duration-700 ease-out will-change-[opacity,transform]";
  const hidden = "opacity-0 translate-y-4";
  const visible = "opacity-100 translate-y-0";

  return (
    <Tag
      ref={ref}
      className={`${base} ${shown ? visible : hidden} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}