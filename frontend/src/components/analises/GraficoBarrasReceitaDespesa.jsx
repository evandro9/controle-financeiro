import React, { useEffect, useState, useContext, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';

function GraficoBarrasReceitaDespesa({ ano, mesInicio, mesFim }) {
  const { darkMode } = useContext(ThemeContext);
  const [dados, setDados] = useState([]);
  const [modo, setModo] = useState('mensal'); // 'mensal' | 'anual'
  const [loading, setLoading] = useState(false);
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

  useEffect(() => {
    const raw = (localStorage.getItem('token') || '').trim();
    const auth = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
    const ctrl = new AbortController();
    setLoading(true); setDados([]);
    fetch(`${apiBase}/lancamentos/resumo-mensal?ano=${ano}`, {
      headers: { Authorization: auth }, signal: ctrl.signal
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setDados)
      .catch(() => setDados([]))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [ano, apiBase]);

  // formato moeda abreviada
  const abreviarBRL = (n) => {
    const num = Number(n || 0);
    if (num === 0) return 'R$ 0';
    const abs = Math.abs(num);
    let val = abs, suf = '';
    if (abs >= 1e9) { val = abs / 1e9; suf = 'B'; }
    else if (abs >= 1e6) { val = abs / 1e6; suf = 'M'; }
    else if (abs >= 1e3) { val = abs / 1e3; suf = 'K'; }
    const dec = val < 10 ? 1 : 0;
    const v = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
    return `R$ ${v}${suf}`;
  };

  // nome mês
  const nomeMes = (mes) => {
    const m = new Date(0, Number(mes) - 1).toLocaleString('pt-BR', { month: 'short' });
    return m.charAt(0).toUpperCase() + m.slice(1);
  };

  // dados finais
  const dadosPlot = useMemo(() => {
    if (modo === 'anual') {
      const receita = dados.reduce((s, d) => s + Number(d.receita || 0), 0);
      const despesa = dados.reduce((s, d) => s + Number(d.despesa || 0), 0);
      return [{ periodo: String(ano), receita, despesa }];
    }
    // Mensal: filtrar pelo intervalo [mesInicio..mesFim]
    return dados
      .filter(d => d.mes >= mesInicio && d.mes <= mesFim)
      .map(d => ({
        periodo: nomeMes(d.mes),
        receita: Number(d.receita || 0),
        despesa: Number(d.despesa || 0),
      }));
  }, [dados, modo, ano, mesInicio, mesFim]);

  // --- Largura adaptativa das barras (cap mínimo de 5 "meses") ---
const { barSize, maxBarSize, barCategoryGap, barGap } = useMemo(() => {
  // Quantidade de "grupos" (um grupo = 1 mês com 2 barras: receita e despesa)
  const groups = modo === 'anual' ? 1 : dadosPlot.length;

  // Forçamos um "mínimo visual" de 5 grupos para o dimensionamento,
  // garantindo que menos que 5 não deixe as barras gigantes.
  const g = Math.max(5, groups);

  // Regras simples por faixa (ajuste fino se quiser)
  if (g <= 5)  return { barSize: 28, maxBarSize: 28, barCategoryGap: '22%', barGap: 6 };
  if (g <= 8)  return { barSize: 24, maxBarSize: 24, barCategoryGap: '18%', barGap: 6 };
  if (g <= 12) return { barSize: 20, maxBarSize: 20, barCategoryGap: '14%', barGap: 6 };
  if (g <= 16) return { barSize: 16, maxBarSize: 16, barCategoryGap: '10%', barGap: 6 };
  return { barSize: 14, maxBarSize: 14, barCategoryGap: '8%', barGap: 6 };
}, [modo, dadosPlot.length]);

const corReceita = darkMode ? '#58a6ff' : '#0072B2';
const corDespesa = darkMode ? '#f78166' : '#D55E00';

// Ordem fixa: Receitas -> Despesas
const legendPayload = React.useMemo(() => ([
  { value: 'Receitas', type: 'rect', color: corReceita, id: 'receita' },
  { value: 'Despesas', type: 'rect', color: corDespesa, id: 'despesa' },
]), [corReceita, corDespesa]);

  return (
    <div className="bg-white dark:bg-darkCard p-4 rounded shadow relative">
      {/* Header */}
      <div className="grid grid-cols-3 items-center mb-2">
        {/* Toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-darkBorder">
            <button
              onClick={() => setModo('mensal')}
              className={`px-3 py-1 text-sm transition-colors ${
                modo === 'mensal'
                  ? 'bg-blue-600 text-white dark:darktext'
                  : 'bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setModo('anual')}
              className={`px-3 py-1 text-sm transition-colors ${
                modo === 'anual'
                  ? 'bg-blue-600 text-white dark:text-white'
                  : 'bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]'
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        {/* Título */}
        <h3 className="text-lg font-semibold text-gray-800 dark:text-darkText text-center">
          Receitas x Despesas
        </h3>

        {/* Info */}
        <div className="justify-self-end">
          <InfoTip title="Como interpretar este gráfico" ariaLabel="Informações do gráfico">
            {modo === 'mensal' ? (
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li>Mostra <b>Receitas</b> e <b>Despesas</b> lado a lado, mês a mês.</li>
                <li>Os meses seguem o período selecionado nos filtros da análise.</li>
                <li>Passe o mouse sobre as barras para ver valores exatos.</li>
              </ul>
            ) : (
              <ul className="list-disc pl-4 space-y-1 text-sm">
                <li>Mostra o <b>acumulado anual</b> de Receitas e Despesas.</li>
                <li>Útil para comparar totais do ano até o momento.</li>
                <li>Passe o mouse sobre as barras para ver valores exatos.</li>
              </ul>
            )}
          </InfoTip>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-darkMuted italic">Carregando…</p>
      ) : dadosPlot.length === 0 ? (
        <p className="text-gray-500 dark:text-darkMuted italic">Sem dados para o período selecionado.</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
<BarChart
  data={dadosPlot}
  margin={{ top: 8, right: 16, left: 8, bottom: 28 }}
  barCategoryGap={barCategoryGap}
  barGap={barGap}
>
            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#30363d' : '#e5e7eb'} />
            <XAxis
              dataKey="periodo"
              tick={{ fill: darkMode ? '#cbd5e1' : '#374151', fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: darkMode ? '#cbd5e1' : '#374151', fontSize: 12 }}
              tickFormatter={abreviarBRL}
            />
            <Tooltip
              cursor={{ fill: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div
                    className="p-2 rounded shadow text-sm"
                    style={{
                      background: darkMode ? '#0b1220' : '#ffffff',
                      border: darkMode ? '1px solid #30363d' : '1px solid #e5e7eb',
                      color: darkMode ? '#cbd5e1' : '#1f2937'
                    }}
                  >
                    <p className="font-medium mb-1">{label}</p>
                    {payload.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span>{p.name}:</span>
                        <span className="font-semibold">
                          {`R$ ${Number(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
<Legend
  verticalAlign="bottom"
  align="center"
  content={() => (
    <div className="flex justify-center gap-6 pt-2 text-sm">
      <span className="flex items-center gap-2">
        <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: corReceita, display: 'inline-block' }} />
        <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Receitas</span>
      </span>
      <span className="flex items-center gap-2">
        <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: corDespesa, display: 'inline-block' }} />
        <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>Despesas</span>
      </span>
    </div>
  )}
/>

<Bar
  dataKey="receita"
  name="Receitas"
  fill={darkMode ? '#58a6ff' : '#0072B2'}
  radius={[6,6,0,0]}
  barSize={barSize}
  maxBarSize={maxBarSize}
/>
<Bar
  dataKey="despesa"
  name="Despesas"
  fill={darkMode ? '#f78166' : '#D55E00'}
  radius={[6,6,0,0]}
  barSize={barSize}
  maxBarSize={maxBarSize}
/>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default GraficoBarrasReceitaDespesa;