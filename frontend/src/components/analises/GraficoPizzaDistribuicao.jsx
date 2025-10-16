import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';

function GraficoPizzaDistribuicao({ ano, mesInicio, mesFim, categoria }) {
  const [dados, setDados] = useState([]);
  const [tipo, setTipo] = useState('pizza'); // 'pizza' | 'barras'
  const { darkMode } = useContext(ThemeContext);
  const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

  useEffect(() => {
    const raw = (localStorage.getItem('token') || '').trim();
    const auth = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
    const url = new URL(`${apiBase}/analises/distribuicao-total`, window.location.origin);
    url.searchParams.append('ano', ano);
    url.searchParams.append('mesInicio', mesInicio);
    url.searchParams.append('mesFim', mesFim);
    if (categoria) url.searchParams.append('categoria', categoria);

    fetch(url.toString(), { headers: { Authorization: auth } })
      .then(res => res.json())
      .then(data => setDados(data || []));
  }, [ano, mesInicio, mesFim, categoria, apiBase]);

  // Paletas
  const PALETTE_LIGHT = ['#0072B2','#D55E00','#009E73','#CC79A7','#E69F00','#56B4E9','#F0E442','#8A2BE2','#228B22','#DB3A34'];
  const PALETTE_DARK  = ['#60A5FA','#F59E0B','#34D399','#A78BFA','#F472B6','#22D3EE','#F87171','#84CC16','#FB923C','#C084FC'];

  const colorFor = useCallback((name = '') => {
    const base = darkMode ? PALETTE_DARK : PALETTE_LIGHT;
    let x = 0; const s = String(name);
    for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
    return base[x % base.length];
  }, [darkMode]);

  const fmtBRL = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);
  // Normaliza tipos vindos do PG (numeric como string) e garante categoria
  const dadosNum = useMemo(
    () => (dados || [])
      .map(d => ({ ...d, categoria: d.categoria ?? 'Sem categoria', total: Number(d.total ?? 0) }))
      .filter(d => d.total > 0),
    [dados]
  );
  const totalGeral = useMemo(
    () => dadosNum.reduce((acc, d) => acc + d.total, 0),
    [dadosNum]
  );

  // Abrevia Y (10K, 1,2M...)
  const abbr = useCallback((v) => {
    const n = Number(v) || 0;
    const nf = (x) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(x);
    if (Math.abs(n) >= 1e9) return nf(n / 1e9) + 'B';
    if (Math.abs(n) >= 1e6) return nf(n / 1e6) + 'M';
    if (Math.abs(n) >= 1e3) return nf(n / 1e3) + 'K';
    return nf(n);
  }, []);

  // Trunca X em 10 chars
  const trunc = useCallback((s) => {
    const txt = String(s ?? '');
    return txt.length > 10 ? txt.slice(0, 10) + '…' : txt;
  }, []);

  // Ordenado p/ barras: maior → menor
  const dadosOrdenados = useMemo(() => {
    const arr = [...dadosNum];
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [dadosNum]);

  // --- Sizing adaptativo por quantidade de categorias ---
  const { barSize, maxBarSize, barCategoryGap } = useMemo(() => {
    const n = Math.max(1, dadosOrdenados.length);
    if (n <= 6)  return { barSize: 56, maxBarSize: 72, barCategoryGap: '22%' };
    if (n <= 10) return { barSize: 48, maxBarSize: 64, barCategoryGap: '18%' };
    if (n <= 14) return { barSize: 30, maxBarSize: 56, barCategoryGap: '14%' };
    if (n <= 20) return { barSize: 32, maxBarSize: 48, barCategoryGap: '10%' };
    return { barSize: 20, maxBarSize: 28, barCategoryGap: '6%' };
  }, [dadosOrdenados.length]);

  // Cabeçalho
  const Header = () => (
    <div className="grid grid-cols-3 items-center mb-2">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-darkBorder">
          <button
            onClick={() => setTipo('pizza')}
            className={`px-3 py-1 text-sm transition-colors ${
              tipo === 'pizza'
                ? 'bg-blue-600 text-white dark:text-white'
                : 'bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]'
            }`}
          >
            Pizza
          </button>
          <button
            onClick={() => setTipo('barras')}
            className={`px-3 py-1 text-sm transition-colors ${
              tipo === 'barras'
                ? 'bg-blue-600 text-white dark:text-white'
                : 'bg-white text-gray-700 hover:bg-blue-50 dark:bg-darkBg dark:text-darkText dark:hover:bg-[#1e293b]'
            }`}
          >
            Barras
          </button>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-800 dark:text-darkText text-center">
        Distribuição de despesas por categoria
      </h3>

      <div className="justify-self-end">
<InfoTip title="Como interpretar este gráfico" ariaLabel="Informações do gráfico">
  {tipo === 'pizza' ? (
    <ul className="list-disc pl-4 space-y-1 text-sm">
      <li>Representa a <b>distribuição total das despesas</b> no período filtrado.</li>
      <li>Cada fatia indica a <b>proporção (%)</b> de uma categoria sobre o total.</li>
      <li>Ao passar o mouse, você vê <b>valor absoluto (R$)</b> e <b>percentual</b>.</li>
      <li>Útil quando o objetivo é entender a <b>participação de cada categoria</b> dentro do todo.</li>
    </ul>
  ) : (
    <ul className="list-disc pl-4 space-y-1 text-sm">
      <li>Mostra as <b>despesas por categoria</b> em formato de barras, <b>ordenadas da maior para a menor</b>.</li>
      <li>Em cima de cada barra aparece o <b>% do total</b> que ela representa.</li>
      <li>O eixo Y está abreviado (ex: 10K = R$ 10.000) para facilitar leitura.</li>
      <li>Ao passar o mouse, você vê <b>valor absoluto (R$)</b> e <b>percentual</b>.</li>
      <li>Útil para <b>comparar categorias</b> lado a lado e identificar onde estão os maiores gastos.</li>
    </ul>
  )}
</InfoTip>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-darkCard p-4 rounded shadow relative">
      <Header />

      {dadosNum.length === 0 ? (
        <p className="text-gray-500 dark:text-darkMuted italic">Sem dados para o período selecionado.</p>
      ) : (
        <div className="w-full" style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            {tipo === 'pizza' ? (
              <PieChart>
                <Pie
                  data={dadosNum}
                  dataKey="total"
                  nameKey="categoria"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={({ payload, percent }) =>
                    `${payload?.categoria ?? ''} (${(percent * 100).toFixed(1)}%)`
                  }
                >
                  {dadosNum.map((d, i) => (
                    <Cell key={i} fill={colorFor(d.categoria)} />
                  ))}
                </Pie>
                {/* Hover com fundinho suave */}
                <RTooltip
                  cursor={{ fill: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0]?.payload || {};
                    const categoria = item.categoria || '';
                    const total = Number(item.total || 0);
                    const perc = totalGeral > 0 ? (total / totalGeral) * 100 : 0;
                    const cor = colorFor(categoria);
                    return (
                      <div
                        className="p-2 rounded shadow"
                        style={{
                          background: darkMode ? '#0b1220' : '#ffffff',
                          border: darkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                          color: darkMode ? '#cbd5e1' : '#1f2937'
                        }}
                      >
                        <div className="flex items-center gap-2 font-semibold mb-1">
                          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, backgroundColor: cor }} />
                          {categoria}
                        </div>
                        <div style={{ fontSize: 12 }}><span style={{ opacity: 0.8 }}>Total:</span> {fmtBRL.format(total)}</div>
                        <div style={{ fontSize: 12 }}><span style={{ opacity: 0.8 }}>Percentual:</span> {perc.toFixed(1)}%</div>
                      </div>
                    );
                  }}
                />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            ) : (
              <BarChart
                data={dadosOrdenados}
                margin={{ top: 8, right: 16, left: 8, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={darkMode ? 0.1 : 0.25} />
                <XAxis
                  dataKey="categoria"
                  tick={{ fill: darkMode ? '#cbd5e1' : '#475569', fontSize: 10, lineHeight: 1 }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={42}
                  tickFormatter={trunc}
                />
                <YAxis
                  width={48}
                  tick={{ fill: darkMode ? '#cbd5e1' : '#475569', fontSize: 10 }}
                  tickFormatter={(v) => abbr(v)}
                />
                {/* Hover com fundinho suave e SEM mexer no fill da barra (evita "piscar") */}
                <RTooltip
                  cursor={{ fill: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0]?.payload || {};
                    const categoria = item.categoria || '';
                    const total = Number(item.total || 0);
                    const perc = totalGeral > 0 ? (total / totalGeral) * 100 : 0;
                    const cor = colorFor(categoria);
                    return (
                      <div
                        className="p-2 rounded shadow"
                        style={{
                          background: darkMode ? '#0b1220' : '#ffffff',
                          border: darkMode ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e5e7eb',
                          color: darkMode ? '#cbd5e1' : '#1f2937'
                        }}
                      >
                        <div className="flex items-center gap-2 font-semibold mb-1">
                          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, backgroundColor: cor }} />
                          {categoria}
                        </div>
                        <div style={{ fontSize: 12 }}><span style={{ opacity: 0.8 }}>Total:</span> {fmtBRL.format(total)}</div>
                        <div style={{ fontSize: 12 }}><span style={{ opacity: 0.8 }}>Percentual:</span> {perc.toFixed(1)}%</div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="total"
                  radius={[10, 10, 0, 0]}
                  barSize={barSize}
                  maxBarSize={maxBarSize}
                  barCategoryGap={barCategoryGap}
                >
                  {dadosOrdenados.map((d, i) => (
                    <Cell key={i} fill={colorFor(d.categoria)} />
                  ))}
                  {/* % no topo — sem animação e com cor legível no dark */}
                  <LabelList
                    dataKey="total"
                    position="top"
                    isAnimationActive={false}
                    formatter={(v) => {
                      const perc = totalGeral > 0 ? (Number(v) / totalGeral) * 100 : 0;
                      return `${perc.toFixed(0)}%`;
                    }}
                    style={{ fontSize: 10, fill: darkMode ? '#94a3b8' : '#334155' }} // dark: slate-400; light: slate-700
                  />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default GraficoPizzaDistribuicao;