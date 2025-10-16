import React, { useMemo, useContext } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import InfoTip from '../ui/InfoTip';
import ChartTooltip from '../ui/ChartTooltip';
import { ThemeContext } from '../../context/ThemeContext';

// Formata valores com abreviação k, M, B e símbolo de R$
const fmtBRLAbrev = (n) => {
  const v = Number(n || 0);
  const format = (num, divisor, sufixo) => {
    const val = num / divisor;
    return `R$ ${Number.isInteger(val) ? val : val.toFixed(1)}${sufixo}`;
  };

  if (Math.abs(v) >= 1_000_000_000) return format(v, 1_000_000_000, 'b');
  if (Math.abs(v) >= 1_000_000) return format(v, 1_000_000, 'm');
  if (Math.abs(v) >= 1_000) return format(v, 1_000, 'k');
  return `R$ ${v}`;
};

// Formata valor completo para tooltip
const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtUSDAbrev = (n) => {
  const v = Number(n || 0);
  const format = (num, divisor, sufixo) => {
    const val = num / divisor;
    return `$ ${Number.isInteger(val) ? val : val.toFixed(1)}${sufixo}`;
  };
  if (Math.abs(v) >= 1_000_000_000) return format(v, 1_000_000_000, 'b');
  if (Math.abs(v) >= 1_000_000) return format(v, 1_000_000, 'm');
  if (Math.abs(v) >= 1_000) return format(v, 1_000, 'k');
  return `$ ${v}`;
};
const fmtUSD = (n) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function GraficoEvolucaoConta({ data = [], compact = false, moeda = 'BRL', actionsLeft = null }) {
  const { darkMode } = useContext(ThemeContext);
  const abreviador = moeda === 'USD' ? fmtUSDAbrev : fmtBRLAbrev;
  const fmtFull    = moeda === 'USD' ? fmtUSD     : fmtBRL;

  // Remove "rabos" finais sem valor (ex.: dezembro = 0)
  const dataFiltrada = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    let lastIdx = -1;
    for (let i = data.length - 1; i >= 0; i--) {
      const v = Number(data[i]?.saldo);
      if (Number.isFinite(v) && v > 0) { // considera último mês realmente lançado (> 0)
        lastIdx = i;
        break;
      }
    }
    // se não achou > 0, tenta pelo menos algum número válido (>= 0)
    if (lastIdx === -1) {
      for (let i = data.length - 1; i >= 0; i--) {
        const v = Number(data[i]?.saldo);
        if (Number.isFinite(v)) {
          lastIdx = i;
          break;
        }
      }
    }
    return lastIdx >= 0 ? data.slice(0, lastIdx + 1) : [];
  }, [data]);

  return (
  <div className="bg-white dark:bg-darkCard p-6 rounded-xl shadow border border-gray-100 dark:border-darkBorder">
    {/* Header: título central + i padronizado */}
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
        {/* AÇÕES À ESQUERDA (toggle moeda) */}
        <div className="absolute left-0">{actionsLeft}</div>
        {/* TÍTULO CENTRAL */}
        <h3 className="text-lg font-semibold text-gray-800 dark:text-darkText text-center">
          Evolução do Patrimônio em {moeda === 'USD' ? 'Dólar - $' : 'Reais - R$'}
        </h3>
        {/* INFOTIP À DIREITA */}
        <div className="absolute right-0">
        <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
          <ul className="list-disc pl-4 space-y-1">
            <li>Linha mostra o saldo total mês a mês do ano selecionado.</li>
            <li>Acompanhe a evolução do seu patrimônio de forma fácil e intuitiva.</li>
          </ul>
        </InfoTip>
      </div>
    </div>

    {/* Gráfico */}
    <ResponsiveContainer width="100%" height={compact ? 220 : 300}>
      <AreaChart
        data={dataFiltrada}
        margin={compact ? { top: 8, right: 8, left: 8, bottom: 4 } : { top: 12, right: 12, left: 12, bottom: 8 }}
      >
        <CartesianGrid stroke={darkMode ? '#21262d' : '#e5e7eb'} strokeDasharray="3 3" />
        <XAxis
          dataKey="mesLabel"
          tick={{ fill: darkMode ? '#9ca3af' : '#374151', fontSize: compact ? 11 : 12 }}
          minTickGap={compact ? 12 : 8}
        />
        <YAxis
          tick={{ fill: darkMode ? '#9ca3af' : '#374151', fontSize: compact ? 11 : 12 }}
          tickFormatter={abreviador}
          width={compact ? 54 : 70}
        />
        <Tooltip
          content={
            <ChartTooltip
              darkMode={darkMode}
              valueFormatter={fmtFull}
            />
          }
          cursor={{ stroke: darkMode ? '#374151' : '#e5e7eb', strokeDasharray: '3 3' }}
        />
        <Area
          type="monotone"
          dataKey="saldo"
          stroke="#8B5CF6" strokeWidth={2}
          fill="#8B5CF6"
          fillOpacity={0.2}
          name="Patrimônio"
          // 🔵 Pontos (mais discretos no mobile)
          dot={{ r: compact ? 2 : 3 }}
          activeDot={{ r: compact ? 4 : 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);
}