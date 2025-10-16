import React, { createContext, useContext, useEffect, useState } from "react";

const Ctx = createContext({ sub: null, ents: {}, loading: true });

export function PlanProvider({ children, authSignal }) {
  const [sub, setSub] = useState(null);
  const [ents, setEnts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      setLoading(true);

      // lê o token "na hora"
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        if (mounted) {
          setSub(null);
          setEnts({});
          setLoading(false);
        }
        return;
      }

      try {
        const base = import.meta.env.VITE_API_BASE_URL || "/api";
        const headers = {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        };

        async function getJson(url) {
          const res = await fetch(url, { credentials: "same-origin", headers });
          const ct = res.headers.get("content-type") || "";
          if (!ct.includes("application/json")) {
            const text = await res.text();
            throw new Error(`Resposta não-JSON de ${url}: ${text.slice(0, 120)}...`);
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(`HTTP ${res.status} em ${url} — ${body.error || "sem detalhe"}`);
          }
          return res.json();
        }

        const [s, e] = await Promise.all([
          getJson(`${base}/me/subscription`),
          getJson(`${base}/me/entitlements`),
        ]);

        if (!mounted) return;
        setSub(s || null);
        setEnts(e || {});
      } catch (e) {
        console.error("PlanContext load error:", e);
        if (mounted) {
          setSub(null);
          setEnts({});
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [authSignal]); // 👈 reexecuta quando o App muda de "deslogado" para "logado" (ou vice-versa)

  return <Ctx.Provider value={{ sub, ents, loading }}>{children}</Ctx.Provider>;
}

export const usePlan = () => useContext(Ctx);

export function useFeature(key) {
  const { ents } = usePlan();
  const v = ents?.[key];
  if (v === undefined) return false;
  if (v === "true") return true;
  const n = Number(v);
  return Number.isFinite(n) ? n > 0 : !!v;
}

export function RequireFeature({ feature, fallback = null, children }) {
  const ok = useFeature(feature);
  return <>{ok ? children : fallback}</>;
}