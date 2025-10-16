import React, { useContext, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, Legend, ResponsiveContainer, Rectangle } from 'recharts';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';
import ChartTooltip from '../ui/ChartTooltip';

// util
const fmtBRL = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function GraficoPlanosMensal({ ano = new Date().getFullYear() }) {
  const { darkMode } = useContext(ThemeContext);
  const [status, setStatus] = useState('idle'); // idle|loading|success|error
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const apiBase = import.meta.env.VITE_API_URL ?? "/api";

  useEffect(() => {
    const handler = () => setRefreshNonce(n => n + 1);
    window.addEventListener('planos:movimento:changed', handler);
    return () => window.removeEventListener('planos:movimento:changed', handler);
  }, []);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      setStatus('loading'); setError(null);
      try {
        const token = localStorage.getItem('token');
        const [resLanc, resPlan] = await Promise.all([
          fetch(`${apiBase}/lancamentos/resumo-mensal?ano=${ano}`, {
            headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal
          }),
          fetch(`${apiBase}/planos-dashboard/mensal?ano=${ano}`, {
            headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal
          })
        ]);
        if (!resLanc.ok) throw new Error(`Erro ${resLanc.status} em /lancamentos/resumo-mensal`);
        if (!resPlan.ok) throw new Error(`Erro ${resPlan.status} em /planos-dashboard/mensal`);
        const resumo = await resLanc.json();
        const planos = await resPlan.json();

        if (!alive) return;

        const idxResumo = Object.fromEntries((resumo || []).map(r => [String(r.mes).padStart(2,'0'), r]));
        const idxPlanos = Object.fromEntries((planos || []).map(p => [String(p.mes).padStart(2,'0'), p]));

        const merged = Array.from({length:12}, (_,i) => {
          const key = String(i+1).padStart(2,'0');
          const r = idxResumo[key] || { receita: 0, despesa: 0 };
          const p = idxPlanos[key] || { aporte: 0, retirada: 0 };

          // Valores “brutos” vindos do resumo (já incluem Planos)
          const receitaRaw   = Number(r.receita   || 0);
          const despesasRaw  = Number(r.despesa   || 0);
          const aportes      = Number(p.aporte    || 0);
          const retiradas    = Number(p.retirada  || 0);

          // Remove Planos de Receita/Despesa para não duplicar no empilhamento
          const receita      = Math.max(receitaRaw  - retiradas, 0);
          const despesas     = Math.max(despesasRaw - aportes,   0);
          const planosVal    = aportes - retiradas; // barra azul (líquido dos planos)

          // Saldo correto: com resumo que JÁ inclui Planos, saldo = receitaRaw - despesasRaw
          const saldo        = receitaRaw - despesasRaw;

          return {
            mes: MESES[i],
            receita,
            despesas,
            planos: planosVal,
            saldo
          };
        });

        setRows(merged);
        setStatus('success');
      } catch (e) {
        if (!alive || e.name === 'AbortError') return;
        setError(e); setStatus('error');
      }
    })();

    return () => { alive = false; ctrl.abort(); };
  }, [ano, refreshNonce]);

  const eixoCor = darkMode ? '#c9d1d9' : '#374151';
  // Paleta (dark menos "neon" + menos vibração no vermelho)
  const COLOR_RECEITA = darkMode ? 'rgba(59,130,246,0.80)' : '#2563EB';   // blue-500 @ 80% / blue-600
  const COLOR_DESPESA = darkMode ? 'rgba(251,146,60,0.82)' : '#EF4444';
  const STROKE_DESPESA_DARK = 'rgba(245,158,11,0.55)'; // amber-500 @ 55%
  const COLOR_PLANOS  = darkMode ? 'rgba(14,165,233,0.75)'  : '#06B6D4';  // sky-500 @ 75% / cyan-500
  const COLOR_SALDO   = darkMode ? 'rgba(34,197,94,0.78)'   : '#22C55E';  // green-500 @ 78% / green-500

  // Adapter p/ usar ChartTooltip e exibir o SALDO real (pode ser negativo)
  const TooltipAdapter = (props) => {
    const { active, label, payload = [] } = props || {};
    const adjusted = payload.map((item) => {
      const name = String(item?.name ?? item?.dataKey ?? '');
      if (name.toLowerCase() === 'saldo') {
        const raw = Number(item?.payload?.saldo ?? 0);
        return { ...item, value: raw };
      }
      return item;
    });
    return (
      <ChartTooltip
        active={active}
        label={label}
        payload={adjusted}
        darkMode={darkMode}
        valueFormatter={(v) => fmtBRL(v)}
        labelFormatter={(lab) => {
          const idx = MESES.indexOf(String(lab));
          return idx >= 0 ? MESES_FULL[idx] : String(lab);
        }}
      />
    );
  };

  if (status === 'loading') {
    return <p className="text-sm text-gray-500 dark:text-darkMuted">Carregando dados...</p>;
  }
  if (status === 'error') {
    return <p className="text-sm text-red-600">Erro ao carregar o gráfico: {error?.message}</p>;
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header padrão com título central + Info */}
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-darkText text-center">
          Resumo Mensal — Receitas, Despesas, Planos e Saldo
        </h3>
        <div className="absolute right-3">
          <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
            <ul className="list-disc pl-4 space-y-1">
              <li><b>Barras empilhadas por mês</b> com os valores do período.</li>
              <li><b>Receitas</b> e <b>Despesas</b>: valores brutos do mês.</li>
              <li><b>Planos</b>: aportes − retiradas (movimento dos planos no mês).</li>
              <li><b>Saldo</b>: Receitas − Despesas.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            width={900}
            height={200}
            data={rows}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            barCategoryGap="30%"
          >
            <XAxis dataKey="mes" stroke={eixoCor} tick={{ fill: eixoCor, fontSize: 12 }} />
            <Tooltip content={<TooltipAdapter />} cursor={{ fill: darkMode ? '#334155' : '#e5e7eb', opacity: 0.3 }} />
            <Legend
              wrapperStyle={{ color: darkMode ? '#f3f4f6' : '#1f2937', fontSize: '14px' }}
            />

            {/* barras empilhadas com nova paleta */}
            <Bar
              dataKey="receita"
              stackId="a"
              fill={COLOR_RECEITA}
              name="Receitas"
              radius={0}
            />
            {/* Despesas: arredonda topo quando não há planos nem saldo positivos no mês */}
            <Bar
              dataKey="despesas"
              stackId="a"
              fill={COLOR_DESPESA}
              stroke={darkMode ? STROKE_DESPESA_DARK : undefined}
              strokeWidth={darkMode ? 0.6 : undefined}
              name="Despesas"
              shape={(props) => {
                const { payload, ...rest } = props;
                const temPlanos = Number(payload?.planos || 0) !== 0;
                const saldoPos  = Number(payload?.saldo || 0) > 0;
                const radius    = (!temPlanos && !saldoPos) ? [8,8,0,0] : [0,0,0,0];
                return <Rectangle {...rest} radius={radius} style={{ shapeRendering: 'geometricPrecision' }} />;
              }}
            />
            {/* Planos ganha topo arredondado quando o saldo do mês não é positivo */}
            <Bar
              dataKey="planos"
              stackId="a"
              fill={COLOR_PLANOS}
              name="Planos (líquido)"
              shape={(props) => {
                const { payload, ...rest } = props;
                const saldoMes = Number(payload?.saldo || 0);
                const radius = (saldoMes > 0) ? [0,0,0,0] : [8,8,0,0];
                return <Rectangle {...rest} radius={radius} />;
              }}
            />
            {/* Saldo só aparece se for positivo; quando <= 0 não desenhamos a barra */}
            <Bar
              dataKey={(d) => Math.max(Number(d.saldo || 0), 0)}
              stackId="a"
              fill={COLOR_SALDO}
              name="Saldo"
              shape={(props) => {
                const { value, ...rest } = props;
                if (!value || value <= 0) return null; // esconde barra p/ saldo <= 0
                return <Rectangle {...rest} radius={[8,8,0,0]} />;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}