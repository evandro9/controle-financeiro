import React, { useContext } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import InfoTip from "../../ui/InfoTip";
import { ThemeContext } from "../../../context/ThemeContext";
import NoData from "../../ui/NoData";

// paleta consistente com o resto do sistema
const PALETA = [
  "#06B6D4", "#A855F7", "#10B981", "#F59E0B",
  "#EF4444", "#0EA5E9", "#F97316", "#22C55E",
  "#4F46E5", "#E11D48", "#14B8A6", "#64748B",
];

// Tooltip com quadradinho da cor do slice
const PieTooltip = ({ active, payload }) => {
  const { darkMode } = useContext(ThemeContext);
  if (!active || !payload?.length) return null;
  const p = payload[0];
  // usa originalName salvo no payload para não truncar
  const nome = String(p?.payload?.originalName ?? p?.name ?? p?.payload?.name ?? "—");
  const val = Number(p?.value ?? 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  });
  const cor = p?.color || p?.payload?.fill || "#06B6D4";

  return (
    <div className={`rounded-lg shadow-md px-3 py-2 text-sm border ${
      darkMode ? "bg-darkCard border-darkBorder text-darkText"
               : "bg-white border-gray-200 text-gray-800"
    }`}>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded" style={{ background: cor }} />
        <span className="font-medium">{nome}</span>
      </div>
      <div className="mt-1 font-semibold">{val}</div>
    </div>
  );
};

/**
 * props:
 * - titulo: string (ex.: "Ações — Distribuição por Ativo")
 * - dados:  Array<{ name: string, value: number }>
 */
export default function GraficoPizzaClasse({
  titulo,
  dados = [],
  carregando = false,
  // 👇 opcionais para auto-fetch filtrado por classe
  classeId,
  classe,
  apiBase = import.meta.env.VITE_API_URL ?? "/api",
}) {
  const { darkMode } = React.useContext(ThemeContext);
  const [showLabels, setShowLabels] = React.useState(false);
  const [localData, setLocalData] = React.useState([]);
  const [busy, setBusy] = React.useState(false);  

  // Sempre que os dados mudarem, esconda labels até a nova animação terminar
  React.useEffect(() => {
    setShowLabels(false);
  }, [dados?.length]);

  // auto-fetch (opcional) quando não vierem dados do pai
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if ((dados?.length ?? 0) > 0) { setLocalData(dados); return; }
      if (!classeId && !classe) { setLocalData([]); return; }
      try {
        setBusy(true);
        const qs = new URLSearchParams();
        // Preferimos ID. Só envia 'classe' (nome) se NÃO houver ID.
        if (classeId != null && classeId !== '') qs.set('classe_id', String(classeId));
        else if (classe) qs.set('classe', String(classe));
        const token = localStorage.getItem('token');
        const url = `${apiBase}/investimentos/atuais?${qs.toString()}`;
        console.log('[GPC][pizza] fetch', url, { classeId, classe });
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const j = r.ok ? await r.json() : [];
        const arr = Array.isArray(j) ? j : [];
        const norm = arr.map(it => ({
          name: String(it.nome_investimento || ''),
          value: Number(it.valor_atual || 0)
        })).filter(x => x.value > 0);
        console.log('[GPC][pizza] itens:', arr.length, 'soma=', arr.reduce((a,b)=>a+Number(b.valor_atual||0),0));
        if (alive) setLocalData(norm);
      } catch {
        if (alive) setLocalData([]);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [dados, classeId, classe, apiBase]);

  // garantir nomes curtos no rótulo externo, preservando o nome completo para tooltip
  const base = (localData?.length ? localData : dados);
  const dataNorm = base.map(d => ({
    ...d, 
    originalName: String(d.name ?? d.fullName ?? d.nome ?? ""), // nome completo p/ tooltip
    name: String(d.name ?? d.fullName ?? d.nome ?? "").slice(0, 12).toUpperCase(), // rótulo curto no gráfico
  }));

  return (
    <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder min-h-[360px]">
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-darkText text-center">
          {titulo}
        </h3>
        <div className="absolute right-0">
          <InfoTip title="Como ler este gráfico">
            <ul className="list-disc pl-4 space-y-1">
              <li>Mostra a proporção do <b>valor atual</b> da classe selecionada.</li>
              <li>Passe o mouse nas fatias para ver valores em reais.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* LOADING overlay: agora também quando a classe muda (mesmo com dados visíveis) */}
      {(carregando || busy) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/30 rounded pointer-events-none">
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }}
          />
          <div className="mt-3 text-xs font-medium text-gray-600 dark:text-darkMuted">
            Carregando investimentos…
          </div>
        </div>
      )}

      {/* EMPTY STATE: overlay absoluto (não aumenta a altura do card) */}
      {!carregando && dataNorm.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded pointer-events-none">
          <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-darkMuted border border-gray-200 dark:border-darkBorder">
            Sem dados para este período / classe.
          </div>
        </div>
      )}

      {/* Gráfico: só renderiza quando há dados; senão, placeholder fixo para manter a altura */}
      {dataNorm.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
            data={dataNorm}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={1}
            isAnimationActive
            // quando a animação terminar, liberamos os rótulos externos
            onAnimationEnd={() => setShowLabels(true)}
            stroke="transparent"   // evita “borda branca” no dark
            strokeWidth={0}
            label={(props) => {
              if (!showLabels) return null;     // 👈 só mostra após “assentar”
              const { cx, cy, midAngle, outerRadius, percent, name } = props;
              const pct = (percent || 0) * 100;
              if (pct < 3) return null; // oculta fatias muito pequenas
              const RAD = Math.PI / 180;
              // ponto na borda da fatia
              const sx = cx + outerRadius * Math.cos(-midAngle * RAD);
              const sy = cy + outerRadius * Math.sin(-midAngle * RAD);
              // ponto intermediário (curvinha)
              const mx = cx + (outerRadius + 10) * Math.cos(-midAngle * RAD);
              const my = cy + (outerRadius + 10) * Math.sin(-midAngle * RAD);
              // ponto final (onde fica o texto)
              const ex = cx + (outerRadius + 40) * Math.cos(-midAngle * RAD);
              const ey = cy + (outerRadius + 40) * Math.sin(-midAngle * RAD);
              const textAnchor = ex > cx ? "start" : "end";
              const label = `${String(name).toUpperCase()} ${pct.toFixed(1).replace(".0","")}%`;
              // 🔧 cores mais legíveis no dark (menos branco): stroke = slate-600, fill = slate-300
              const stroke = darkMode ? "#475569" : "#CBD5E1";
              const fill   = darkMode ? "#CBD5E1" : "#374151";
              return (
                <g>
                  <polyline
                    points={`${sx},${sy} ${mx},${my} ${ex},${ey}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1}
                  />
                  <text
                    x={ex + (textAnchor === "start" ? 6 : -6)}
                    y={ey}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    style={{ fontSize: 11, fontWeight: 600, fill }}
                  >
                    {label}
                  </text>
                </g>
              );
            }}
            labelLine={false}
          >
            {dataNorm.map((entry, i) => (
              <Cell key={`slice-${i}`} fill={PALETA[i % PALETA.length]} />
            ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="w-full" style={{ height: 300 }} />
      )}
    </div>
  );
}