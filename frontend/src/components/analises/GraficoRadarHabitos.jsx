import React, { useEffect, useMemo, useState, useContext } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { ThemeContext } from "../../context/ThemeContext";
import InfoTip from "../ui/InfoTip";

/**
 * Radar de Hábitos de Gasto (por categoria)
 * - Normaliza gastos (despesa) por categoria no mês selecionado em 0..100
 * - Storytelling: mostra as 2 categorias mais “características”
 *
 * Props:
 *  - ano (number)
 *  - mes (number 1..12)
 *  - endpoint (string?) opcional. Padrão tenta rota de análises; se falhar, cai no fallback /lancamentos e agrega.
 *  - normalizacao ("max" | "percent") — "max" = (valor/max)*100; "percent" = participação no mês (0..100). Default "max".
 */
export default function GraficoRadarHabitos({
  ano,
  mesInicio,
  mesFim,
  endpoint, // opcional: se vier, força uso; senão escolhemos abaixo
  normalizacao = "max",
}) {
  const { darkMode } = useContext(ThemeContext);
  const [raw, setRaw] = useState([]); // [{ categoria: 'Alimentação', valor: 1234.56 }]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const range = useMemo(() => {
    const ini = Number(mesInicio);
    const fim = Number(mesFim);
    if (!ini || !fim) return [];
    const arr = [];
    for (let m = ini; m <= fim; m++) arr.push(m);
    return arr;
  }, [mesInicio, mesFim]);
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

  // endpoint mensal oficial do back (único mês)
  const endpointMensal = (m) =>
    `${apiBase}/lancamentos/despesas-por-categoria?ano=${ano}&mes=${String(m).padStart(2,"0")}`;


  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const raw  = (localStorage.getItem("token") || '').trim();
        const auth = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
        // Se o usuário passar 'endpoint' explicitamente, tenta ele como está (modo avançado)
        if (endpoint) {
          const res = await fetch(endpoint, { headers: { Authorization: auth }});
          if (!res.ok) throw new Error("endpoint custom falhou");
          let arr = await res.json();
          if (!Array.isArray(arr)) throw new Error("formato inesperado");
          arr = arr.map(it => ({
            categoria: it.categoria_nome ?? it.categoria ?? it.nome ?? "Categoria",
            valor: Number(it.total ?? it.valor ?? 0),
          }));
          if (!alive) return;
          setRaw(arr);
          return;
        }

        // Range: agrega mês a mês somando por categoria
        if (range.length > 1) {
          const mapa = new Map();
          for (const m of range) {
            // usa a rota mensal oficial do back
            const res = await fetch(endpointMensal(m), { headers: { Authorization: auth }});
            if (!res.ok) continue;
            const lista = await res.json();
            const adaptada = (Array.isArray(lista) ? lista : []).map(it => ({
              categoria: it.categoria_nome ?? it.categoria ?? it.nome ?? "Categoria",
              valor: Number(it.total ?? it.valor ?? 0),
            }));
            for (const it of adaptada) {
              mapa.set(it.categoria, (mapa.get(it.categoria) || 0) + it.valor);
            }
          }
          if (!alive) return;
          setRaw(Array.from(mapa, ([categoria, valor]) => ({ categoria, valor })));
          return;
        }

        // 1 mês só: tenta rota mensal oficial
        {
          const unicoMes = range[0] || mesInicio;
          const res = await fetch(endpointMensal(unicoMes), { headers: { Authorization: auth }});
          if (!res.ok) throw new Error("rota mensal falhou");
          let arr = await res.json();
          if (!Array.isArray(arr)) throw new Error("formato inesperado");
          arr = arr.map(it => ({
            categoria: it.categoria ?? it.categoria_nome ?? it.nome ?? "Categoria",
            valor: Number(it.total ?? it.valor ?? 0),
          }));
          if (!alive) return;
          setRaw(arr);
          return;
        }
      } catch (e) {
        // Fallback robusto: agrega por categoria usando /lancamentos com limite alto
        try {
          const token = localStorage.getItem("token");
          const meses = range.length ? range : [mesInicio];
          const mapa = new Map();
          for (const m of meses) {
            const url = `${apiBase}/lancamentos?ano=${ano}&mes=${String(m).padStart(2,"0")}&limite=100000`;
            const res2 = await fetch(url, { headers: { Authorization: auth }});
            let arr2 = await res2.json();
            if (!Array.isArray(arr2)) arr2 = [];
            for (const it of arr2) {
              if ((it.tipo || "").toLowerCase() !== "despesa") continue;
              const nome = it.categoria_nome || it.categoria || "Categoria";
              const v = Number(it.valor || 0);
              mapa.set(nome, (mapa.get(nome) || 0) + v);
            }
          }
          if (!alive) return;
          setRaw(Array.from(mapa, ([categoria, valor]) => ({ categoria, valor })));
        } catch (err2) {
          if (!alive) return;
          setErr("Não foi possível carregar os dados de categorias.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [ano, mesInicio, mesFim, endpoint, range]);

  const totalMes = useMemo(() => raw.reduce((acc, it) => acc + (Number(it.valor)||0), 0), [raw]);
  const maxVal = useMemo(() => raw.reduce((m, it) => Math.max(m, Number(it.valor)||0), 0), [raw]);

  const dataRadar = useMemo(() => {
    if (!raw.length) return [];
    if (normalizacao === "percent") {
      // participação no mês
      return raw
        .map(it => ({
          categoria: it.categoria,
          valor: Number(it.valor)||0,
          score: totalMes > 0 ? (Number(it.valor)*100/totalMes) : 0,
        }))
        .sort((a,b) => b.score - a.score);
    }
    // default "max": relativo ao maior gasto
    return raw
      .map(it => ({
        categoria: it.categoria,
        valor: Number(it.valor)||0,
        score: maxVal > 0 ? (Number(it.valor)*100/maxVal) : 0,
      }))
      .sort((a,b) => b.score - a.score);
  }, [raw, normalizacao, totalMes, maxVal]);

  const top2 = (dataRadar[0]?.categoria && dataRadar[1]?.categoria)
    ? `${dataRadar[0].categoria} + ${dataRadar[1].categoria}`
    : (dataRadar[0]?.categoria || "—");

  const txtMuted = darkMode ? "text-darkMuted" : "text-gray-500";
  const txtStrong = darkMode ? "text-darkText" : "text-gray-800";
  const border = darkMode ? "dark:border-darkBorder" : "border-gray-100";
  const bgTooltip = darkMode ? "bg-darkCard border-darkBorder text-darkText" : "bg-white border-gray-200 text-gray-800";

 const nome = (m) => new Date(0, m - 1).toLocaleString("pt-BR",{month:"long"});
 const tituloPeriodo = useMemo(() => {
   if (!mesInicio || !mesFim) return `${ano}`;
   if (mesInicio === mesFim) {
     const mm = nome(mesInicio); return `${mm.charAt(0).toUpperCase() + mm.slice(1)} / ${ano}`;
   }
   const a = nome(mesInicio), b = nome(mesFim);
   return `${a.substring(0,3)}–${b.substring(0,3)} / ${ano}`;
 }, [ano, mesInicio, mesFim]);

  const money = (v) => Number(v||0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
      <div className={`text-xs px-2 py-1 rounded-md border shadow ${bgTooltip}`}>
        <div className="font-medium">{item.categoria}</div>
        <div>Gasto: {money(item.valor)}</div>
        <div>Score: {item.score.toFixed(0)}%</div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
 <h3 className={`text-lg font-semibold ${txtStrong} text-center`}>
   Radar de hábitos de gasto
 </h3>
        <div className="absolute right-0">
          <InfoTip title="Como ler este painel" ariaLabel="Informações do radar">
            <ul className="list-disc pl-4 space-y-1">
              <li>Cada eixo representa uma <b>categoria</b> de despesa.</li>
              <li>O preenchimento (0–100) indica quão <b>marcante</b> é a categoria no período.</li>
              <li>Escala: {normalizacao === "percent" ? "participação no mês" : "relativo à maior categoria"}.</li>
              <li>Passe o mouse para ver o <b>valor</b> e o <b>score</b>.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* Card */}
      <div className={`flex-1 min-h-0 rounded-xl border ${border} p-3`}>
        {loading && (
          <div className={`h-full flex items-center justify-center ${txtMuted}`}>Carregando…</div>
        )}

        {!loading && err && (
          <div className="h-full flex items-center justify-center text-red-600">{err}</div>
        )}

        {!loading && !err && dataRadar.length === 0 && (
          <div className={`h-full flex items-center justify-center ${txtMuted}`}>
            Sem despesas por categoria no período.
          </div>
        )}

        {!loading && !err && dataRadar.length > 0 && (
          <div className="w-full h-full flex flex-col">
            {/* Storytelling */}
            <div className="text-xs mb-2">
              <span className={txtMuted}>Você é </span>
              <span className={`font-medium ${txtStrong}`}>&lsquo;{top2}&rsquo;</span>
            </div>

            {/* Radar */}
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={dataRadar}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="categoria" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Hábito"
                    dataKey="score"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.35}
                  />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Rodapé da escala */}
            <div className="mt-2 text-xs text-right">
              <span className={txtMuted}>
                Escala: {normalizacao === "percent" ? "participação (%) no mês" : "score relativo ao maior gasto (=100%)"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}