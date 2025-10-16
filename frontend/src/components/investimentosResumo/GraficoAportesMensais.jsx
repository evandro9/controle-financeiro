// src/components/investimentosResumo/GraficoAportesMensais.jsx
import React from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell
} from "recharts";
import InfoTip from "../ui/InfoTip";
import ChartTooltip from "../ui/ChartTooltip";
import { ThemeContext } from "../../context/ThemeContext";
import NoData from "../ui/NoData";

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function labelMesAAAAMM(s) {
  s = String(s || "");
  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split("-").map(Number);
    return `${MESES_PT[m - 1]}/${String(y).slice(-2)}`;
  }
  if (/^\d{2}\/\d{4}$/.test(s)) {
    const [m, y] = s.split("/").map(Number);
    return `${MESES_PT[m - 1]}/${String(y).slice(-2)}`;
  }
  // fallback
  try { const d = new Date(s); return `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`; }
  catch { return s; }
}
function parseOrder(s) {
  // normaliza para Date comparável (YYYY-MM preferido)
  s = String(s || "");
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(s + "-01").getTime();
  if (/^\d{2}\/\d{4}$/.test(s)) { const [m,y] = s.split("/").map(Number); return new Date(`${y}-${String(m).padStart(2,"0")}-01`).getTime(); }
  const t = Date.parse(s); return isNaN(t) ? 0 : t;
}
const fmtBRL = (v) => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});

export default function GraficoAportesMensais({
  dadosEvolucao = [],
  periodo,
  height = 280,
  titulo = "Aportes x Resgates Mensais",
  // 👉 opções para corrigir o 1º mês
  primeiroMesComoZero = true,
  baselinePrimeiroMes = null, // se você souber o investido do mês anterior ao período, passe aqui
  carregando = false,
}) {
  const { darkMode } = React.useContext(ThemeContext);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // garante ordem cronológica e calcula Δ do "investido" (Valor Aplicado)
  const linhas = React.useMemo(() => {
    const arr = Array.isArray(dadosEvolucao) ? [...dadosEvolucao] : [];
    arr.sort((a,b) => parseOrder(a.mes) - parseOrder(b.mes));
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const temFluxos =
        arr[i]?.aportes_mes != null || arr[i]?.resgates_mes != null || arr[i]?.liquido_mes != null;

      // Sempre duas séries: Aportes (>=0) e Resgates (<=0)
      let aporte = 0;
      let resgate = 0;
      if (temFluxos) {
        const a = Number(arr[i]?.aportes_mes ?? 0);
        const r = Number(arr[i]?.resgates_mes ?? 0); // convenção: já vem NEGATIVO
        aporte = Math.max(0, a);
        resgate = Math.min(0, r);
      } else {
        // Fallback: derivar pelos acumulados de "investido"
        const cur = Number(arr[i]?.investido ?? arr[i]?.valor_investido ?? 0);
        let prev = null;
        if (i > 0) {
          prev = Number(arr[i-1]?.investido ?? arr[i-1]?.valor_investido ?? 0);
        } else if (baselinePrimeiroMes != null) {
          prev = Number(baselinePrimeiroMes);
        }
        const delta = (prev === null)
          ? (primeiroMesComoZero ? 0 : cur)
          : (cur - prev);
        aporte = Math.max(0, delta);
        resgate = Math.min(0, delta);
      }
      const row = {
        mes: arr[i]?.mes,
        mesLabel: labelMesAAAAMM(arr[i]?.mes),
        aporte,
        resgate,
        // valores exibidos diretamente no gráfico
        aporteExibido: Math.max(0, aporte), // sempre ≥ 0
        resgateExibido: resgate,            // mantém NEGATIVO para tooltip
        resgatePlot: Math.abs(resgate)      // plota POSITIVO pra barra ficar acima do zero
      };
      out.push(row);
    }
     return out;
   }, [dadosEvolucao, primeiroMesComoZero, baselinePrimeiroMes]);

  const barColorAporte = darkMode ? "#10B981" : "#22C55E"; // emerald
  const barColorResgate = "#EF4444"; // red

  const hasData = React.useMemo(
    () => Array.isArray(linhas) && linhas.some(l => (
      Number(l?.aporteExibido || 0) !== 0 ||
      Number(l?.resgatePlot || 0) !== 0
    )),
    [linhas]
  );



  return (
    <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder">
      {/* Cabeçalho: versão mobile (titulo central + InfoTip à direita) e versão desktop */}
      {/* MOBILE */}
      <div className="sm:hidden relative h-7 mb-2">
        <h3 className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 text-base font-semibold text-gray-800 dark:text-darkText">
          Aportes x Resgates
        </h3>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <InfoTip title="Como ler">
            <ul className="list-disc pl-4 space-y-1">
              <li>Mostra <b>aportes</b> (verde) e <b>resgates</b> (vermelho) por mês.</li>
              <li>Respeita o <b>período</b> selecionado.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden sm:grid mb-2 grid-cols-3 items-center gap-2">
        {/* ESQUERDA: vazio (sem checkbox) */}
        <div className="justify-self-start" />
        {/* CENTRO: título com estado (desktop) */}
        <h3 className="text-base md:text-lg font-semibold text-gray-800 dark:text-darkText text-center">
          {titulo}
        </h3>
        {/* DIREITA: dica rápida */}
        <div className="justify-self-end">
          <InfoTip title="Como ler este gráfico">
            <ul className="list-disc pl-4 space-y-1">
              <li>Mostra <b>aportes</b> (verde) e <b>resgates</b> (vermelho) por mês.</li>
              <li>Respeita o <b>período</b> selecionado.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={isMobile ? 240 : height}>
          <BarChart
            data={linhas}
            barSize={16}
            margin={{ left: 8, right: 8, top: 8, bottom: 4 }}
          >
          <CartesianGrid stroke={darkMode ? "#21262d" : "#e5e7eb"} strokeDasharray="3 3" />
          <XAxis
            dataKey="mes"
            tickFormatter={labelMesAAAAMM}
            tick={{ fill: darkMode ? "#9ca3af" : "#374151" }}
          />
          <YAxis
            tick={{ fill: darkMode ? "#9ca3af" : "#374151" }}
            tickFormatter={fmtBRL}
            width={90}
          />
          <ReferenceLine y={0} stroke={darkMode ? "#374151" : "#9CA3AF"} />
          <Tooltip
            cursor={{ fill: darkMode ? "rgba(55,65,81,0.08)" : "rgba(229,231,235,0.4)" }}
            content={
              <ChartTooltip
                darkMode={darkMode}
                labelFormatter={(v) => labelMesAAAAMM(String(v))}
                valueFormatter={fmtBRL}
              />
            }
          />
          <Bar isAnimationActive animationDuration={700} dataKey="aporteExibido" name="Aportes" fill={barColorAporte} />
          {/* Resgates: plota valor POSITIVO para a barra ficar acima do zero */}
          <Bar isAnimationActive animationDuration={700} dataKey="resgatePlot" name="Resgates" fill={barColorResgate} />
          </BarChart>
        </ResponsiveContainer>

        {/* LOADING overlay */}
        {carregando && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/30">
            <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                 style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }} />
            <div className="mt-3 text-xs font-medium text-gray-600 dark:text-darkMuted">
              Carregando dados…
            </div>
          </div>
        )}

        {/* EMPTY overlay */}
        {!carregando && !hasData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-darkMuted border border-gray-200 dark:border-darkBorder">
              Sem aportes/resgates no período selecionado.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}