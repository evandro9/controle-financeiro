// src/components/classesAtivos/GraficoPatrimonioPorClasse.jsx
import React from "react";
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import { ThemeContext } from "../../../context/ThemeContext";
import InfoTip from "../../ui/InfoTip";
import ChartTooltip from "../../ui/ChartTooltip";

function formatarBRL(v) {
  if (v == null) return "-";
  return Number(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const labelMesAAAAMM = (s) => {
  s = String(s || "");
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split("-").map(Number);
    return `${MESES_PT[m - 1]}/${String(y).slice(-2)}`;
  }
  if (/^\d{2}\/\d{4}$/.test(s)) {
    const [m, y] = s.split("/").map(Number);
    return `${MESES_PT[m - 1]}/${String(y).slice(-2)}`;
  }
  return s;
};

// gera uma cor estável por string
function colorFor(key) {
  let h = 0;
  for (let i = 0; i < String(key).length; i++) h = (h * 33 + String(key).charCodeAt(i)) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

function rangeFromPeriodo(periodo = "ano") {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  let start;
  if (periodo === "12m") start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
  else if (periodo === "24m") start = new Date(Date.UTC(end.getUTCFullYear() - 2, end.getUTCMonth(), 1));
  else if (periodo === "inicio") start = new Date(Date.UTC(2000, 0, 1));
  else start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { startISO: toISO(start), endISO: toISO(end) };
}

/**
 * Gráfico de patrimônio por Classe:
 *  - "Visão geral": evolução mensal (Aplicado x Saldo)
 *  - "Por ativo (mensal)": barras empilhadas por ativo (somente INVESTIDO no mês)
 *
 * Props:
 *  - classeId: string|number
 *  - periodo: 'ano' | '12m' | '24m' | 'inicio'
 *  - title?: string
 *  - height?: number
 *  - apiBase?: string
 *  - buildUrl?: (classeId, periodo) => string
 *  - buildUrlFluxo?: (classeId, periodo) => string
 */
export default function GraficoPatrimonioPorClasse({
  classeId,
  periodo = "ano",
  height = 320,
  apiBase = import.meta.env.VITE_API_URL ?? "/api",
  buildUrl,
  buildUrlFluxo,
}) {
  const { darkMode } = React.useContext(ThemeContext);
  const [modo, setModo] = React.useState("geral"); // 'geral' | 'ativos'

  // ---------- Evolução (área) ----------
  const [evo, setEvo] = React.useState([]);
  const [loadingEvo, setLoadingEvo] = React.useState(false);
  const [errEvo, setErrEvo] = React.useState("");

  const urlEvolucao = React.useMemo(() => {
    return buildUrl
      ? buildUrl(classeId, periodo)
      : `${apiBase}/investimentos/evolucao?periodo=${encodeURIComponent(periodo)}&classe_id=${encodeURIComponent(classeId ?? "")}`;
  }, [buildUrl, apiBase, classeId, periodo]);

  React.useEffect(() => {
    if (!classeId || modo !== "geral") return;
    let alive = true;
    (async () => {
      setLoadingEvo(true);
      setErrEvo("");
      try {
        const token = localStorage.getItem("token");
        const r = await fetch(urlEvolucao, { headers: { Authorization: `Bearer ${token}` } });
        console.log('[GPC][evo] GET', urlEvolucao, { classeId, periodo });
        const j = r.ok ? await r.json() : [];
        const arr = Array.isArray(j) ? j : [];
        const norm = arr.map((it) => ({
          mes: String(it.mes ?? it.mes_ref ?? it.ref ?? ""),
          investido: Number(it.investido ?? it.valor_investido ?? 0),
          atual: Number(it.atual ?? it.valor_atual ?? 0),
        }));
        console.log('[GPC][evo] pontos:', norm.length, 'somaAtual=', norm.reduce((a,b)=>a+Number(b.atual||0),0));        
        if (alive) setEvo(norm);
      } catch (e) {
        if (alive) setErrEvo(e?.message || "Falha ao carregar evolução por classe");
      } finally {
        if (alive) setLoadingEvo(false);
      }
    })();
    return () => { alive = false; };
  }, [urlEvolucao, classeId, modo]);

  const evoFiltrado = React.useMemo(() => {
    const arr = Array.isArray(evo) ? [...evo] : [];
    if (!arr.length) return arr;
    if (periodo === "inicio") return arr;
    if (periodo === "12m") return arr.slice(-12);
    if (periodo === "24m") return arr.slice(-24);
    const anoAtual = String(new Date().getFullYear());
    const doAno = arr.filter((p) => typeof p.mes === "string" && (p.mes.startsWith(anoAtual + "-") || p.mes.endsWith("/" + anoAtual)));
    return doAno.length ? doAno : arr.slice(-12);
  }, [evo, periodo]);

  // ⚠️ Nem sempre o back retorna array vazio; pode vir meses com tudo = 0.
  // Considera “sem dados” quando não há NENHUM valor positivo em investido/atual.
  const hasEvoData = React.useMemo(() => {
    return Array.isArray(evoFiltrado) && evoFiltrado.some(p => {
      const inv = Number(p?.investido ?? 0);
      const atu = Number(p?.atual ?? 0);
      return inv > 0 || atu > 0;
    });
  }, [evoFiltrado]);

  // ---------- Fluxo mensal por ATIVO (stacked bars) ----------
  const [fluxoMesAtivo, setFluxoMesAtivo] = React.useState([]); // acumulado por mês [{mes:'YYYY-MM', ativo:'PETR4', investido, quantidade}]
  const [loadingFluxo, setLoadingFluxo] = React.useState(false);
  const [errFluxo, setErrFluxo] = React.useState("");

  const urlFluxo = React.useMemo(() => {
    return buildUrlFluxo
      ? buildUrlFluxo(classeId, periodo)
      : `${apiBase}/investimentos/posicao-mensal-por-ativo?periodo=${encodeURIComponent(periodo)}&classe_id=${encodeURIComponent(classeId ?? "")}`;
  }, [buildUrlFluxo, apiBase, classeId, periodo]);

  React.useEffect(() => {
    if (!classeId || modo !== "ativos") return;
    let alive = true;
    (async () => {
      setLoadingFluxo(true);
      setErrFluxo("");
      try {
        const token = localStorage.getItem("token");
        console.log('[GPC][ativos] GET', urlFluxo, { classeId, periodo });
        const r = await fetch(urlFluxo, { headers: { Authorization: `Bearer ${token}` } });
        const rows = r.ok ? await r.json() : [];
        console.log('[GPC][ativos] linhas:', Array.isArray(rows)?rows.length:-1,
          Array.isArray(rows)&&rows.length?rows.slice(-3):'[]');        
        if (alive) setFluxoMesAtivo(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (alive) setErrFluxo(e?.message || "Falha ao carregar fluxo mensal por ativo");
      } finally {
        if (alive) setLoadingFluxo(false);
      }
    })();
    return () => { alive = false; };
  }, [urlFluxo, classeId, modo]);

  // Paletas (estilo suave, adaptado p/ claro/escuro)
  const PALETTES = React.useMemo(() => ({
    light: [
  "#2563EB", "#F59E0B", "#10B981", "#EF4444",
  "#8B5CF6", "#06B6D4", "#84CC16", "#F97316",
  "#14B8A6", "#A855F7", "#FB7185", "#EAB308",
    ],
    dark: [
  "#3B82F6", // blue
  "#EAB308", // yellow
  "#10B981", // emerald
  "#EF4444", // red
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#65A30D", // lime (mais escuro p/ não “estourar”)
  "#F59E0B", // amber
  "#14B8A6", // teal
  "#7C3AED", // purple (mais profundo que #A78BFA)
  "#F43F5E", // rose
  "#CA8A04", // amber-600 (diferencia do yellow)
    ],
  }), []);
  const palette = darkMode ? PALETTES.dark : PALETTES.light;

  // Pivot (empilhado): mês -> { mes:'YYYY-MM', ATIVO1:investido_acum, ..., Outros:investido_acum }
  const stackedData = React.useMemo(() => {
    if (!Array.isArray(fluxoMesAtivo) || !fluxoMesAtivo.length) return [];
    // meses já vêm completos do back (carry-forward). Ainda ordenamos:
    const meses = Array.from(new Set(fluxoMesAtivo.map(r => String(r.mes)))).sort();
    // Top-N por valor no ÚLTIMO mês (mais útil para leitura do stack)
    const ultimoMes = meses[meses.length - 1];
    const totalPorAtivo = new Map(); // no último mês
 fluxoMesAtivo.filter(r => r.mes === ultimoMes).forEach(r => {
   totalPorAtivo.set(r.ativo, Number(r.atual || 0));
 });
    const ativosOrdenados = Array.from(totalPorAtivo.entries()).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
    const TOP = 10;
    const topKeys = new Set(ativosOrdenados.slice(0, TOP));
    const result = meses.map(m => {
      const linha = { mes: m };
      const doMes = fluxoMesAtivo.filter(r => r.mes === m);
      let outros = 0;
      for (const r of doMes) {
        const k = String(r.ativo);
        const val = Number(r.atual || 0);     // valor ATUAL acumulado até o mês
        if (topKeys.has(k)) linha[k] = (linha[k] || 0) + val;
        else outros += val;
      }
      if (outros > 0) linha["Outros"] = outros;
      return linha;
    });
    return result;
  }, [fluxoMesAtivo]);

  // Chaves em ORDEM pela fotografia do ÚLTIMO mês (maior → menor).
  // Como o Recharts empilha de baixo p/ cima na ordem dos <Bar>, renderizamos em ASC
  // para que o MAIOR fique por último (no topo).
  const orderedKeysAsc = React.useMemo(() => {
    if (!stackedData.length) return [];
    const last = stackedData[stackedData.length - 1];
    const keys = Object.keys(last).filter(k => k !== 'mes');
    return keys
      .map(k => [k, Number(last[k] || 0)])
      .sort((a, b) => a[1] - b[1]) // ASC → maior por último (topo)
      .map(([k]) => k);
  }, [stackedData]);

  // Tooltip ordenada dinamicamente (mês ativo: maior → menor)
  const ChartTooltipSorted = React.useCallback((props) => {
    const { active, label, payload, ...rest } = props || {};
    const sorted = (payload || []).slice().sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
    return (
      <ChartTooltip
        active={active}
        label={label}
        payload={sorted}
        darkMode={darkMode}
        labelFormatter={(v) => labelMesAAAAMM(String(v))}
        valueFormatter={formatarBRL}
      />
    );
  }, [darkMode]);

  if (!classeId) {
    return (
      <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder">
        <div className="text-sm text-gray-600 dark:text-darkMuted">Selecione uma classe para visualizar.</div>
      </div>
    );
  }

  return (
    <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder overflow-hidden">
      {/* Cabeçalho em 3 colunas: ESQ toggle | CENTRO título | DIR InfoTip */}
{/* Cabeçalho em 3 colunas: ESQ toggle | CENTRO título | DIR InfoTip */}
<div className="mb-2">
  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
    {/* ESQUERDA: Toggle no mesmo estilo do pizza/barras */}
    <div className="justify-self-start">
      <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-darkBorder">
        <button
          onClick={() => setModo('geral')}
          className={`px-3 py-1 text-sm transition-colors ${
            modo === 'geral'
              ? 'bg-blue-600 text-white dark:text-white'
              : 'bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]'
          }`}
        >
          Visão geral
        </button>
        <button
          onClick={() => setModo('ativos')}
          className={`px-3 py-1 text-sm transition-colors ${
            modo === 'ativos'
              ? 'bg-blue-600 text-white dark:text-white'
              : 'bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]'
          }`}
        >
          Por ativo
        </button>
      </div>
    </div>

 {/* CENTRO: título (fixo) */}
 <div className="text-center">
   <h3 className="text-lg font-semibold text-gray-800 dark:text-darkText">
     Patrimônio Mês a Mês
   </h3>
 </div>

    {/* DIREITA: InfoTip */}
    <div className="justify-self-end">
      <InfoTip title="Como ler" ariaLabel="Informações do gráfico">
        {modo === 'geral' ? (
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Valor Aplicado</b> (azul) x <b>Saldo Bruto</b> (roxo) por mês.</li>
            <li>Filtrado pela <b>classe</b> e pelo <b>período</b> selecionados.</li>
          </ul>
        ) : (
          <ul className="list-disc pl-4 space-y-1">
            <li>Cada <b>barra</b> é um mês; as <b>cores</b> são os ativos.</li>
            <li>Segmento = <b>saldo bruto</b> do ativo no mês (qtd acumulada × preço do mês).</li>
            <li>Mostra até <b>Top 10</b>; demais em <b>Outros</b>.</li>
          </ul>
        )}
      </InfoTip>
    </div>
  </div>
</div>

      {/* Corpo */}
      {modo === "geral" ? (
        <>
          {errEvo && <div className="text-sm text-red-600 dark:text-red-400 mb-2">{errEvo}</div>}
          {/* ⤵️ wrapper relativo para confinar o overlay ao gráfico */}
          <div className="relative">
            <ResponsiveContainer width="100%" height={height}>
              <AreaChart data={evoFiltrado}>
              <CartesianGrid stroke={darkMode ? "#21262d" : "#e5e7eb"} strokeDasharray="3 3" />
              <XAxis dataKey="mes" tickFormatter={labelMesAAAAMM} tick={{ fill: darkMode ? "#9ca3af" : "#374151" }} />
              <YAxis tick={{ fill: darkMode ? "#9ca3af" : "#374151" }} tickFormatter={formatarBRL} width={90} />
              <Tooltip
                content={
                  <ChartTooltip
                    darkMode={darkMode}
                    labelFormatter={(v) => labelMesAAAAMM(String(v))}
                    valueFormatter={formatarBRL}
                  />
                }
                cursor={{ stroke: darkMode ? "#374151" : "#e5e7eb", strokeDasharray: "3 3" }}
              />
              <Legend />
              <Area type="monotone" dataKey="investido" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} name="Valor Aplicado" />
              <Area type="monotone" dataKey="atual" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} name="Saldo Bruto" />
              </AreaChart>
            </ResponsiveContainer>
            {/* LOADING: azul + texto 'Carregando dados…' confinado ao gráfico */}
            {loadingEvo && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/30">
                <div
                  className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                  style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }}
                />
                <div className="mt-3 text-xs font-medium text-gray-600 dark:text-darkMuted">
                  Carregando dados…
                </div>
              </div>
            )}
            {/* EMPTY STATE: sem dados (sem esticar a altura do card) */}
            {!loadingEvo && !hasEvoData && !errEvo && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-darkMuted border border-gray-200 dark:border-darkBorder">
                  Sem dados para este período / classe.
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {errFluxo && <div className="text-sm text-red-600 dark:text-red-400 mb-2">{errFluxo}</div>}
          {/* ⤵️ wrapper relativo para confinar o overlay ao gráfico */}
          <div className="relative">
            <ResponsiveContainer width="100%" height={height}>
              <BarChart
                data={stackedData}
                barCategoryGap="65%"
                barGap={2}
              >
              <CartesianGrid stroke={darkMode ? "#21262d" : "#e5e7eb"} strokeDasharray="3 3" />
              <XAxis
                dataKey="mes"
                tickFormatter={labelMesAAAAMM}
                tick={{ fill: darkMode ? "#9ca3af" : "#374151" }}
              />
              <YAxis tick={{ fill: darkMode ? "#9ca3af" : "#374151" }} tickFormatter={formatarBRL} width={90} />
                <Tooltip content={<ChartTooltipSorted />} cursor={{ fill: darkMode ? "rgba(55,65,81,0.08)" : "rgba(229,231,235,0.4)" }} />
              {orderedKeysAsc.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  name={k}
                  stackId="mes"
                  barSize={10}                    /* barras mais finas */
                  fill={palette[i % palette.length]}
  fillOpacity={darkMode ? 0.8 : 0.95}
  stroke={darkMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)"}
  strokeWidth={1}
                />
              ))}
              </BarChart>
            </ResponsiveContainer>
            {/* LOADING: azul + texto, skeleton de barras contido dentro do gráfico */}
            {loadingFluxo && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/30">
                <div
                  className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                  style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }}
                />
                <div className="mt-3 text-xs font-medium text-gray-600 dark:text-darkMuted">
                  Carregando investimentos…
                </div>
                <div className="mt-4 w-11/12 max-w-[900px] h-28 overflow-hidden">
                  <div className="flex items-end justify-between h-full">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2.5 rounded animate-pulse bg-gray-200 dark:bg-slate-800"
                        style={{ height: `${30 + (i % 6) * 10}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* EMPTY STATE: sem dados (sem esticar a altura do card) */}
            {!loadingFluxo && stackedData.length === 0 && !errFluxo && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-darkMuted border border-gray-200 dark:border-darkBorder">
                  Sem dados para este período / classe.
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}