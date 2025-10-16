import React, { useEffect, useMemo, useState } from "react";

export default function BannerDemo() {
  // Exibe se o USUÁRIO for demo (independente de build/dev/preview)
  const isDemo = useMemo(() => {
    const isDemoByLS = () => {
      const uid = localStorage.getItem("usuarioId");
      const email = (localStorage.getItem("emailUsuario") || "").toLowerCase();
      return uid === "0" || email === "demo@site.com";
    };
    try {
      const raw = (localStorage.getItem("token") || "").trim();
      const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
      const parts = token.split(".");
      if (parts.length === 3 && parts[1]) {
        // Corrige BASE64URL -> BASE64 e padding antes do atob
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded));
        const pid = payload?.id;
        const pmail = (payload?.email || "").toLowerCase();
        return pid === 0 || String(pid) === "0" || pmail === "demo@site.com";
      }
    } catch {
      /* ignore */
    }
    return isDemoByLS();
  }, []);
  if (!isDemo) return null;


  // Spacer evita que o conteúdo fique coberto pelo banner fixo no mobile
  return (
    <>
      <div className="sm:hidden h-12" />
      <div
        role="status"
        aria-live="polite"
        className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-amber-100/95 text-amber-900 border-t border-amber-300 px-4 py-3 pb-[env(safe-area-inset-bottom)] flex items-center justify-between"
      >
        <span className="text-sm font-medium">
          Você está no ambiente <strong>DEMO</strong>.
        </span>
      </div>
    </>
  );
}
