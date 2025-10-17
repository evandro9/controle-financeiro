import React, { useEffect, useState, useContext } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';

function GraficoBarrasSubcategorias({ ano, mesInicio, mesFim, categoria }) {
  const [dados, setDados] = useState([]);
  const { darkMode } = useContext(ThemeContext);
  const [loading, setLoading] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL ?? "/api";

  useEffect(() => {
    const raw = (localStorage.getItem('token') || '').trim();
    const auth = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
    const url = new URL(`${apiBase}/analises/despesas-por-subcategoria`, window.location.origin);
    const ctrl = new AbortController();
    setLoading(true); setDados([]);
    url.searchParams.append('ano', ano);
    url.searchParams.append('mesInicio', mesInicio);
    url.searchParams.append('mesFim', mesFim);
    if (categoria) url.searchParams.append('categoria', categoria);

  fetch(url.toString(), { headers: { Authorization: auth }, signal: ctrl.signal })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setDados(Array.isArray(data) ? data : []))
      .catch(() => setDados([]))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [ano, mesInicio, mesFim, categoria, apiBase]);
  const nomeMes = (mes) => new Date(0, mes - 1).toLocaleString('pt-BR', { month: 'short' });
  // Trunca rótulos do eixo Y: primeira palavra até 10 caracteres (ou a própria palavra, se for única)
  const MAX_Y_CHARS = 10;
  const truncateYLabel = (s = '') => {
    const full = String(s).trim();
    const parts = full.split(/\s+/);
    const multi = parts.length > 1;
    const first = parts[0] || '';
    // base é a primeira palavra (ou a única, se só tiver uma)
    const trimmed = first.length <= MAX_Y_CHARS ? first : first.slice(0, MAX_Y_CHARS);
    // regra: se tiver mais de uma palavra, SEMPRE adiciona "..."
    // se for palavra única, só adiciona "..." quando cortarmos por tamanho
    const needsDots = multi || first.length > MAX_Y_CHARS;
    return needsDots ? `${trimmed}...` : trimmed;
  };
  
  // --- formatação BRL abreviada para eixo X e tooltip ---
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const abreviarBRL = (n) => {
    const num = Number(n || 0);
    if (num === 0) return 'R$ 0';
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    let val = abs, suf = '';
    if (abs >= 1e9) { val = abs / 1e9; suf = 'B'; }
    else if (abs >= 1e6) { val = abs / 1e6; suf = 'M'; }
    else if (abs >= 1e3) { val = abs / 1e3; suf = 'K'; }
    const dec = val < 10 ? 1 : 0;
    const v = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val);
    return `R$ ${v}${suf}`;
  };

  // mede o COMPRIMENTO do rótulo já truncado e reserva a largura com um pequeno buffer
  const maxLabelLen = dados?.length ? Math.max(...dados.map(d => truncateYLabel(d.subcategoria || '').length)) : 0;
  const yAxisWidth = Math.min(180, Math.max(96, Math.round(maxLabelLen * 7.5) + 10));

  return (
    <div className="bg-white dark:bg-darkCard p-4 rounded shadow relative">
      {/* Ícone de informação no canto superior direito */}
      <div className="absolute top-0 right-3">
        <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
          <ul className="list-disc pl-4 space-y-1">
              <li>Lista as <b>subcategorias</b> no eixo vertical.</li>
              <li>O tamanho da barra mostra o <b>total gasto</b> no período filtrado.</li>
              <li>Passe o mouse sobre uma barra para ver o valor exato em R$.</li>
              <li>Use os filtros no topo da tela para alterar o intervalo e a categoria.</li>
          </ul>
        </InfoTip>
      </div>

      <h3 className="text-lg font-semibold mb-1 text-gray-800 dark:text-darkText text-center">
        Gastos por subcategoria
      </h3>
      {loading ? (
        <p className="text-gray-500 dark:text-darkMuted italic">Carregando…</p>
      ) : dados.length === 0 ? (
        <p className="text-gray-500 dark:text-darkMuted italic">Sem dados para o período selecionado.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dados} layout="vertical" margin={{ top: 10, right: 16, left: 12, bottom: 10 }}>
            <CartesianGrid stroke={darkMode ? '#30363d' : '#e5e7eb'} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tick={{ fill: darkMode ? '#c9d1d9' : '#374151' }}
              tickFormatter={abreviarBRL}
              domain={[0, 'dataMax']}
              padding={{ left: 0, right: 12 }}
              allowDecimals={false}
            />
            <YAxis
              dataKey="subcategoria"
              type="category"
              width={yAxisWidth}
              tick={(props) => {
                const { x, y, payload } = props;
                const full = payload?.value ?? '';
                const label = truncateYLabel(full);
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text
                      x={0}
                      y={0}
                      dy={4}
                      textAnchor="end"
                      fill={darkMode ? '#c9d1d9' : '#374151'}
                    >
                      <title>{full}</title>
                      {label}
                    </text>
                  </g>
                );
              }}
            />
<Tooltip
  cursor={{ fill: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.06)' }}
  content={({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    // Descobre o índice da barra pela subcategoria (label) e replica a paleta do <Cell>
    const idx = dados.findIndex(d => (d.subcategoria ?? '') === label);
    const barColor = idx >= 0 ? `hsl(${(idx * 43) % 360}, 70%, 55%)` : '#6366f1';
    return (
      <div
        className="p-2 rounded shadow"
        style={{
          backgroundColor: darkMode ? '#161b22' : '#fff',
          border: `1px solid ${darkMode ? '#30363d' : '#e5e7eb'}`,
          color: darkMode ? '#c9d1d9' : '#374151' ,
          pointerEvents: 'none'
        }}
      >
        <p className="text-sm font-medium mb-1">{label}</p>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '2px',
                backgroundColor: barColor
              }}
            />
            <span>Total:</span>
            <span className="font-semibold">{fmtBRL.format(entry.value || 0)}</span>
          </div>
        ))}
      </div>
    );
  }}
/>
            <Bar dataKey="total" fill="#6366f1">
              {dados.map((_, index) => (
                <Cell key={index} fill={`hsl(${(index * 43) % 360}, 70%, 55%)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default GraficoBarrasSubcategorias;