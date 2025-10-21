import React, { useContext, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine} from 'recharts';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

 // Formata percentual com sinal e 2 casas
 const fmtPct = (v) => {
   if (v === null || v === undefined) return '—';
   const n = Number(v);
   if (Number.isNaN(n)) return '—';
   const s = n >= 0 ? '+' : '';
   return `${s}${n.toFixed(2)}%`;
 };

 // Tooltip no padrão do gráfico de rentabilidade (dark/light)
 const CustomTooltip = ({ active, payload, label, darkMode, hoveredKey, hiddenLines = {} }) => {
   if (!active || !payload || payload.length === 0) return null;
   return (
     <div
       className={`rounded-xl px-3 py-2 shadow-md border text-sm ${
         darkMode
           ? 'bg-[#0d1117] border-[#30363d] text-[#c9d1d9]'
           : 'bg-white border-[#e5e7eb] text-[#111827]'
       }`}
     >
       <div className="font-medium mb-1">{label}</div>
       {payload.map((p, idx) => (
         <div key={idx} className="flex items-center gap-2">
           <span
             className="inline-block w-2 h-2 rounded-full"
 style={{
   background: p.color,
   opacity:
     (hiddenLines?.[p.dataKey] ? 0.25 : 1) *
     ((typeof hoveredKey === 'string' && hoveredKey !== p.dataKey) ? 0.5 : 1)
 }}
           />
           <span className="opacity-80">{p.name}:</span>
           <span className="font-semibold">{fmtPct(p.value)}</span>
         </div>
       ))}
     </div>
   );
 };

 // Paleta fixa para as séries
 const COLOR = {
   Carteira: '#38bdf8',
   Ibovespa: '#fb923c',
   CDI: '#a78bfa',
};

const GraficoRentabilidadeMensal = ({ ano, filtroExtra, periodo = 'ano' }) => {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hiddenLines, setHiddenLines] = useState({});
  const { darkMode } = useContext(ThemeContext);
  const [hoveredKey, setHoveredKey] = useState(null);

 const handleLegendClick = (oOrKey) => {
   const key = typeof oOrKey === 'string' ? oOrKey : (oOrKey?.dataKey || oOrKey?.value);
   if (!key) return;
   setHiddenLines(prev => ({ ...prev, [key]: !prev[key] }));
 };

 const handleLegendHover = (oOrKey) => {
   const key = typeof oOrKey === 'string' ? oOrKey : (oOrKey?.dataKey || oOrKey?.value);
   setHoveredKey(key || null);
 };

 const handleLegendLeave = () => setHoveredKey(null);

  // Legenda centralizada com opacidade ao ocultar
  const renderLegend = ({ payload }) => {
    return (
      <ul style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        listStyle: 'none',
        padding: 0,
        marginTop: 8,
        cursor: 'pointer'
      }}>
        {payload.map((entry, index) => (
          <li
            key={`item-${index}`}
            onClick={() => handleLegendClick(entry)}
            style={{
              color: entry.color,
              opacity: hiddenLines[entry.dataKey] ? 0.4 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {entry.value}
          </li>
        ))}
      </ul>
    );
  };

  useEffect(() => {
    const buscar = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');

        const qs = `?periodo=${encodeURIComponent(periodo)}`;
        // Para 12m/24m buscamos também o ano anterior (janela contínua)
        const anosParaBuscar =
          periodo === '12m' || periodo === '24m' ? [ano - 1, ano] : [ano];

        // Busca carteira/bench por ano e junta
        const respostasPorAno = await Promise.all(
          anosParaBuscar.map(async (yy) => {
            const [rent, ibov, cdi] = await Promise.all([
              fetch(`/api/investimentos/rentabilidade-mensal/${yy}${qs}`, {
                headers: { Authorization: `Bearer ${token}` }
              })
                .then(r => (r.ok ? r.json() : { totalGeral: {} }))
                .then(d => (d && typeof d === 'object' && d.totalGeral ? d : { totalGeral: {} })),
              fetch(`/api/benchmarks/ibov/${yy}${qs}`, {
                headers: { Authorization: `Bearer ${token}` }
              })
                .then(r => (r.ok ? r.json() : []))
                .then(d => (Array.isArray(d) ? d : [])),
              fetch(`/api/benchmarks/cdi/${yy}${qs}`, {
                headers: { Authorization: `Bearer ${token}` }
              })
                .then(r => (r.ok ? r.json() : []))
                .then(d => (Array.isArray(d) ? d : [])),
            ]);
            console.log('[GRAF-MENSAL][RAW]', { ano: yy, periodo, rent_totalGeral: rent?.totalGeral, ibov, cdi });
            return { yy, rent, ibov, cdi };
          })
        );

      // res*.rent.totalGeral: { 1..12 | '01'..'12' -> pct }; ibov/cdi: [{ano, mes, valor}]
        const byKey = new Map();
        const keyOf = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
        const labelOf = (y, m) => `${meses[m - 1]}/${String(y).slice(-2)}`;

        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth() + 1; // 1..12

        // Monta espinha por ano buscado, respeitando meses válidos (mês corrente no ano atual, 12 p/anos passados)
        for (const { yy, rent } of respostasPorAno) {
          const totalGeral = rent?.totalGeral ?? {};
          const limiteMeses = yy < anoAtual ? 12 : (yy > anoAtual ? 0 : mesAtual);
          for (let m = 1; m <= limiteMeses; m++) {
            const k = keyOf(yy, m);
            byKey.set(k, {
              mes: labelOf(yy, m),
              Carteira: (totalGeral[m] ?? totalGeral[String(m).padStart(2,'0')] ?? null),
              Ibovespa: null,
              CDI: null
            });
          }
        }

        // Benchmarks só onde já existe mês (não criamos meses vazios)
        for (const { yy, ibov, cdi } of respostasPorAno) {
          (ibov || []).forEach(b => {
            const k = keyOf(b.ano ?? yy, b.mes);
            if (!byKey.has(k)) return;
            const base = byKey.get(k);
            byKey.set(k, { ...base, Ibovespa: b.valor });
          });
          (cdi || []).forEach(b => {
            const k = keyOf(b.ano ?? yy, b.mes);
            if (!byKey.has(k)) return;
            const base = byKey.get(k);
            byKey.set(k, { ...base, CDI: b.valor });
          });
        }

        // Ordena cronologicamente
        let serie = Array.from(byKey.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([, v]) => v);

// 1) Descobre o primeiro mês com qualquer dado (Carteira OU benchmark OU operação real)
const primeiroValido = serie.findIndex(
  (m) => m.Carteira !== null && m.Carteira !== undefined
);

// Se achar um mês válido, cortamos a série ANTES dele
if (primeiroValido > 0) {
  serie = serie.slice(primeiroValido);
}

// LOG final da série enviada ao gráfico
console.log('[GRAF-MENSAL][SERIE]', serie);

        // 2) Aplica janela conforme o período
        const janela =
          periodo === '12m' ? 12 :
          periodo === '24m' ? 24 :
          (periodo === 'ano' ? 12 : Infinity); // 'inicio' = tudo desde o primeiro com dado
        if (Number.isFinite(janela) && serie.length > janela) {
          serie = serie.slice(-janela);
        }

 // marca hidden por série (para a tooltip suavizar o ponto)
 const withHiddenFlags = serie.map(item => ({
   ...item,
   __hidden_Carteira: !!hiddenLines['Carteira'],
   __hidden_Ibovespa: !!hiddenLines['Ibovespa'],
   __hidden_CDI: !!hiddenLines['CDI'],
 }));
 setDados(withHiddenFlags);
      } catch (err) {
        console.error('Erro ao buscar dados para gráfico mensal', err);
      } finally {
        setLoading(false);
      }
    };

    buscar();
  }, [ano, periodo]);

   // Legend custom para suportar hover + click
 const CustomLegend = ({ payload }) => {
   if (!payload) return null;
   return (
<div className="w-full flex flex-wrap items-center justify-center gap-4 pt-2">
       {payload.map((entry) => {
         const key = entry.value; // Recharts passa em 'value'
         const color = entry.color;
         const isHidden = !!hiddenLines[key];
         const isDimmedByHover = hoveredKey && hoveredKey !== key && !isHidden;

         return (
           <button
             key={key}
             type="button"
             className="flex items-center gap-2 select-none"
             onMouseEnter={() => handleLegendHover(key)}
             onMouseLeave={handleLegendLeave}
             onClick={() => handleLegendClick(key)}
             title={isHidden ? `${key} (oculta — clique para mostrar)` : `${key} (clique para ocultar)`}
             style={{
               opacity: isHidden ? 0.35 : (isDimmedByHover ? 0.25 : 1),
               cursor: 'pointer'
             }}
           >
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{
                background: entry.color,
                opacity: (hiddenLines[entry.dataKey] ? 0.25 : 1) * (hoveredKey && hoveredKey !== key ? 0.5 : 1)
              }}
           />
            <span className={darkMode ? 'text-[#c9d1d9]' : 'text-[#374151]'}>{key}</span>
           </button>
         );
       })}
     </div>
   );
 };

  const hasData = Array.isArray(dados) && dados.some(p =>
    ['Carteira','Ibovespa','CDI'].some(k => p?.[k] != null && !Number.isNaN(Number(p[k])))
  );

  return (
    <div className="bg-white dark:bg-darkCard rounded shadow p-4"> 
      {/* Header com título e filtros na mesma linha */}
<div className="relative mb-4 grid grid-cols-3 items-center">
  {/* ESQUERDA: filtroExtra (quando existir) */}
  <div className="justify-self-start">
    {filtroExtra}
  </div>

  {/* CENTRO: Título */}
  <div className="text-center">
    <h3 className="font-semibold text-gray-800 dark:text-darkText">
      Rentabilidade Mensal Geral
    </h3>
  </div>

  {/* DIREITA: InfoTip */}
  <div className="justify-self-end">
    <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
      <ul className="list-disc pl-4 space-y-1">
        <li>Mostra a <b>rentabilidade mês a mês</b> da carteira.</li>
        <li>Linhas de comparação com <b>Ibovespa</b> e <b>CDI</b>.</li>
        <li>Eixo Y em <b>%</b> (retorno mensal); linha de referência em <b>0%</b>.</li>
        <li>Clique nos itens da legenda para ocultar/mostrar séries.</li>
      </ul>
    </InfoTip>
  </div>
</div>


      <div className="relative">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dados} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={darkMode ? '#30363d' : '#e5e7eb'} strokeDasharray="3 3" />
 <XAxis
   dataKey="mes"
   tick={{ fill: darkMode ? '#c9d1d9' : '#374151' }}
   axisLine={{ stroke: darkMode ? '#30363d' : '#e5e7eb' }}
   tickLine={{ stroke: darkMode ? '#30363d' : '#e5e7eb' }}
 />
 <YAxis
   tick={{ fill: darkMode ? '#c9d1d9' : '#374151' }}
   axisLine={{ stroke: darkMode ? '#30363d' : '#e5e7eb' }}
   tickLine={{ stroke: darkMode ? '#30363d' : '#e5e7eb' }}
   domain={['auto', 'auto']}
   tickFormatter={(v) => `${Number(v).toFixed(2)}%`}
 />
                <ReferenceLine
                  y={0}
                  stroke={darkMode ? "#d1d5db" : "#6b7280"}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
 <Tooltip
   content={<CustomTooltip darkMode={darkMode} hoveredKey={hoveredKey} hiddenLines={hiddenLines} />}
   isAnimationActive={false}
 />
<Legend content={<CustomLegend />} />
 <Line
   type="monotone"
   dataKey="Carteira"
   stroke={COLOR ? COLOR.Carteira : '#38bdf8'}
   strokeWidth={2}
   name="Carteira"
   strokeOpacity={
     hiddenLines['Carteira'] ? 0.12 : (hoveredKey && hoveredKey !== 'Carteira' ? 0.18 : 1)
   }
   dot={{
     r: 2,
     stroke: (COLOR ? COLOR.Carteira : '#38bdf8'),
     strokeOpacity: hiddenLines['Carteira'] ? 0.12 : (hoveredKey && hoveredKey !== 'Carteira' ? 0.18 : 1)
   }}
   activeDot={{ r: 4 }}
 />
 <Line
   type="monotone"
   dataKey="Ibovespa"
   stroke={COLOR ? COLOR.Ibovespa : '#fb923c'}
   strokeWidth={2}
   name="Ibovespa"
   strokeOpacity={
     hiddenLines['Ibovespa'] ? 0.12 : (hoveredKey && hoveredKey !== 'Ibovespa' ? 0.18 : 1)
   }
   dot={{
     r: 2,
     stroke: (COLOR ? COLOR.Ibovespa : '#fb923c'),
     strokeOpacity: hiddenLines['Ibovespa'] ? 0.12 : (hoveredKey && hoveredKey !== 'Ibovespa' ? 0.18 : 1)
   }}
   activeDot={{ r: 4 }}
 />
 <Line
   type="monotone"
   dataKey="CDI"
   stroke={COLOR ? COLOR.CDI : '#a78bfa'}
   strokeWidth={2}
   name="CDI"
   strokeOpacity={
     hiddenLines['CDI'] ? 0.12 : (hoveredKey && hoveredKey !== 'CDI' ? 0.18 : 1)
   }
   dot={{
     r: 2,
     stroke: (COLOR ? COLOR.CDI : '#a78bfa'),
     strokeOpacity: hiddenLines['CDI'] ? 0.12 : (hoveredKey && hoveredKey !== 'CDI' ? 0.18 : 1)
   }}
   activeDot={{ r: 4 }}
 />
          </LineChart>
        </ResponsiveContainer>

        {/* LOADING overlay (azul) */}
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/30">
            <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                 style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }} />
            <div className="mt-3 text-xs font-medium text-gray-600 dark:text-[#c9d1d9]">
              Carregando dados…
            </div>
          </div>
        )}

        {/* EMPTY overlay (não estica o card) */}
        {!loading && !hasData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-[#9CA3AF] border border-gray-200 dark:border-[#30363d]">
              Sem dados para este período.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraficoRentabilidadeMensal;