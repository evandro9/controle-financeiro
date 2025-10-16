// src/components/ui/ScrollArea.jsx
import React, { useContext, useMemo } from "react";
import { ThemeContext } from "../../context/ThemeContext";

// injeta o CSS global uma única vez
let __scrollCSSInjected = false;
function injectScrollCSS() {
  if (__scrollCSSInjected) return;
  __scrollCSSInjected = true;
  const css = `
    .cf-scroll {
      scrollbar-width: thin;                     /* Firefox */
      scrollbar-color: var(--sb-thumb) var(--sb-track);
    }
    .cf-scroll::-webkit-scrollbar {
      width: var(--sb-size, 10px);
      height: var(--sb-size, 10px);              /* horizontal */
    }
    .cf-scroll::-webkit-scrollbar-track {
      background: var(--sb-track);
      border-radius: 8px;
    }
    .cf-scroll::-webkit-scrollbar-thumb {
      background: var(--sb-thumb);
      border-radius: 8px;
    }
    .cf-scroll::-webkit-scrollbar-thumb:hover {
      background: var(--sb-thumb-hover);
    }
  `;
  const style = document.createElement("style");
  style.setAttribute("data-ui", "ScrollArea");
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * ScrollArea – container com scrollbar personalizado (horizontal/vertical/ambos).
 *
 * Props:
 * - axis: 'x' | 'y' | 'both' (default 'x')
 * - size: espessura do scrollbar em px (default 10)
 * - track, thumb, hover: cores (opcionais). Se não passar, usa ThemeContext.
 * - className, style: extras do wrapper
 */
export default function ScrollArea({
  axis = "x",
  size = 10,
  track,
  thumb,
  hover,
  className = "",
  style,
  children,
}) {
  injectScrollCSS();

  const { darkMode } = useContext(ThemeContext);

  // defaults por tema (iguais aos da sua tabela atual)
  const defaults = useMemo(() => {
    return darkMode
      ? {
          track: "#0b1220",
          thumb: "#3f3f46",
          hover: "#52525b",
        }
      : {
          track: "#eef2f7",
          thumb: "#cbd5e1",
          hover: "#94a3b8",
        };
  }, [darkMode]);

  const vars = {
    "--sb-track": track ?? defaults.track,
    "--sb-thumb": thumb ?? defaults.thumb,
    "--sb-thumb-hover": hover ?? defaults.hover,
    "--sb-size": `${size}px`,
  };

  const axisClass =
    axis === "both"
      ? "overflow-auto"
      : axis === "y"
      ? "overflow-y-auto"
      : "overflow-x-auto"; // default 'x'

  return (
    <div
      className={`relative cf-scroll ${axisClass} ${className}`}
      style={{ ...vars, ...(style || {}) }}
    >
      {children}
    </div>
  );
}