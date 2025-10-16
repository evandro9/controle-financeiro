import React, { useContext, useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { ThemeContext } from "../../../context/ThemeContext";
import InfoTip from "../../ui/InfoTip";
import ScrollArea from "../../ui/ScrollArea";

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct2 = (n) => `${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

// --- Tooltip p/ o treemap (padrão ChartTooltip) ---
function TooltipTreemapDistrib({ active, payload, darkMode, posicoesByTicker = {} }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload || {};
  const cor = d.fill || payload[0]?.color || "#64748b";
  const pos = posicoesByTicker[d.ticker] || {}; // { quantidade, precoMedio, precoAtual, valorAplicado }

  const quantidade = pos.quantidade ?? null;
  const precoMedio  = pos.precoMedio ?? null;
  const precoAtual  = pos.precoAtual ?? null;
  const baseYoC     = (pos.valorAplicado != null) ? pos.valorAplicado
                     : (precoMedio != null && quantidade != null) ? (precoMedio * quantidade) : null;
  const baseDY      = (precoAtual != null && quantidade != null) ? (precoAtual * quantidade)
                     : (precoMedio != null && quantidade != null) ? (precoMedio * quantidade) : null;

  const yoc = (baseYoC && baseYoC > 0) ? (d.valor / baseYoC) * 100 : null;
  const dy  = (baseDY  && baseDY  > 0) ? (d.valor / baseDY)  * 100 : null;

  return (
    <div
      className={
        `rounded-lg shadow-md px-3 py-2 text-sm border ` +
        (darkMode ? `bg-darkCard border-darkBorder text-darkText`
                  : `bg-white border-gray-200 text-gray-800`)
      }
      style={{ minWidth: 240, pointerEvents: "none" }}
      role="tooltip"
    >
      {/* título */}
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-1.5 h-4 rounded" style={{ background: cor }} />
        <div className="font-medium opacity-80 truncate" title={d.name}>{d.name}</div>
      </div>

      {/* linhas */}
      <div className="space-y-1">
        <Linha label="% em Proventos:" valor={pct2(d.pct)} />
        <Linha label="Quantidade atual:" valor={quantidade != null ? quantidade.toLocaleString("pt-BR") : "—"} />
        <Linha label="P. médio atual:"   valor={precoMedio != null ? brl(precoMedio) : "—"} />
        <Linha label="Yield on Cost (YoC):" valor={yoc != null ? pct2(yoc) : "—"} />
        <Linha label="Dividend Yield:"      valor={dy  != null ? pct2(dy)  : "—"} />
        <Linha label="Total acumulado:"     valor={brl(d.valor)} destaque />
      </div>
    </div>
  );
}

function Linha({ label, valor, destaque = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs opacity-80">{label}</span>
      <span className={`text-sm ${destaque ? "font-semibold" : ""}`}>{valor}</span>
    </div>
  );
}

// cor estável por ticker
const hashHue = (s) => {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
};

// garante distância mínima entre cores (maior contraste p/ top items)
const hueDistance = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
const pickHueDistinct = (seedHue, used, minDelta = 50) => {
  let h = seedHue % 360, tries = 0;
  while (used.some(u => hueDistance(h, u) < minDelta) && tries < 12) {
    h = (h + minDelta) % 360; // gira em passos grandes até separar
    tries++;
  }
  return h;
};
const colorFromHue = (h, dark) => {
  const sat = dark ? 70 : 65;
  const light = dark ? 42 : 58;
  return `hsl(${h} ${sat}% ${light}%)`;
};

// helpers p/ ajuste de textos
const approxMaxChars = (pxWidth, fontPx) => Math.floor(pxWidth / (fontPx * 0.62)); // ~avg char width
const fitOrDots = (txt, pxWidth, fontPx) => {
  const max = approxMaxChars(pxWidth, fontPx);
  if (max <= 0) return "…";
  return String(txt || "").length > max ? "…" : String(txt || "");
};

// célula customizada com textos
function CelulaTreemap(props) {
  const { darkMode } = useContext(ThemeContext);
  const {
    x, y, width, height, name, valor, pct, fill
  } = props;

  // padding para criar "espaço" entre os cards
  const pad = 2; // ajuste fino do gutter
  const ix = x + pad;
  const iy = y + pad;
  const iw = Math.max(0, width - pad * 2);
  const ih = Math.max(0, height - pad * 2);

  // cor de fundo que aparece no "gutter":
  // - claro: branco
  // - escuro: leve branco translúcido (mais sutil que preto chapado)
  const gapFill = darkMode ? "rgba(255,255,255,0.05)" : "#ffffff";

  // Cores menos "estouradas" no dark
const colMain = darkMode ? "rgba(255,255,255,0.9)"  : "#ffffff";           // título e %
const colSoft = darkMode ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.85)"; // subtítulo

  if (width <= 60 || height <= 40) {
    // mini tile (só o ticker)
    return (
      <g>
        {/* fundo do tile (preenche o "gutter") */}
        <rect x={x} y={y} width={width} height={height} fill={gapFill} />
        {/* tile interno colorido */}
        <rect x={ix} y={iy} width={iw} height={ih} rx={10} ry={10} fill={fill} />
        <text x={ix + 8} y={iy + 18} fontSize={10} fontWeight={700} fill={colMain}>
          {fitOrDots(name?.slice(0, 6), iw - 16, 10)}
        </text>
      </g>
    );
  }

  const label1 = String(name || "");
  const label2 = pct2(pct); // "20,68%"
  const label3 = "Total acumulado:";
  const label4 = brl(valor);

  // largura útil de texto (12px de margem interna nas laterais)
  const tw = Math.max(0, iw - 24);
  // Controle de altura: se faltar espaço vertical, mostramos "…" no lugar da linha que não cabe
  const need4 = 86; // ~altura p/ 4 linhas (18 / 36 / 56 / 74)
  const need3 = 64; // ~altura p/ 3 linhas (18 / 36 / 56)
  const need2 = 42; // ~altura p/ 2 linhas (18 / 36)
  const show4 = ih >= need4;
  const show3 = ih >= need3;
  const show2 = ih >= need2;
  return (
    <g>
      {/* fundo do tile (aparece como separação entre os cards) */}
      <rect x={x} y={y} width={width} height={height} fill={gapFill} />
      {/* retângulo interno menor = cria "gutter" entre as células */}
      <rect x={ix} y={iy} width={iw} height={ih} rx={14} ry={14} fill={fill} />
      {/* Linha 1: Título */}
      <text x={ix + 12} y={iy + 18} fontSize={11} fontWeight={700} fill={colMain}>
        {fitOrDots(label1, tw, 11)}
      </text>
      {/* Linha 2: % */}
      <text x={ix + 12} y={iy + 36} fontSize={12} fontWeight={700} fill={colMain}>
        {show2 ? fitOrDots(label2, tw, 12) : "…"}
      </text>
      {/* Linha 3: "Total acumulado:" */}
      <text x={ix + 12} y={iy + 56} fontSize={11} fill={colSoft}>
        {show3 ? fitOrDots(label3, tw, 11) : "…"}
      </text>
      {/* Linha 4: valor */}
      <text x={ix + 12} y={iy + 74} fontSize={13} fontWeight={700} fill={colMain}>
        {show4 ? fitOrDots(label4, tw, 13) : "…"}
      </text>
    </g>
  );
}

export default function GraficoDistribuicaoProventos({ inicio, fim, posicoesByTicker = {}, onTickersChange }) {
  const { darkMode } = useContext(ThemeContext);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState("grafico"); // 'grafico' | 'tabela'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const raw = (localStorage.getItem("token") || '').trim();
        const bearer = raw ? (raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`) : '';
        const url = new URL("/api/investimentos/proventos/distribuicao", window.location.origin);
        if (inicio) url.searchParams.set("inicio", inicio);
        if (fim) url.searchParams.set("fim", fim);
        const r = await fetch(url.toString(), {
          headers: bearer ? { Authorization: bearer } : {}
        });
        const data = r.ok ? await r.json() : [];
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => (cancelled = true);
  }, [inicio, fim]);

  const treemapData = useMemo(() => {
    const total = rows.reduce((a, x) => a + Number(x.total || 0), 0);
    // ordena por valor desc para garantir contraste nos maiores
    const base = rows
      .map((r) => ({
        ticker: r.ticker,
        nome_ativo: r.nome_ativo,
        name: `${r.ticker}${r.nome_ativo ? ` - ${r.nome_ativo}` : ""}`,
        valor: Number(r.total || 0),
      }))
      .sort((a, b) => b.valor - a.valor);

    // paleta com distância mínima entre hues (top 2 bem separados)
    const usedHues = [];
    const itens = base.map((r) => {
      const seed = hashHue(String(r.ticker || "X"));
      const hue = pickHueDistinct(seed, usedHues, 50);
      usedHues.push(hue);
      return {
        ticker: r.ticker,
        name: r.name,
        size: Math.max(0.0001, r.valor),
        valor: r.valor,
        pct: total ? (r.valor / total) * 100 : 0,
        fill: colorFromHue(hue, darkMode),
      };
    });
    return { total, itens };
  }, [rows, darkMode]);

  // avisa o pai sempre que o conjunto de tickers visíveis mudar
  useEffect(() => {
    if (!onTickersChange) return;
    const uniq = Array.from(new Set((treemapData.itens || []).map(i => i.ticker))).filter(Boolean);
    onTickersChange(uniq);
  }, [treemapData, onTickersChange]);

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder shadow-sm">
      {/* Cabeçalho com toggle (esquerda), título (centro) e InfoTip (direita) */}
      <div className="grid grid-cols-3 items-center mb-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-darkBorder">
            <button
              onClick={() => setModo("grafico")}
              aria-pressed={modo === "grafico"}
              className={`px-3 py-1 text-sm transition-colors ${
                modo === "grafico"
                  ? "bg-blue-600 text-white dark:text-white"
                  : "bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]"
              }`}
            >
              Gráfico
            </button>
            <button
              onClick={() => setModo("tabela")}
              aria-pressed={modo === "tabela"}
              className={`px-3 py-1 text-sm transition-colors ${
                modo === "tabela"
                  ? "bg-blue-600 text-white dark:text-white"
                  : "bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]"
              }`}
            >
              Tabela
            </button>
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-darkText text-center">
          Distribuição de Proventos por Ativo
        </h3>

        <div className="justify-self-end">
          <InfoTip title={modo === "grafico" ? "Como ler o gráfico" : "Como ler a tabela"}>
            {modo === "grafico" ? (
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li>Cada bloco representa um ativo que pagou proventos no período.</li>
                <li>Tamanho proporcional ao total recebido do ativo.</li>
                <li>Mostra % do total e o valor acumulado.</li>
              </ul>
            ) : (
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li>Lista todos os ativos que receberam proventos no período.</li>
                <li>Inclui % do total, quantidade atual, preço médio, YoC e Dividend Yield.</li>
                <li>Ordenada do maior para o menor valor acumulado.</li>
              </ul>
            )}
          </InfoTip>
        </div>
      </div>

      {/* Área fixa com overlay (tanto para gráfico quanto tabela) */}
      <div className="relative">
        {modo === "grafico" ? (
          <div className="h-[420px]">
            {treemapData.itens.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapData.itens}
                  dataKey="size"
                  stroke={darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                  strokeWidth={1}
                  content={<CelulaTreemap />}
                  animationDuration={500}
                  isAnimationActive
                >
                  <Tooltip content={<TooltipTreemapDistrib darkMode={darkMode} posicoesByTicker={posicoesByTicker} />} />
                </Treemap>
              </ResponsiveContainer>
            )}
          </div>
        ) : (
          <div className="h-[420px]">
            <ScrollArea axis="y" className="h-full">
              <table className="w-full text-sm">
            {/* Cabeçalho sticky dentro da área com scroll */}
            <thead className="text-xs uppercase text-gray-500 dark:text-darkMuted sticky top-0 z-10
                             bg-white dark:bg-darkCard">
              <tr>
                <th className="text-left py-2">Ativo</th>
                <th className="text-right py-2">% Proventos</th>
                <th className="text-right py-2">Quantidade</th>
                <th className="text-right py-2">P. médio</th>
                <th className="text-right py-2">YoC</th>
                <th className="text-right py-2">Dividend Yield</th>
                <th className="text-right py-2">Total acumulado</th>
              </tr>
            </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700/50">
                  {[...treemapData.itens]
                    .sort((a, b) => b.valor - a.valor)
                    .map((it) => {
                      const pos = posicoesByTicker[it.ticker] || {};
                      const q  = pos.quantidade ?? null;
                      const pm = pos.precoMedio ?? null;
                      const pa = pos.precoAtual ?? null;
                      const va = pos.valorAplicado ?? (pm != null && q != null ? pm * q : null);
                      const baseDY = (pa != null && q != null) ? pa * q : (pm != null && q != null ? pm * q : null);
                      const yoc = va  && va  > 0 ? (it.valor / va)  * 100 : null;
                      const dy  = baseDY && baseDY > 0 ? (it.valor / baseDY) * 100 : null;
                      return (
                        <tr key={it.ticker}>
                          <td className="py-2 text-left">{it.name}</td>
                          <td className="py-2 text-right">{pct2(it.pct)}</td>
                          <td className="py-2 text-right">{q != null ? q.toLocaleString("pt-BR") : "—"}</td>
                          <td className="py-2 text-right">{pm != null ? brl(pm) : "—"}</td>
                          <td className="py-2 text-right">{yoc != null ? pct2(yoc) : "—"}</td>
                          <td className="py-2 text-right">{dy  != null ? pct2(dy)  : "—"}</td>
                          <td className="py-2 text-right">{brl(it.valor)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {/* Total dentro da área rolável, mantendo altura fixa de 420px */}
              <div className="pt-3 pb-2 text-right text-sm font-semibold text-gray-700 dark:text-darkText">
                Total do período: {brl(treemapData.total)}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* LOADING overlay unificado */}
        {loading && (
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

        {/* EMPTY overlay (não aumenta a altura do card) */}
        {!loading && treemapData.itens.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-darkMuted border border-gray-200 dark:border-darkBorder">
              Sem proventos neste período.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}