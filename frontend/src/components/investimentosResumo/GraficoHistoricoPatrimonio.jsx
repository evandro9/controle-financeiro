// src/components/investimentosResumo/GraficoHistoricoPatrimonio.jsx
import React, { useContext, useMemo, useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';

function formatarBRL(v) {
  if (v == null) return '-';
  return Number(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatarPct(v) {
  if (v == null || isNaN(v)) return '-';
  return `${Number(v).toFixed(2)}%`;
}

function formatarDataBR(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}


/**
 * Componente de gráfico: Histórico do Patrimônio
 * Props:
 *  - data: array [{ mes: 'MM/AAAA' ou 'MMM/AA', investido, atual }]
 *  - periodo: 'ano' | '12m' | '24m' | 'inicio'
 *  - title?: string
 *  - height?: number
 */
const GraficoHistoricoPatrimonio = ({
  data = [],
  periodo = 'ano',
  title = 'Histórico do Patrimônio',
  height = 300,
  carregandoPatrimonio = false,
  carregandoRentabilidade = false,  
}) => {
  const { darkMode } = useContext(ThemeContext);
  const [modo, setModo] = useState('patrimonio'); // 'patrimonio' | 'rentab'
  // séries diárias p/ modo "rentab"
  const [serieDiaria, setSerieDiaria] = useState([]); // [{ date:'YYYY-MM-DD', Carteira, IBOV, CDI }]
  const [loadingDaily, setLoadingDaily] = useState(false);
    const [errDaily, setErrDaily] = useState('');

  const cores = {
    // rentabilidade
    Carteira: '#38bdf8',
    IBOV: '#fb923c',
    CDI: '#a78bfa',
    // patrimônio
    investido: '#3B82F6',
    atual: '#8B5CF6',
  };

  function labelMes(isoDate) {
    if (!isoDate) return '';
    const [y, m] = isoDate.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mm = parseInt(m, 10);
    return `${nomes[mm - 1]}/${y.slice(2)}`;
  }


    const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const permitidos = modo === 'patrimonio'
      ? ['investido', 'atual']
      : ['Carteira', 'IBOV', 'CDI'];
    const itens = payload.filter(
      (p) => permitidos.includes(p.dataKey) && typeof p.value === 'number'
    );
    if (itens.length === 0) return null;

    const titulo = modo === 'patrimonio'
      ? String(label) // no patrimônio, label já é o mês/ano do XAxis
      : `${formatarDataBR(label)} (${labelMes(label)})`;
    const formatValue = (v) => (modo === 'patrimonio' ? formatarBRL(v) : formatarPct(v));
    const nomeSerie = (p) =>
      p.name || (p.dataKey === 'Carteira' ? 'Carteira' : p.dataKey.toUpperCase());

    return (
      <div
        className="rounded-md shadow-md px-3 py-2"
        style={{
          background: darkMode ? '#111827' : '#ffffff',
          border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
          color: darkMode ? '#d1d5db' : '#111827',
          minWidth: 180,
        }}
      >
        <div className="text-xs font-medium mb-1 opacity-80">{titulo}</div>
        <div className="space-y-1">
          {itens.map((p) => (
            <div key={p.dataKey} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: cores[p.dataKey] || p.color,
                  }}
                />
                <span className="text-xs">{nomeSerie(p)}</span>
              </div>
              <span className="text-xs font-semibold">{formatValue(p.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const filtrados = useMemo(() => {
    const arr = Array.isArray(data) ? [...data] : [];
    if (!arr.length) return arr;

    if (periodo === 'inicio') return arr;
    if (periodo === '12m') return arr.slice(-12);
    if (periodo === '24m') return arr.slice(-24);

    // 'ano': tenta filtrar pelo ano corrente com base no rótulo "mes"
    const anoAtual = String(new Date().getFullYear());
    const doAno = arr.filter(p => typeof p.mes === 'string' && p.mes.includes(anoAtual));
    return doAno.length ? doAno : arr.slice(-12);
  }, [data, periodo]);

  // “Tem dado de patrimônio?” (algum valor > 0)
  const hasPatData = useMemo(() => {
    return Array.isArray(filtrados) && filtrados.some(p =>
      Number(p?.investido ?? 0) > 0 || Number(p?.atual ?? 0) > 0
    );
  }, [filtrados]);

    // Busca séries diárias e transforma em ACUMULADAS para modo "rentab"
  useEffect(() => {
    if (modo !== 'rentab') return;
    const token = localStorage.getItem('token');
    const qs = `?periodo=${encodeURIComponent(periodo)}&tradingDays=1&accumulate=1`;
    setLoadingDaily(true);
    setErrDaily('');
    Promise.all([
      // carteira diária (apenas dias de pregão)
      fetch(`/api/investimentos/rentabilidade-diaria${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).catch(() => []),
      // idem para benchmarks
      fetch(`/api/benchmarks/ibov-diario${qs}`).then(r => r.json()).catch(() => []),
      fetch(`/api/benchmarks/cdi-diario${qs}`).then(r => r.json()).catch(() => []),
    ])
 .then(([carteiraRaw, ibovRaw, cdiRaw]) => {
   console.log('[rentab][front] URL chamada:',
     `/api/investimentos/rentabilidade-diaria?periodo=${encodeURIComponent(periodo)}&tradingDays=1&accumulate=1`);
   try {
     console.log('[rentab][front] carteiraRaw (len):', Array.isArray(carteiraRaw) ? carteiraRaw.length : 0,
       'ex:', carteiraRaw?.slice?.(0,3));
     console.log('[rentab][front] ibovRaw (len):', Array.isArray(ibovRaw) ? ibovRaw.length : 0,
       'ex:', ibovRaw?.slice?.(0,3));
     console.log('[rentab][front] cdiRaw (len):', Array.isArray(cdiRaw) ? cdiRaw.length : 0,
       'ex:', cdiRaw?.slice?.(0,3));
   } catch (_) {}
        // Normaliza arrays
        const asArr = (x) => Array.isArray(x) ? x : [];
        // backend já pode mandar valor_cum (% acumulado) quando usamos ?accumulate=1
        const carteira = asArr(carteiraRaw).map(i => ({
          date: String(i.date).slice(0,10),
          daily: Number(i.valor ?? i.value ?? 0),
          cum:   (i.valor_cum != null ? Number(i.valor_cum) : null),
        }));
        const ibov = asArr(ibovRaw).map(i => ({
          date: String(i.date).slice(0,10),
          daily: Number(i.valor ?? i.value ?? 0),
          cum:   (i.valor_cum != null ? Number(i.valor_cum) : null),
        }));
        const cdi = asArr(cdiRaw).map(i => ({
          date: String(i.date).slice(0,10),
          daily: Number(i.valor ?? i.value ?? 0),
          cum:   (i.valor_cum != null ? Number(i.valor_cum) : null),
        }));
        // Usa a CARTEIRA como espinha dorsal (somente dias em que a carteira existe)
        const mapIbovDaily = new Map(ibov.map(x => [x.date, x.daily]));
        const mapCdiDaily  = new Map(cdi.map(x => [x.date, x.daily]));
        const mapIbovCum   = new Map(ibov.filter(x=>x.cum!=null).map(x => [x.date, x.cum]));
        const mapCdiCum    = new Map(cdi.filter(x=>x.cum!=null).map(x => [x.date, x.cum]));
 
        // 1) Série diária alinhada às datas da carteira
        // Se o backend já mandou acumulado (cum), usamos ele; se não, acumulamos localmente.
        const diariaBase = carteira
          .filter(x => x.date) // ignora entradas sem data
          .sort((a,b)=> a.date.localeCompare(b.date))
          .map(({date, daily, cum}) => {
           // benchmarks: preferimos acumulado; se faltar no dia, carregamos o último acumulado
            const lastIbovCum = mapIbovCum.get(date);
            const lastCdiCum  = mapCdiCum.get(date);
            return {
              date,
              carteira_daily: daily,
              carteira_cum: cum,
              ibov_daily: mapIbovDaily.get(date),
              ibov_cum: (lastIbovCum != null ? lastIbovCum : null),
              cdi_daily:  mapCdiDaily.get(date),
              cdi_cum:  (lastCdiCum  != null ? lastCdiCum  : null),
            };
          });

        // 2) Monta série final (preferindo acumulados do back)
        const needAccCarteira = diariaBase.every(p => p.carteira_cum == null);
        const needAccIbov     = diariaBase.every(p => p.ibov_cum == null);
        const needAccCdi      = diariaBase.every(p => p.cdi_cum == null);

        let fCarteira = 1, fIbov = 1, fCdi = 1;
        const out = [];
        for (const p of diariaBase) {
          // Carteira
          if (needAccCarteira) fCarteira *= (1 + ((p.carteira_daily || 0)/100));
          const carteiraCum = (needAccCarteira)
            ? Number(((fCarteira - 1) * 100).toFixed(4))
            : Number((p.carteira_cum || 0).toFixed(4));
          // IBOV / CDI: usa acumulado do back, ou acumula; se faltar no dia, carrega último ponto
          if (needAccIbov)  fIbov *= (1 + ((p.ibov_daily || 0)/100));
          if (needAccCdi)   fCdi  *= (1 + ((p.cdi_daily  || 0)/100));
          const lastOut = out.length ? out[out.length-1] : null;
          const ibovCum = (needAccIbov)
            ? Number(((fIbov - 1) * 100).toFixed(4))
            : (p.ibov_cum != null ? Number(p.ibov_cum.toFixed(4)) : (lastOut?.IBOV ?? 0));
          const cdiCum = (needAccCdi)
            ? Number(((fCdi - 1) * 100).toFixed(4))
            : (p.cdi_cum != null ? Number(p.cdi_cum.toFixed(4)) : (lastOut?.CDI ?? 0));
          out.push({ date: p.date, Carteira: carteiraCum, IBOV: ibovCum, CDI: cdiCum });
        }
        // 🔎 Conferência final no front
        if (out.length) {
          const first = out[0], last = out[out.length - 1];
          console.log('[rentab][front] acumulado FRONT ->',
            'from', first.date, 'to', last.date,
            '| Carteira =', last.Carteira, '% | IBOV =', last.IBOV, '% | CDI =', last.CDI, '%');
        }
        setSerieDiaria(out);
      })
      .catch(() => setErrDaily('Falha ao carregar rentabilidade diária'))
      .finally(() => setLoadingDaily(false));
  }, [modo, periodo]);

  // Ticks mensais a partir da série diária (primeiro dia de cada mês encontrado)
  const ticksMensais = useMemo(() => {
    if (!serieDiaria.length) return [];
    const seen = new Set();
    const ticks = [];
    for (const p of serieDiaria) {
      const month = p.date.slice(0, 7); // YYYY-MM
      if (!seen.has(month)) {
        seen.add(month);
        ticks.push(p.date); // usa o primeiro dia que apareceu no mês
      }
    }
    return ticks;
  }, [serieDiaria]);

  return (
<div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder">
<div className="mb-2">
  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2">
    {/* ESQUERDA: Modo */}
    <div className="justify-self-start">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 dark:text-darkMuted">Modo:</span>
        <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1">
          <button
            onClick={() => setModo('patrimonio')}
            className={
              'px-3 py-1 rounded-full text-xs transition ' +
              (modo === 'patrimonio'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700')
            }
          >
            Patrimônio
          </button>
          <button
            onClick={() => setModo('rentab')}
            className={
              'px-3 py-1 rounded-full text-xs transition ' +
              (modo === 'rentab'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700')
            }
          >
            Rentabilidade
          </button>
        </div>
      </div>
    </div>

    {/* CENTRO: Título (sem subtítulo) */}
    <div className="text-center">
      <h3 className="font-semibold text-gray-800 dark:text-darkText">
        {modo === 'patrimonio' ? title : 'Rentabilidade (Diária)'}
      </h3>
    </div>

    {/* DIREITA: InfoTip que muda com o modo */}
    <div className="justify-self-end">
      <InfoTip
        title={modo === 'patrimonio' ? 'Como ler este gráfico' : 'Como ler este gráfico'}
        ariaLabel="Informações do gráfico"
      >
        {modo === 'patrimonio' ? (
          <ul className="list-disc pl-4 space-y-1">
            <li>Compara <b>Valor Aplicado</b> x <b>Saldo Bruto</b> no fim de cada mês.</li>
            <li>Eixo Y em <b>R$</b>; passe o mouse para ver os valores.</li>
            <li>O período pode ser filtrado no seletor da tela (Ano/12m/24m/Início).</li>
          </ul>
        ) : (
          <ul className="list-disc pl-4 space-y-1">
            <li>Mostra o <b>retorno acumulado diário</b> da carteira e benchmarks.</li>
            <li>Eixo Y em <b>%</b> (acumulado); linha de referência em <b>0%</b>.</li>
            <li>Benchmarks: <b>IBOV</b> e <b>CDI</b> para comparação.</li>
          </ul>
        )}
      </InfoTip>
    </div>
  </div>
</div>

        {modo === 'patrimonio' ? (
        <div className="relative">
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={filtrados}>
            <CartesianGrid stroke={darkMode ? '#21262d' : '#e5e7eb'} strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fill: darkMode ? '#9ca3af' : '#374151' }} />
            <YAxis
              tick={{ fill: darkMode ? '#9ca3af' : '#374151' }}
              tickFormatter={formatarBRL}
              width={90}
            />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: darkMode ? '#374151' : '#e5e7eb', strokeDasharray: '3 3' }}
              />
            <Legend />
            <Area
              type="monotone"
              dataKey="investido"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.2}
              name="Valor Aplicado"
            />
            <Area
              type="monotone"
              dataKey="atual"
              stroke="#8B5CF6"
              fill="#8B5CF6"
              fillOpacity={0.2}
              name="Saldo Bruto"
            />
            </AreaChart>
          </ResponsiveContainer>

          {/* LOADING patrimônio */}
          {carregandoPatrimonio && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/30">
              <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                   style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }} />
              <div className="mt-3 text-xs font-medium text-gray-600 dark:text-darkMuted">
                Carregando dados…
              </div>
            </div>
          )}

          {/* EMPTY patrimônio */}
          {!carregandoPatrimonio && !hasPatData && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-darkMuted border border-gray-200 dark:border-darkBorder">
                Sem dados para este período.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {errDaily && (
            <div className="text-sm text-red-600 dark:text-red-400">{errDaily}</div>
          )}
          {/* ⤵️ wrapper relativo para confinar o overlay ao gráfico */}
          <div className="relative">
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={serieDiaria}>
              <CartesianGrid stroke={darkMode ? '#21262d' : '#e5e7eb'} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                ticks={ticksMensais}
                tickFormatter={labelMes}
                tick={{ fill: darkMode ? '#9ca3af' : '#374151' }}
              />
              <YAxis
                tick={{ fill: darkMode ? '#9ca3af' : '#374151' }}
                tickFormatter={formatarPct}
                width={70}
              />
              {modo === "rentab" && (
                <ReferenceLine
                  y={0}
                  stroke={darkMode ? "#d1d5db" : "#6b7280"}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: darkMode ? "#374151" : "#e5e7eb",
                strokeDasharray: "3 3",
              }}
            />
                <Legend />
                {/* Linhas diárias */}
                <Line type="monotone" dataKey="Carteira" stroke="#38bdf8" strokeWidth={2} dot={false} name="Carteira" />
                <Line type="monotone" dataKey="IBOV" stroke="#fb923c" strokeWidth={2} dot={false} name="IBOV" />
                <Line type="monotone" dataKey="CDI" stroke="#a78bfa" strokeWidth={2} dot={false} name="CDI" />
              </LineChart>
            </ResponsiveContainer>
            {(loadingDaily || carregandoRentabilidade) && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/30">
                <div
                  className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
                  style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }}
                />
                <div className="mt-3 text-xs font-medium text-gray-600 dark:text-darkMuted">
                  Carregando dados…
                </div>
              </div>
            )}
            {/* EMPTY rentabilidade diária */}
            {!loadingDaily && !carregandoRentabilidade && (!Array.isArray(serieDiaria) || serieDiaria.length === 0) && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-darkMuted border border-gray-200 dark:border-darkBorder">
                  Sem dados para este período.
                </div>
              </div>
            )}            
          </div>
        </div>
      )}
    </div>
  );
};

export default GraficoHistoricoPatrimonio;