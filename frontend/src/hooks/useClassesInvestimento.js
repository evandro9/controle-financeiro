import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "/api";

/**
 * Busca classes de investimento do usuário (não ocultas por padrão).
 * Retorna { options, loading, error } onde options = [{ key: id, label: nome }, ...]
 */
export default function useClassesInvestimento({ incluirOcultas = false } = {}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = useMemo(() => localStorage.getItem("token"), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const resp = await fetch(
          `${API}/investimentos/classes?ocultas=${incluirOcultas ? 1 : 0}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.erro || "Falha ao listar classes");
        if (!alive) return;
        const mapped = (data || []).map((c) => ({ key: c.id, label: c.nome }));
        setOptions(mapped);
      } catch (e) {
        if (alive) setError(e.message || "Erro ao buscar classes");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [incluirOcultas, token]);

  return { options, loading, error };
}