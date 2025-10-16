import React, { useEffect, useState, useContext, useMemo, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';
import ChartTooltip from '../ui/ChartTooltip';

function GraficoLinhaCategorias({ ano, mesInicio, mesFim, categoria }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  // animação quando dados mudam (montagem / troca de filtro)
  const [animate, setAnimate] = useState(false);
  const [animateLegend, setAnimateLegend] = useState(false);
  const { darkMode } = useContext(ThemeContext);
  // Séries ocultas pelo usuário via legenda
  const [hidden, setHidden] = useState(() => new Set());
  // Tooltip controlada pelo mouse (evita “pular” para o início no clique)
  const [tt, setTt] = useState(null); // { label, payload }
  const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
  // Controle de flicker: só esconder tooltip após pequeno atraso
  const hideTtTimerRef = useRef(null);
  const lastLabelRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    const ctrl = new AbortController();
    const raw = (localStorage.getItem('token') || '').trim();
    const auth = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
    const url = new URL(`${apiBase}/analises/despesas-por-categoria`, window.location.origin);
    url.searchParams.append('ano', ano);
    url.searchParams.append('mesInicio', mesInicio);
    url.searchParams.append('mesFim', mesFim);
    if (categoria) url.searchParams.append('categoria', categoria);

    fetch(url.toString(), { headers: { Authorization: auth }, signal: ctrl.signal })
      .then(res => res.json())
      .then((data) => {
        const grouped = agruparPorMes(Array.isArray(data) ? data : []);
        setDados(grouped);
        // anima 1x quando dados chegam (montagem / troca de filtro)
        setAnimate(true);
        const ANIM_MS = 900; // deixa mais lento/suave
        setTimeout(() => setAnimate(false), ANIM_MS + 50);
      })
      .catch(() => setDados([]))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [ano, mesInicio, mesFim, categoria, apiBase]);

  const agruparPorMes = (linhas) => {
    const categorias = [...new Set(linhas.map(l => l.categoria))];
    const meses = Array.from(
      { length: mesFim - mesInicio + 1 },
      (_, i) => String(mesInicio + i).padStart(2, '0')
    );
    return meses.map(mes => {
      const obj = { mes };
      categorias.forEach(cat => {
        const linha = linhas.find(l => l.mes === mes && l.categoria === cat);
        obj[cat] = linha ? linha.total : 0;
      });
      return obj;
    });
  };

    // Lista de categorias (fixa e estável) para cores/legenda
  const categoriasAll = useMemo(() => {
    if (!dados.length) return [];
    return Object.keys(dados[0]).filter(k => k !== 'mes');
  }, [dados]);

  // Paletas com alto contraste (colorblind-safe) p/ claro e escuro
  const PALETTE_LIGHT = [
    '#0072B2', // blue
    '#D55E00', // vermilion
    '#009E73', // green
    '#CC79A7', // purple
    '#E69F00', // orange
    '#56B4E9', // sky
    '#F0E442', // yellow (funciona bem no light)
    '#8A2BE2', // blueviolet extra
    '#228B22', // forestgreen extra
    '#DB3A34', // red extra
  ];
  const PALETTE_DARK = [
    '#60A5FA', // blue-400
    '#F59E0B', // amber-500
    '#34D399', // emerald-400
    '#A78BFA', // violet-400
    '#F472B6', // pink-400
    '#22D3EE', // cyan-400
    '#F87171', // red-400
    '#84CC16', // lime-500
    '#FB923C', // orange-400
    '#C084FC', // violet-400 (alt)
  ];

  // Cor estável por NOME de categoria (hash) — igual para todos os gráficos
  const colorFor = useCallback((name = '') => {
    const base = darkMode ? PALETTE_DARK : PALETTE_LIGHT;
    let x = 0;
    for (let i = 0; i < name.length; i++) x = (x * 31 + name.charCodeAt(i)) >>> 0;
    return base[x % base.length];
  }, [darkMode]);

  const toggleSerie = (key) => {
    // Oculta/mostra a série
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    // Garante que a tooltip não reative sozinha após o clique
    setTt(null);
    // anima o rearranjo quando alterna pela legenda
    setAnimateLegend(true);
    setTimeout(() => setAnimateLegend(false), 500);
  };

  // Utils de formatação
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const nomeMes = (mes) =>
    new Date(0, mes - 1).toLocaleString('pt-BR', { month: 'short' });
  const formatadorMes = (mes) => {
    const m = new Date(0, Number(mes) - 1).toLocaleString('pt-BR', { month: 'short' });
    return cap(m); // ex.: "Jan.", "Fev."
  };
  const formatadorTooltipMes = (mes) => {
    const m = new Date(0, Number(mes) - 1).toLocaleString('pt-BR', { month: 'long' });
    return cap(m); // ex.: "Janeiro"
  };
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const abreviarBRL = (n) => {
    if (n === 0) return 'R$ 0';
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    let valor = abs, sufixo = '';
    if (abs >= 1e9) { valor = abs / 1e9; sufixo = 'B'; }
    else if (abs >= 1e6) { valor = abs / 1e6; sufixo = 'M'; }
    else if (abs >= 1e3) { valor = abs / 1e3; sufixo = 'K'; }
    const dec = valor < 10 ? 1 : 0;
    const num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(valor);
    return `${sign}R$ ${num}${sufixo}`;
  };

    // === Linhas memoizadas (fora do JSX condicional) ===
  const linesMemo = useMemo(() => {
    if (!Array.isArray(dados) || dados.length === 0) return null;
    return categoriasAll
      .filter(cat => !hidden.has(cat))
      .map((cat) => (
        <Line
          key={cat}
          type="monotone"
          dataKey={cat}
          strokeWidth={2}
          stroke={colorFor(cat)}
          dot={{ r: 3, stroke: colorFor(cat), fill: colorFor(cat) }}
          activeDot={{ r: 5, stroke: colorFor(cat), fill: colorFor(cat) }}
          // anima quando dados mudam OU ao clicar na legenda; nunca no hover
          isAnimationActive={animate || animateLegend}
          animationDuration={animateLegend ? 450 : 900}
          animationEasing="ease-in-out"
          name={cat}
        />
      ));
   }, [categoriasAll, hidden, colorFor, dados, animate, animateLegend]);

  return ( 
    <div className="bg-white dark:bg-darkCard p-4 rounded shadow relative">
        <div className="absolute right-3">
          <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
            <ul className="list-disc pl-4 space-y-1">
              <li>Mostra o gasto <b>mensal</b> por categoria (linhas).</li>
              <li>Clique na <b>legenda</b> para ocultar/exibir categorias.</li>
              <li>O eixo Y se ajusta às categorias visíveis.</li>
              <li>Os <b>pontos</b> marcam cada mês; passe o mouse para ver os valores.</li>
            </ul>
          </InfoTip>
        </div>

      <h3 className="text-lg font-semibold mb-1 text-gray-800 dark:text-darkText text-center">Gastos mensais por categoria</h3>

      {/* ⏳ Carregando */}
      {loading && (
        <div className="h-[300px] flex items-center justify-center">
          <div className="flex items-center gap-3 text-sm">
            <span
              className="inline-block w-4 h-4 rounded-full border-2 border-gray-300 border-t-transparent animate-spin
                         dark:border-gray-700 dark:border-t-transparent"
              aria-label="Carregando"
            />
            <span className="text-gray-500 dark:text-gray-400">Carregando dados…</span>
          </div>
        </div>
      )}

      {/* 🚫 Sem dados */}
      {!loading && (!Array.isArray(dados) || dados.length === 0) && (
        <div className="h-[300px] flex items-center justify-center">
          <div className="text-center text-sm">
            <p className="text-gray-600 dark:text-gray-300 font-medium">Nenhum dado disponível</p>
            <p className="text-gray-500 dark:text-gray-400">Ajuste os filtros para ver resultados.</p>
          </div>
        </div>
      )}

      {!loading && Array.isArray(dados) && dados.length > 0 && (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={dados}
          onMouseMove={(s) => {
            // Se entrou na área ativa do gráfico:
            if (s && s.isTooltipActive) {
              // cancela qualquer hide pendente
              if (hideTtTimerRef.current) {
                clearTimeout(hideTtTimerRef.current);
                hideTtTimerRef.current = null;
              }
              // atualiza apenas quando o label muda (evita re-render e piscadas)
              if (lastLabelRef.current !== s.activeLabel) {
                lastLabelRef.current = s.activeLabel;
                setTt({ label: s.activeLabel, payload: s.activePayload });
              }
              return;
            }
            // Fora da área ativa (ex.: sobre o eixo X) → esconde com atraso curto (histerese)
            if (!hideTtTimerRef.current) {
              hideTtTimerRef.current = setTimeout(() => {
                hideTtTimerRef.current = null;
                lastLabelRef.current = null;
                setTt(null);
              }, 120);
            }
          }}
          onMouseLeave={() => {
            if (hideTtTimerRef.current) {
              clearTimeout(hideTtTimerRef.current);
              hideTtTimerRef.current = null;
            }
            lastLabelRef.current = null;
            setTt(null);
          }}
        >
          <CartesianGrid stroke={darkMode ? '#30363d' : '#e5e7eb'} strokeDasharray="3 3" />
          <XAxis
            dataKey="mes"
            tick={{ fill: darkMode ? '#c9d1d9' : '#374151' }}
            tickFormatter={formatadorMes}
          />
          <YAxis
            tick={{ fill: darkMode ? '#c9d1d9' : '#374151' }}
            tickFormatter={abreviarBRL}
         />
          <Tooltip
            active={!!tt}
            payload={tt?.payload || []}
            label={tt?.label}
            content={
              <ChartTooltip
                darkMode={darkMode}
                labelFormatter={formatadorTooltipMes}
                valueFormatter={(v) => fmtBRL.format(Number(v || 0))}
                isVisible={(name) => !hidden.has(String(name))}
              />
            }
          />
          {/* Legenda clicável (EMBAIXO) — render baseada em TODAS as categorias,
              assim os itens continuam visíveis mesmo quando a linha está oculta */}
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ marginTop: 8 }}
            content={() => (
              <div className="flex flex-wrap gap-3 justify-center pt-1">
                {categoriasAll.map((key) => {
                  const isHidden = hidden.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSerie(key); }}
                      className={`flex items-center gap-2 text-xs transition`}
                      style={{ opacity: isHidden ? 0.35 : 1 }}
                      title={isHidden ? `Mostrar ${key}` : `Ocultar ${key}`}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 12, height: 12, borderRadius: 2,
                          background: colorFor(key),
                          outline: isHidden
                            ? (darkMode ? '1px solid #374151' : '1px solid #d1d5db')
                            : 'none',
                        }}
                      />
                      {/* texto mais suave no dark mode */}
                      <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                        {key}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          />
          {/* Linhas (memoizadas acima, sem hooks dentro do JSX condicional) */}
          {linesMemo}
        </LineChart>
      </ResponsiveContainer>
        )}
    </div>
  );
}

export default GraficoLinhaCategorias;