import React, { useMemo, useContext, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LabelList
} from "recharts";
import InfoTip from "../../ui/InfoTip";
import { ThemeContext } from "../../../context/ThemeContext";

// Abreviação BRL: 1.2K / 3.4M / 1.1B
function formatBRLAbrev(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const fmt = (num, suf) =>
    `R$ ${num.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${suf}`;
  if (abs >= 1e9) return fmt(v / 1e9, "B");
  if (abs >= 1e6) return fmt(v / 1e6, "M");
  if (abs >= 1e3) return fmt(v / 1e3, "K");
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Label dentro do segmento: "R$ 120 (35%)" apenas se o bloco for representativo
const LabelSegmento = (props) => {
  const { x, y, width, height, value, payload } = props;
  const total = Number(payload?.total || 0);
  const v = Number(value || 0);
  if (!total || v / total < 0.12 || height < 16 || width < 42) return null;
  const pct = Math.round((v / total) * 100);
  const txt = `${v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} (${pct}%)`;
  return (
    <g>
      <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" className="text-[10px] fill-white">
        {txt}
      </text>
    </g>
  );
};

// Tooltip suave com % de participação
const TooltipProventos = ({ active, payload, label }) => {
  const { darkMode } = useContext(ThemeContext);
  if (!active || !payload || !payload.length) return null;
  const linha = payload[0]?.payload || {};
  const total = Number(linha.total || 0);

  return (
    <div className={`rounded-lg shadow px-3 py-2 text-sm border transition
      ${darkMode ? "bg-darkCard border-darkBorder text-darkText" : "bg-white border-gray-200 text-gray-800"}`}>
      <div className="font-semibold mb-1">{label}</div>
      {(() => {
        const itens = payload
          .filter(p => typeof p?.value === "number" && p.dataKey !== "total")
          .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
        const top5 = itens.slice(0, 5);
        const outros = itens.slice(5);
        const outrosValor = outros.reduce((acc, p) => acc + Number(p.value || 0), 0);
        const Linha = ({ nome, cor, valor }) => {
          const v = Number(valor || 0);
          const pct = total ? Math.round((v / total) * 100) : 0;
          return (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded" style={{ background: cor || "#64748b" }} />
                <span className="opacity-80">{nome}</span>
              </div>
              <span className="font-semibold">
                {v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                {total ? ` (${pct}%)` : ""}
              </span>
            </div>
          );
        };
        return (
          <>
            {top5.map((p, i) => (
              <Linha key={p.dataKey || i} nome={p.dataKey} cor={p.color} valor={p.value} />
            ))}
            {outrosValor > 0 && (
              <Linha nome="Outros" cor={darkMode ? "#6b7280" : "#9ca3af"} valor={outrosValor} />
            )}
          </>
        );
      })()}
      <div className="mt-2 text-xs opacity-70">
        Total mês: <b>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</b>
      </div>
    </div>
  );
};

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const formatMesLabel = (yyyymm) => {
  if (typeof yyyymm === "string" && /^\d{4}-\d{2}$/.test(yyyymm)) {
    const [y, m] = yyyymm.split("-").map(Number);
    return `${MESES_PT[m - 1]}/${String(y).slice(-2)}`;
  }
  try {
    const d = new Date(yyyymm);
    return `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
  } catch {
    return String(yyyymm);
  }
};

// cor determinística por ativo
function corAtivo(nome) {
  const cores = ["#4F46E5","#22C55E","#06B6D4","#F59E0B","#EF4444","#A78BFA","#0EA5E9","#F97316","#14B8A6","#E11D48"];
  let hash = 0; for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return cores[hash % cores.length];
}

export default function GraficoProventos({ historico, carregando = false }) {
  const { darkMode } = useContext(ThemeContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAnimate, setDrawerAnimate] = useState(false); // controla a transição
  const [mesSelecionado, setMesSelecionado] = useState(null); // "YYYY-MM"
  const [detalhes, setDetalhes] = useState([]);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [erroDetalhes, setErroDetalhes] = useState("");

  // Paleta/estilos alinhados ao GraficoHistoricoPatrimonio
  const gridStroke   = darkMode ? "#21262d" : "#e5e7eb"; // linhas de fundo mais discretas
  const axisColor    = darkMode ? "#9ca3af" : "#374151"; // cor do texto dos eixos
  const axisLine     = darkMode ? "#334155" : "#CBD5E1"; // linha do eixo (clarinha)

  const data = useMemo(() => {
    return (historico || []).map((row) => {
      const mesRaw = String(row.mes).slice(0, 7); // "YYYY-MM"
      const linha = { mesRaw, mesFmt: formatMesLabel(row.mes), total: Number(row.total || 0) };
      const ativos = row.ativos || {};
      Object.keys(ativos).forEach((k) => (linha[k] = Number(ativos[k] || 0)));
      return linha;
    });
  }, [historico]);

  // Há dados “reais”? (não basta vir array com zeros)
  const hasData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return false;
    return data.some(d => Number(d?.total || 0) > 0);
  }, [data]);

  function nomeMesAno(mesRaw) {
    if (!mesRaw) return "";
    const [y, m] = mesRaw.split("-");
    const nome = new Date(Number(y), Number(m) - 1, 1).toLocaleString("pt-BR", { month: "long" });
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${y}`;
  }

  async function abrirDrawerMes(mesRaw) {
    try {
      setMesSelecionado(mesRaw);
      setDrawerOpen(true);
      // aguarda o mount para animar a entrada
      requestAnimationFrame(() => setDrawerAnimate(true));
      setLoadingDetalhes(true);
      setErroDetalhes("");
      const raw  = (localStorage.getItem("token") || '').trim();
      const auth = raw ? (raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`) : '';
      const [y, m] = mesRaw.split("-");
      const lastDay = new Date(Number(y), Number(m), 0).getDate(); // último dia do mês
      const inicio = `${y}-${m}-01`;
      const fim = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
      const res = await fetch(
        `/api/investimentos/proventos/lista?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`,
        { headers: auth ? { Authorization: auth } : {} }
      );
      if (!res.ok) throw new Error("Falha ao carregar proventos do mês");
      const arr = await res.json();
      setDetalhes(Array.isArray(arr) ? arr : []);
    } catch (e) {
      setErroDetalhes("Não foi possível carregar os proventos deste mês.");
    } finally {
      setLoadingDetalhes(false);
    }
  }

    // ---- AGRUPAR DETALHES POR ATIVO (para o drawer) ----
  const grupos = React.useMemo(() => {
    if (!Array.isArray(detalhes) || !detalhes.length) return [];
    const totalMes = detalhes.reduce((acc, x) => acc + Number(x?.valor_bruto || 0), 0);
    const map = {};
    for (const d of detalhes) {
      const key = d.ticker || d.nome_ativo || "—";
      if (!map[key]) map[key] = { ticker: d.ticker || key, nome_ativo: d.nome_ativo || "", valor: 0 };
      map[key].valor += Number(d.valor_bruto || 0);
    }
    const arr = Object.values(map).map((r) => ({
      ...r,
      pct: totalMes ? (r.valor / totalMes) * 100 : 0,
    }));
    // Ordena por valor desc
    arr.sort((a, b) => b.valor - a.valor);
    return { totalMes, itens: arr };
  }, [detalhes]);

  const ativosKeys = useMemo(() => {
    // soma total por ativo e ordena do menor -> maior (o maior fica por cima da pilha)
    const totals = {};
    (historico || []).forEach((r) => {
      Object.entries(r.ativos || {}).forEach(([k, v]) => {
        totals[k] = (totals[k] || 0) + Number(v || 0);
      });
    });
    return Object.keys(totals).sort((a, b) => (totals[a] - totals[b]));
  }, [historico]);

  // hover/cursor MUITO suave no dark/light (BarChart usa retângulo preenchido)
  const cursorFill = darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";

  // Clique robusto: funciona no BarChart e em cada Bar
  const handleBarClick = (arg) => {
   try {
      // tenta várias fontes: chart -> bar segment -> label ativa
      let mesRaw =
        arg?.activePayload?.[0]?.payload?.mesRaw ||   // clique no chart (activePayload)
        arg?.payload?.payload?.mesRaw ||              // clique no segmento (payload dentro de payload)
        arg?.payload?.mesRaw ||                       // clique no bar (payload direto)
        null;
      if (!mesRaw && arg?.activeLabel) {
        // resolve pelo rótulo do eixo X
        const hit = (data || []).find(d => d.mesFmt === arg.activeLabel);
        if (hit) mesRaw = hit.mesRaw;
      }
      if (mesRaw) abrirDrawerMes(mesRaw);
    } catch {}
  };

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder shadow-sm">
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-darkText text-center">
          Proventos por Mês
        </h3>
        <div className="absolute right-0">
          <InfoTip title="Como ler este gráfico" ariaLabel="Informações">
            <ul className="list-disc pl-4 space-y-1">
              <li>Barra = total de proventos do mês.</li>
              <li>Segmentos coloridos = quanto cada ativo pagou.</li>
              <li>Passe o mouse para ver o valor e a % do mês.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      <div className="relative h-[240px] sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 8, right: 8 }}
            onClick={handleBarClick}
          >
          {/* Grid tracejado sutil (mesma linguagem dos outros gráficos) */}
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
          <XAxis
            dataKey="mesFmt"
            tick={{ fontSize: 12, fill: axisColor }}
            tickMargin={8}
            axisLine={{ stroke: axisLine }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: axisColor }}
            tickMargin={6}
            width={80}
            axisLine={{ stroke: axisLine }}
            tickLine={false}
            tickFormatter={formatBRLAbrev}
          />
          {/* Tooltip e cursor com o mesmo “peso visual” dos demais */}
          <Tooltip content={<TooltipProventos />} cursor={{ fill: cursorFill }} />
          {/* Sem Legend: usuário vê pelo hover */}
          {ativosKeys.map((k, i) => {
            const isTop = i === ativosKeys.length - 1; // último fica por cima
            return (
              <Bar
                key={k}
                dataKey={k}
                stackId="m"
                fill={corAtivo(k)}
                stroke="transparent"
                radius={isTop ? [6, 6, 0, 0] : [0, 0, 0, 0]} // topo arredondado só na camada superior
                className="cursor-pointer"
                onClick={handleBarClick}
              >
                <LabelList content={<LabelSegmento />} />
              </Bar>
            );
          })}
          </BarChart>
        </ResponsiveContainer>

        {/* LOADING overlay: azul + mensagem (confinado ao gráfico) */}
        {carregando && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/30 rounded">
            <div
              className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }}
            />
            <div className="mt-3 text-xs font-medium text-gray-600 dark:text-darkMuted">
              Carregando dados…
            </div>
          </div>
        )}

        {/* EMPTY overlay: sem proventos no período (não estica o card) */}
        {!carregando && !hasData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-darkMuted border border-gray-200 dark:border-darkBorder">
              Sem proventos neste período.
            </div>
          </div>
        )}
      </div>

              {/* Drawer lateral com os proventos do mês */}
      {drawerOpen && (
        <>
          {/* Backdrop com fade suave */}
          <div
            className={
              "fixed inset-0 z-40 bg-black/30 transition-opacity duration-500 " +
              (drawerAnimate ? "opacity-100" : "opacity-0")
            }
            onClick={() => {
              setDrawerAnimate(false);
              setTimeout(() => setDrawerOpen(false), 500);
            }}
          />
          {/* Painel com slide suave (ease custom) */}
          <div
            className={
              "fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white dark:bg-darkCard " +
              "border-l border-gray-100 dark:border-darkBorder shadow-2xl flex flex-col " +
              "transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] " +
              (drawerAnimate ? "translate-x-0" : "translate-x-full")
            }
          >
            <div className="p-4 border-b border-gray-100 dark:border-darkBorder flex items-center justify-between">
              <div className="font-semibold text-gray-800 dark:text-darkText">
                Proventos — {nomeMesAno(mesSelecionado)}
              </div>
              <button
                onClick={() => {
                 setDrawerAnimate(false);
                  setTimeout(() => setDrawerOpen(false), 500);
                }}
                className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {loadingDetalhes && <div className="text-sm text-gray-500 dark:text-darkMuted">Carregando…</div>}
              {!loadingDetalhes && erroDetalhes && <div className="text-sm text-red-600 dark:text-red-400">{erroDetalhes}</div>}
              {!loadingDetalhes && !erroDetalhes && (
                <>
                  {(!detalhes || !detalhes.length) ? (
                    <div className="text-sm text-gray-500 dark:text-darkMuted">Sem proventos neste mês.</div>
                  ) : (
                    <div className="space-y-3">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 dark:text-darkMuted">
                          <tr>
                            <th className="text-left py-1">Ativo</th>
                            {/* responsivo: mais espaço no mobile, ajusta no desktop */}
                            <th className="text-left py-1 w-2/3 sm:w-1/2 md:w-2/5">Participação</th>
                            <th className="text-left py-1">% Proventos</th>
                            <th className="text-right py-1">Valor</th>
                          </tr>
                        </thead>
                        {/* linhas mais delicadas no dark */}
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700/50">
                          {grupos.itens.map((g, i) => (
                            <tr key={`${g.ticker}-${i}`}>
                              {/* Ativo */}
                              <td className="py-2 text-left">
                                <span className="font-medium">{g.ticker}</span>
                                {g.nome_ativo ? <span className="opacity-70"> — {g.nome_ativo}</span> : null}
                              </td>
                              {/* Barra de participação */}
                              <td className="py-2 text-left w-2/3 sm:w-1/2 md:w-2/5">
                                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-slate-800/70">
                                  <div
                                    className="h-2 rounded-full bg-indigo-500 dark:bg-indigo-400"
                                    style={{ width: `${Math.max(0, Math.min(100, g.pct))}%` }}
                                  />
                                </div>
                              </td>
                              {/* % Proventos */}
                              <td className="py-2 text-left">
                               {g.pct.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}%
                              </td>
                              {/* Valor */}
                              <td className="py-2 text-right">
                                {g.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="pt-2 text-sm font-semibold text-right text-gray-700 dark:text-darkText">
                        Total do mês:{" "}
                        {(grupos.totalMes || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}