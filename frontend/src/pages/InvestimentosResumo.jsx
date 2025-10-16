// InvestimentosResumo.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
 import {
   PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
   AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
   BarChart, Bar, LabelList
 } from 'recharts';
import { LineChart, Info } from 'lucide-react';
import TabelaRentabilidadeHierarquica from '../components/investimentosResumo/TabelaRentabilidadeHierarquica';
import GraficoRentabilidadeMensal from '../components/investimentosResumo/GraficoRentabilidadeMensal';
import TabelaRentabilidadeInvestimentos from '../components/investimentosResumo/TabelaRentabilidadeInvestimentos';
import GraficoHistoricoPatrimonio from '../components/investimentosResumo/GraficoHistoricoPatrimonio';
import { ThemeContext } from '../context/ThemeContext';
import InfoTip from '../components/ui/InfoTip';
import ChartTooltip from '../components/ui/ChartTooltip';
import InspectorPosicaoAtivo from "../components/investimentosResumo/InspectorPosicaoAtivo";
import FiltroPeriodoClasses from "../components/investimentosResumo/classesAtivos/FiltroPeriodoClasses";
import GraficoAportesMensais from '../components/investimentosResumo/GraficoAportesMensais'
import FiltroAnalises from '../components/investimentosResumo/FiltroAnalises'
import usePeriodoRange from '../hooks/usePeriodoRange';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import {
  getInvestimentosSteps,
  getInvestimentosMobileNoticeSteps,
  getInvestimentosAtivosSteps,
  getInvestimentosProventosSteps,
} from '../tour/steps/investimentos';
const CardsProventos = React.lazy(() => import('../components/investimentosResumo/proventos/CardsProventos'));
const GraficoProventos = React.lazy(() => import('../components/investimentosResumo/proventos/GraficoProventos'));
const GraficoDistribuicaoProventos = React.lazy(() => import('../components/investimentosResumo/proventos/GraficoDistribuicaoProventos'));
const ClassesAtivos = React.lazy(() => import("../components/investimentosResumo/classesAtivos/ClassesAtivos"));

// evita recriar a cada render
const FRASES = [
  "Investir é plantar hoje para colher amanhã.",
  "O tempo no mercado é mais importante que o timing do mercado.",
  "Disciplina é o segredo para o sucesso financeiro.",
  "Cada aporte é um passo mais perto da sua meta.",
  "Quem poupa, sempre tem."
];

function InvestimentosResumo() {
  const [porClasseAtual, setPorClasseAtual] = useState([]);
  const [porSubclasseAtual, setPorSubclasseAtual] = useState([]);
  const [evolucao, setEvolucao] = useState([]);
  const [agrupados, setAgrupados] = useState([]);
  const [dadosTabela, setDadosTabela] = useState([]);
  const { darkMode } = useContext(ThemeContext);
  const [loading, setLoading] = useState(true);
  const [filtroAtivo, setFiltroAtivo] = useState('');
  // Novo filtro de período
  const [periodo, setPeriodo] = useState('ano'); // 'ano' | '12m' | '24m' | 'inicio'
  const [aba, setAba] = useState('resumo'); // 'resumo' | 'ativos' | 'proventos'
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;  
  // ---- Tours (desktop x mobile) — apenas na primeira visita da aba "resumo"
  const stepsInv = useMemo(() => getInvestimentosSteps(), []);
  const { maybeStart: maybeStartInv } = useFirstLoginTour('investimentos_resumo_v1', stepsInv);
  const stepsInvMobile = useMemo(() => getInvestimentosMobileNoticeSteps(), []);
  const { maybeStart: maybeStartInvMobile } = useFirstLoginTour('investimentos_resumo_mobile_v1', stepsInvMobile);

  // ---- Tours (desktop apenas) — Ativos e Proventos
  const stepsInvAtivos = useMemo(() => getInvestimentosAtivosSteps(), []);
  const { maybeStart: maybeStartInvAtivos } = useFirstLoginTour('investimentos_ativos_v1', stepsInvAtivos);
  const stepsInvProv = useMemo(() => getInvestimentosProventosSteps(), []);
  const { maybeStart: maybeStartInvProv } = useFirstLoginTour('investimentos_proventos_v1', stepsInvProv);

  // se for mobile e estiver na aba 'ativos', volta para 'resumo'
  useEffect(() => {
    if (isMobile && aba === 'ativos') setAba('resumo');
  }, [isMobile, aba]);

  // Dispara tour/aviso quando a aba ativa é "resumo" — **após** carregar os dados
  useEffect(() => {
    if (aba !== 'resumo' || loading) return;
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 1024px)').matches; // >= lg
    const start = () => (isDesktop ? maybeStartInv() : maybeStartInvMobile());
    // dá um tick pro DOM renderizar a versão pós-carregamento
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [aba, loading, maybeStartInv, maybeStartInvMobile]);

    // Dispara tour da aba "Ativos" (desktop apenas) quando selecionada
  useEffect(() => {
    if (aba !== 'ativos') return;
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 1024px)').matches; // >= lg
    if (!isDesktop) return; // nada no mobile
    const start = () => maybeStartInvAtivos();
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [aba, maybeStartInvAtivos]);

  // Dispara tour da aba "Proventos" (desktop apenas) quando selecionada
  useEffect(() => {
    if (aba !== 'proventos') return;
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 1024px)').matches; // >= lg
    if (!isDesktop) return; // nada no mobile
    const start = () => maybeStartInvProv();
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [aba, maybeStartInvProv]);

  const [modalB3Proventos, setModalB3Proventos] = useState(false);
 // --- PROVENTOS ---
 const [provResumo, setProvResumo] = useState({
   totalInvestido: 0, rendaAcumulada: 0, mediaMensal: 0, resultado: 0, yieldOnCost: 0
 });
 const [provHistorico, setProvHistorico] = useState([]);
  const [posicoesMap, setPosicoesMap] = useState({});
const [tickersTreemap, setTickersTreemap] = useState([]);
const frase = useMemo(
  () => FRASES[Math.floor(Math.random() * FRASES.length)],
  []
);

  // Header de autorização padronizado (evita "Bearer Bearer ..." e token vazio)
  const authHeaders = () => {
    const raw = (localStorage.getItem('token') || '').trim();
    if (!raw) return {};
    const val = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
    return { Authorization: val };
  };

// Helper: monta o mapa { [ticker]: { quantidade, precoMedio, precoAtual, valorAplicado } }
async function fetchPosicoesByTicker(tickers = []) {
  const token = localStorage.getItem("token");
  const uniq = [...new Set((tickers || []).filter(Boolean))];
  if (!uniq.length) return {};

  const pairs = await Promise.all(
    uniq.map(async (t) => {
      try {
        const r = await fetch(
          `/api/investimentos/inspector?ativo=${encodeURIComponent(t)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!r.ok) return [t, null];
        const j = await r.json();
        // Normaliza nomes esperados pela Tooltip do treemap
        const quantidade    = j.quantidade ?? j.qtd ?? j.qtde ?? null;
        const precoMedio    = j.preco_medio ?? j.precoMedio ?? null;
        const precoAtual    = j.ultima_cotacao ?? j.preco_atual ?? j.precoAtual ?? null;
        const valorAplicado = j.valor_aplicado ?? j.valorAplicado ?? (
          precoMedio != null && quantidade != null ? Number(precoMedio) * Number(quantidade) : null
        );
        return [t, {
          quantidade: quantidade != null ? Number(quantidade) : null,
          precoMedio: precoMedio != null ? Number(precoMedio) : null,
          precoAtual: precoAtual != null ? Number(precoAtual) : null,
          valorAplicado: valorAplicado != null ? Number(valorAplicado) : null,
        }];
      } catch {
        return [t, null];
      }
    })
  );
  return Object.fromEntries(pairs.filter(([, v]) => v));
}

  // sempre que os tickers visíveis do treemap mudarem, busca o inspector
  useEffect(() => {
    if (!tickersTreemap.length) return;
    (async () => {
      const m = await fetchPosicoesByTicker(tickersTreemap);
      setPosicoesMap(m);
    })();
  }, [tickersTreemap]);

  // período memoizado, usado em várias chamadas
  const { inicio, fim } = usePeriodoRange(periodo);

useEffect(() => {
  // inicial: tenta atualizar cotações e carrega painéis
  (async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await fetch('/api/investimentos/atualizar-cotacoes', {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {}
    await carregarDados();
    setLoading(false);
  })();
}, []);

  const carregarDados = async () => {
    const token = localStorage.getItem('token');

    const ev = await fetch(`/api/investimentos/evolucao?periodo=${encodeURIComponent(periodo)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const evolucaoData = await ev.json();
    setEvolucao(evolucaoData);

    const res = await fetch('/api/investimentos/rentabilidade-hierarquica', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const hierarquiaJson = await res.json();
    const hierarquia = Array.isArray(hierarquiaJson) ? hierarquiaJson : [];
    processarDistribuicao(
      hierarquia.flatMap(cl =>
        (cl.subclasses || []).flatMap(sub =>
          (sub.ativos || []).map(at => ({
            categoria: cl.nome,
            subcategoria: sub.nome,
            nome_investimento: at.nome,
            valor_investido: at.investido,
            valor_atual: at.atual
          }))
        )
      )
    );
    setAgrupados(hierarquia);
  };

 // Recarrega quando o PERÍODO muda (painéis que dependem dele)
 useEffect(() => { carregarDados(); }, [periodo]);

 // Proventos só quando entrar na aba de proventos
 useEffect(() => { if (aba === 'proventos') carregarProventos(); }, [aba, inicio, fim]);

  const processarDistribuicao = (data) => {
    // 1) só considera itens com valor atual positivo
    const vivos = (data || []).filter(d => Number(d.valor_atual) > 0);
    if (!vivos.length) {
      setPorClasseAtual([]); setPorSubclasseAtual([]); return;
    }

    // 2) agrega por classe e por subclasse
    const classeMap = {};
    const subclasseMap = {};
    for (const inv of vivos) {
      const classe = inv.categoria || 'Outros';
      const sub    = inv.subcategoria || 'Outros';
      const v      = Number(inv.valor_atual || 0);
      classeMap[classe]  = (classeMap[classe]  || 0) + v;
      subclasseMap[sub]  = (subclasseMap[sub]  || 0) + v;
    }

    // 3) monta arrays, remove zeros residuais e ordena desc
    const porClasseArr = Object.entries(classeMap)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .filter(it => it.value > 0)
      .sort((a,b)=>b.value-a.value);

    const porSubArr = Object.entries(subclasseMap)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .filter(it => it.value > 0)
      .sort((a,b)=>b.value-a.value);

    setPorClasseAtual(porClasseArr);
    setPorSubclasseAtual(porSubArr);
  };

 const formatarValor = (v) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });



  function agruparInvestimentos(dados) {
    const mapa = {};

    dados.forEach((inv) => {
      const classe = inv.categoria || 'Outros';
      const subclasse = inv.subcategoria || 'Outros';
      const ativo = inv.nome_investimento || 'Desconhecido';
      const valor_investido = inv.valor_investido || 0;
      const valor_atual = inv.valor_atual || 0;

      if (!mapa[classe]) {
        mapa[classe] = { investido: 0, atual: 0, subclasses: {} };
      }
      if (!mapa[classe].subclasses[subclasse]) {
        mapa[classe].subclasses[subclasse] = { investido: 0, atual: 0, ativos: {} };
      }
      if (!mapa[classe].subclasses[subclasse].ativos[ativo]) {
        mapa[classe].subclasses[subclasse].ativos[ativo] = { investido: 0, atual: 0 };
      }

      mapa[classe].subclasses[subclasse].ativos[ativo].investido = valor_investido;
      mapa[classe].subclasses[subclasse].ativos[ativo].atual = valor_atual;
      mapa[classe].subclasses[subclasse].investido += valor_investido;
      mapa[classe].subclasses[subclasse].atual += valor_atual;
      mapa[classe].investido += valor_investido;
      mapa[classe].atual += valor_atual;
    });

    return Object.entries(mapa).map(([classeNome, classeDados]) => {
      const subclasses = Object.entries(classeDados.subclasses).map(([subNome, subDados]) => {
        const ativos = Object.entries(subDados.ativos).map(([ativoNome, ativoDados]) => ({
          nome: ativoNome,
          investido: ativoDados.investido,
          atual: ativoDados.atual,
          rentabilidade: ativoDados.investido > 0
            ? ((ativoDados.atual - ativoDados.investido) / ativoDados.investido) * 100
            : 0
        }));

        return {
          nome: subNome,
          investido: subDados.investido,
          atual: subDados.atual,
          rentabilidade: subDados.investido > 0
            ? ((subDados.atual - subDados.investido) / subDados.investido) * 100
            : 0,
          ativos
        };
      });

      return {
        nome: classeNome,
        investido: classeDados.investido,
        atual: classeDados.atual,
        rentabilidade: classeDados.investido > 0
          ? ((classeDados.atual - classeDados.investido) / classeDados.investido) * 100
          : 0,
        subclasses
      };
    });
  }
  
  // Paleta padronizada p/ Distribuição Geral (boa em dark/light e consistente com o resto)
const CORES_DISTRIB_GERAL = [
  '#4F46E5', // indigo-600 (brand)
  '#22C55E', // emerald-500
  '#06B6D4', // cyan-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#A78BFA', // violet-400
  '#0EA5E9', // sky-500
  '#F97316', // orange-500
];

  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [filtroSubclasse, setFiltroSubclasse] = useState('');

useEffect(() => {
  const buscarDadosTabela = async () => {
    try {
      const url = new URL('/api/investimentos/rentabilidade-detalhada', window.location.origin);
      url.searchParams.append('ano', anoSelecionado);
      const res = await fetch(url.toString(), {
        headers: { ...authHeaders() }
      });
      const data = await res.json();
      setDadosTabela(data);
    } catch (err) {
      console.error('Erro ao buscar rentabilidade detalhada:', err);
    }
  };

  buscarDadosTabela();
}, [anoSelecionado]);

const frasesMotivacionais = [
  "Investir é plantar hoje para colher amanhã.",
  "O tempo no mercado é mais importante que o timing do mercado.",
  "Disciplina é o segredo para o sucesso financeiro.",
  "Cada aporte é um passo mais perto da sua meta.",
  "Quem poupa, sempre tem."
];

if (loading) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
             style={{ borderColor: darkMode ? '#10B981' : '#16A34A', borderTopColor: 'transparent' }}>
        </div>
      </div>
      <span className="mt-3 text-gray-600 dark:text-gray-300 text-sm">
        Carregando dados dos investimentos...
      </span>
      <span className="mt-2 text-gray-500 dark:text-gray-400 italic text-xs max-w-xs">
        {frase}
      </span>
    </div>
  );
}

// Tooltip específica para o Pie (garante quadradinho com a cor do slice)
const PieTooltip = ({ active, payload }) => {
  const { darkMode } = React.useContext(ThemeContext);
  if (!active || !payload || !payload.length) return null;

  const itens = payload.filter(p => typeof p?.value === 'number');

  return (
    <div
      className={`rounded-lg shadow-md px-3 py-2 text-sm border ${
        darkMode
          ? 'bg-darkCard border-darkBorder text-darkText'
          : 'bg-white border-gray-200 text-gray-800'
      }`}
    >
      {itens.map((item, i) => {
        // cor do slice: Recharts costuma fornecer em item.color; fallback para fill do payload
        const cor = item.color || item.payload?.fill || item.stroke || '#2563EB';
        const nome = String(item.name ?? item.payload?.name ?? '—');
        const val = Number(item.value || 0).toLocaleString('pt-BR', {
          style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0
        });
        return (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded" style={{ background: cor }} />
              <span className="opacity-80">{nome}</span>
            </div>
            <span className="font-semibold">{val}</span>
          </div>
        );
      })}
    </div>
  );
};

// Legenda em pílulas, alinhada à direita (vertical)
const LegendPillsRight = ({ payload = [] }) => {
  const { darkMode } = React.useContext(ThemeContext);
  return (
    <div className="flex flex-col items-start gap-2 ml-4">
      {payload.map((entry) => (
        <span
          key={entry.value}
          className={
            "inline-flex items-center gap-2 px-2 py-1 rounded-full border text-xs " +
            (darkMode
              ? "bg-[#0f172a] text-[#e5e7eb] border-[#334155]"
              : "bg-gray-50 text-gray-700 border-gray-200")
          }
          title={entry.value}
        >
          <span
            className="w-2.5 h-2.5 rounded"
            style={{ background: entry.color || entry.payload?.fill || "#64748b" }}
          />
          <span
  className={
    "font-medium " + (darkMode ? "dark:text-darkText" : "text-gray-700")
  }
>
  {entry.value}
</span>
        </span>
      ))}
    </div>
  );
};

  // --------------- PROVENTOS: helpers ---------------

  const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const formatMesLabel = (yyyymm) => {
    // aceita "2025-07" ou objetos Date
    if (typeof yyyymm === 'string' && /^\d{4}-\d{2}$/.test(yyyymm)) {
      const [y,m] = yyyymm.split('-').map(Number);
      return `${MESES_PT[m-1]}/${String(y).slice(-2)}`;
    }
    try {
      const d = new Date(yyyymm);
      return `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
    } catch { return String(yyyymm); }
  };

  // transforma [{mes, ativos:{A:10,B:5}, total}] em linhas para BarChart: {mes:'Jul/25', A:10, B:5, total:15}
  const montarLinhasEmpilhadas = (historico=[]) => {
    return historico.map(row => {
      const linha = { mes: formatMesLabel(row.mes), total: row.total || 0 };
      const ativos = row.ativos || {};
      Object.keys(ativos).forEach(k => { linha[k] = ativos[k]; });
      return linha;
    });
  };

  // paleta determinística por ativo
  const corAtivo = (nome) => {
    const cores = ['#4F46E5','#22C55E','#06B6D4','#F59E0B','#EF4444','#A78BFA','#0EA5E9','#F97316','#14B8A6','#E11D48'];
    let hash = 0; for (let i=0;i<nome.length;i++) hash = (hash*31 + nome.charCodeAt(i)) >>> 0;
    return cores[hash % cores.length];
  };

  // label dentro do segmento: "R$ 120 (35%)" só se a fatia for ≥12% da barra
  const LabelSegmento = (props) => {
    const { x, y, width, height, value, dataKey, payload } = props;
    const total = Number(payload?.total || 0);
    const v = Number(value || 0);
    if (!total || v/total < 0.12 || height < 16 || width < 42) return null;
    const pct = Math.round((v/total)*100);
    const txt = `${v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})} (${pct}%)`;
    return (
      <g>
        <text x={x + width/2} y={y + height/2} textAnchor="middle" dominantBaseline="central"
              className="text-[10px] fill-white">
          {txt}
        </text>
      </g>
    );
  };

  // tooltip do gráfico de proventos com % sobre o mês
  const TooltipProventos = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const linha = payload[0]?.payload || {};
    const total = Number(linha.total || 0);
    return (
      <div className={`rounded-lg shadow-md px-3 py-2 text-sm border ${darkMode
        ? 'bg-darkCard border-darkBorder text-darkText'
        : 'bg-white border-gray-200 text-gray-800'}`}>
        <div className="font-semibold mb-1">{label}</div>
        {payload
          .filter(p => typeof p?.value === 'number' && p.dataKey !== 'total')
          .sort((a,b)=>b.value-a.value)
          .map((p,i) => {
            const v = Number(p.value||0);
            const pct = total ? Math.round((v/total)*100) : 0;
            return (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded" style={{background:p.color||'#64748b'}}/>
                  <span className="opacity-80">{p.dataKey}</span>
                </div>
                <span className="font-semibold">
                  {v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}
                  {total ? ` (${pct}%)` : ''}
                </span>
              </div>
            );
          })}
        <div className="mt-2 text-xs opacity-70">Total mês: <b>{total.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}</b></div>
      </div>
    );
  };

  const carregarProventos = async () => {
    // Resumo (cards)
    const r1 = await fetch(
      `/api/investimentos/proventos/resumo?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`,
      { headers: { ...authHeaders() } }
    );
    const resumo = r1.ok ? await r1.json() : {};
    setProvResumo({
      totalInvestido: Number(resumo.totalInvestido || 0),
      rendaAcumulada: Number(resumo.rendaAcumulada || 0),
      mediaMensal:    Number(resumo.mediaMensal    || 0),
      resultado:      Number(resumo.resultado      || 0),
      yieldOnCost:    Number(resumo.yieldOnCost    || 0),
    });
    // Histórico (gráfico)
    const r2 = await fetch(
      `/api/investimentos/proventos/historico?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`,
      { headers: { ...authHeaders() } }
    );
    const historico = r2.ok ? await r2.json() : [];
    setProvHistorico(Array.isArray(historico) ? historico : []);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      <div>
  <div className="mt-4 sm:mt-4 p-6 shadow-md space-y-4 rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder">
  {/* Linha título (removemos o seletor de ano) */}
  <div className="flex justify-between items-center">
    <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-darkText">
      <LineChart className="w-5 h-5 text-green-600" />
      Painel de Investimentos
    </h2>
  </div>

  {/* Subtítulo permanece abaixo */}
  <p className="text-left text-sm text-gray-600 dark:text-darkMuted">
    Acompanhe a evolução e a distribuição dos seus investimentos no período selecionado, com gráficos por classe, subclasse e ativo. Tenha uma visão estratégica para decisões mais seguras.
  </p>

  {/* Linha divisória */}
          <div className="mt-4 h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
</div>
</div>

 {/* 🔽 Novo filtro de análises (fica acima dos gráficos de distribuição) */}
 <FiltroAnalises
   value={aba}
   onChange={setAba}
   title="Análises"
   options={[
     { key: 'resumo', label: 'Resumo' },
     ...(isMobile ? [] : [{ key: 'ativos', label: 'Classes de Ativos' }]),
     { key: 'proventos', label: 'Proventos' },
   ]}
 data-tour="inv-analises"
 />

{aba === 'resumo' ? (
  <>
    {/* Distribuições */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      {/* Distribuição Geral */}
      <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-3 sm:p-4 border border-gray-100 dark:border-darkBorder" data-tour="inv-dist-geral">
        <div className="h-[36px] flex items-center justify-center mb-2 relative">
          <h3 className="text-base font-semibold text-gray-800 dark:text-darkText text-center">
            Distribuição Geral
          </h3>
          <div className="absolute right-0">
            <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
              <ul className="list-disc pl-4 space-y-1">
                <li>Mostra a proporção do <b>valor atual</b> por <b>classe</b>.</li>
              </ul>
            </InfoTip>
          </div>
        </div>
        <div className="h-[260px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
  data={porClasseAtual}
  dataKey="value"
  nameKey="name"
  cx="45%"
  cy="50%"
  outerRadius={90}
  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
  labelLine={false}
  stroke="transparent"        // ← evita a borda branca no dark
  strokeWidth={0}
            >
              {porClasseAtual.map((entry, index) => (
                <Cell key={`cell-geral-${index}`} fill={CORES_DISTRIB_GERAL[index % CORES_DISTRIB_GERAL.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend layout="vertical" verticalAlign="middle" align="right" content={<LegendPillsRight />} />
          </PieChart>
        </ResponsiveContainer>
      </div>  
      </div>

      {/* Distribuição por Subclasse */}
      <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-3 sm:p-4 border border-gray-100 dark:border-darkBorder" data-tour="inv-dist-subclasse">
        <div className="h-[36px] flex items-center justify-center mb-2 relative">
          <h3 className="text-base font-semibold text-gray-800 dark:text-darkText text-center">
            Distribuição por Subclasse
          </h3>
          <div className="absolute right-0">
            <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
              <ul className="list-disc pl-4 space-y-1">
                <li>Proporção do <b>valor atual</b> por <b>subclasse</b>.</li>
              </ul>
            </InfoTip>
          </div>
        </div>
        <div className="h-[260px] sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
  data={porSubclasseAtual}
  dataKey="value"
  nameKey="name"
  cx="45%"
  cy="50%"
  outerRadius={90}
  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
  labelLine={false}
  stroke="transparent"        // ← idem aqui
  strokeWidth={0}
            >
              {porSubclasseAtual.map((entry, index) => (
                <Cell key={`cell-sub-${index}`} fill={CORES_DISTRIB_GERAL[index % CORES_DISTRIB_GERAL.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend layout="vertical" verticalAlign="middle" align="right" content={<LegendPillsRight />} />
          </PieChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>

    {/* Seletor de período + Histórico de Patrimônio */}
    <div className="p-3 sm:p-4 shadow-md rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder" data-tour="inv-periodo">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-darkText">Período:</span>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ano',    label: 'No Ano' },
            { key: '12m',    label: 'Últimos 12m' },
            { key: '24m',    label: 'Últimos 24m' },
            { key: 'inicio', label: 'Do Início' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriodo(opt.key)}
              className={
                'px-3 py-1.5 rounded-full text-sm transition ' +
                (periodo === opt.key
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700')
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* 📊 Aportes Mensais — usa a mesma série 'evolucao' já carregada */}
    <div data-tour="inv-aportes">
      <GraficoAportesMensais dadosEvolucao={evolucao} periodo={periodo} />
    </div>

    <div className="hidden sm:block" data-tour="inv-historico">
      <GraficoHistoricoPatrimonio data={evolucao} periodo={periodo} />
    </div>

    <div className="hidden sm:block" data-tour="inv-rent-geral">
      <TabelaRentabilidadeHierarquica ano={anoSelecionado} />
    </div>

    {/* Rentabilidade Mensal (gráfico) */}
    <div className="hidden sm:block bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder" data-tour="inv-rent-mensal">
      <GraficoRentabilidadeMensal
        ano={anoSelecionado}
        subclasse={filtroSubclasse}
        periodo={periodo}
      />
    </div>

    <div className="hidden sm:block" data-tour="inv-rent-por-ativo">
      <TabelaRentabilidadeInvestimentos ano={anoSelecionado} />
    </div>
  </>
) : (!isMobile && aba === 'ativos') ? ( 
   <React.Suspense fallback={<div className="p-6 text-sm text-gray-500 dark:text-gray-400">Carregando classe de ativos…</div>}>
     <div data-tour="inv-ativos-root">
       <ClassesAtivos />
     </div>
   </React.Suspense>
  ) : (
  /* ------------------ ABA PROVENTOS ------------------ */
  <React.Suspense fallback={<div className="p-6 text-sm text-gray-500 dark:text-gray-400">Carregando proventos…</div>}>
  <div className="space-y-6">
    {/* Filtro de Período (usa o mesmo visual do filtro de análises) */}
    <FiltroAnalises
      value={periodo}
      onChange={setPeriodo}
      title="Período"
      options={[
        { key: 'ano',   label: 'No ano' },
        { key: '12m',   label: 'Últimos 12m' },
        { key: '24m',   label: 'Últimos 24m' },
        { key: 'inicio',label: 'Do início' },
      ]}
      data-tour="inv-prov-periodo"
    />

    {/* seus componentes já existentes */}
    <div data-tour="inv-prov-cards">
      <CardsProventos resumo={provResumo} />
    </div>
    <div data-tour="inv-prov-historico">
      <GraficoProventos key={periodo} historico={provHistorico} />
    </div>
  <div className="hidden sm:block" data-tour="inv-prov-distrib">
    <GraficoDistribuicaoProventos
      inicio={inicio}
      fim={fim}
      posicoesByTicker={posicoesMap}
      onTickersChange={setTickersTreemap}
    />
  </div>
  </div>
  </React.Suspense>
)}
    </div>
  );
}

export default InvestimentosResumo;