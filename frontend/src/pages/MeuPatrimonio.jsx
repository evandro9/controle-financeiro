import React, { useEffect, useMemo, useState, useCallback, useDeferredValue } from 'react';
import { toast } from 'react-toastify';
import { TrendingUp, Pencil, X } from 'lucide-react';
import CalculadoraSaldo from '../components/patrimonio/CalculadoraSaldo';
import GraficoEvolucaoConta from '../components/patrimonio/GraficoEvolucaoConta';
import AtualizacaoPatrimonio from '../components/patrimonio/AtualizacaoPatrimonio';
import TabelaPatrimonio from '../components/patrimonio/TabelaPatrimonio'; 
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getMeuPatrimonioSteps, getMeuPatrimonioMobileNoticeSteps } from '../tour/steps/meuPatrimonio';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_NUM = [1,2,3,4,5,6,7,8,9,10,11,12];
const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Calcula a evolução mês a mês (Δ% vs mês anterior) apenas se houver saldo no mês atual e no anterior
function calcularEvolucaoPorMes(evolucaoTotal) {
  // espera array com itens { ano, mes, total_saldo }
  const ord = [...(evolucaoTotal || [])].sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes));
  const porMes = {};
  for (let i = 0; i < ord.length; i++) {
    const cur = ord[i];
    const prev = ord[i - 1];
    const curSaldo = Number(cur?.total_saldo ?? 0);
    const prevSaldo = Number(prev?.total_saldo ?? 0);

    // Só calcula se tiver mês anterior e AMBOS os saldos > 0
    if (prev && prevSaldo > 0 && curSaldo > 0) {
      porMes[cur.mes] = (curSaldo - prevSaldo) / prevSaldo;
    } else {
      porMes[cur.mes] = null; // sem base / mês zerado → não exibe -100%
    }
  }
  return porMes; // { 1: 0.012, 2: -0.004, ... } ou null
}

function mediaEvolucao(evolucaoTotal) {
  const porMes = calcularEvolucaoPorMes(evolucaoTotal);
  const vals = Object.values(porMes).filter(v => typeof v === 'number' && !isNaN(v));
  if (!vals.length) return 0;
  // média aritmética simples dos Δ% mensais
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export default function MeuPatrimonio() {
  // Controle de período e seleção
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1);

  // Dados
  const [contas, setContas] = useState([]); // /patrimonio/contas
  // Mantém a UI responsiva enquanto pai re-renderiza
  const contasDefer = useDeferredValue(contas);
  const [evolucaoTotal, setEvolucaoTotal] = useState([]); // /patrimonio/evolucao?ano=
  const [overview, setOverview] = useState(null); // /patrimonio/overview?ano&mes
  const [evolucaoPorConta, setEvolucaoPorConta] = useState({}); // { [conta_id]: [{mes, saldo, taxa}] }
  const [evolucaoConsolidada, setEvolucaoConsolidada] = useState(null); // {ano, meses, totais_por_mes, anual}
  const [totalPorMes, setTotalPorMes] = useState({});                   // {1:0,2:0,...}
  const [evolucaoNoAno, setEvolucaoNoAno] = useState(null);             // número | null
  // ---- Moeda / FX ----
  const [moeda, setMoeda] = useState('BRL'); // 'BRL' | 'USD'
  const [usdCache, setUsdCache] = useState({}); // { [ano]: {1:fx,2:fx,...} }
  const [carregandoUSD, setCarregandoUSD] = useState(false);

    // ---- Tours (desktop x mobile)
  const stepsPat = useMemo(() => getMeuPatrimonioSteps(), []);
  const { maybeStart: maybeStartPat } = useFirstLoginTour('meupatrimonio_v1', stepsPat, { alwaysOpen: true });
  const stepsPatMobile = useMemo(() => getMeuPatrimonioMobileNoticeSteps(), []);
  const { maybeStart: maybeStartPatMobile } = useFirstLoginTour('meupatrimonio_mobile_v1', stepsPatMobile);

  // Inicia o tour somente quando houver dados e alvos no DOM (evita abrir antes)
  useEffect(() => {
    // condição de "carregado": chegou overview OU evolução total
    const carregado = !!overview || (Array.isArray(evolucaoTotal) && evolucaoTotal.length > 0);
    if (!carregado) return;
    // alvos existem?
    const haveTargets =
      typeof document !== 'undefined' &&
      document.querySelector('[data-tour="pat-cards"]') &&
      document.querySelector('[data-tour="pat-grafico"]') &&
      document.querySelector('[data-tour="pat-calc"]') &&
      document.querySelector('[data-tour="pat-atualiza"]') &&
      document.querySelector('[data-tour="pat-tabela"]');
    if (!haveTargets) return;
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 1024px)').matches; // >= lg
    const start = () => (isDesktop ? maybeStartPat() : maybeStartPatMobile());
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [
    overview,
    evolucaoTotal.length,
    maybeStartPat,
    maybeStartPatMobile
  ]);

 // Formulário de lançamento (estilo Planejamento)
 const [contaNomeForm, setContaNomeForm] = useState('');
 const [saldoForm, setSaldoForm] = useState('');
 const [aporteForm, setAporteForm] = useState('');
 const [retiradaForm, setRetiradaForm] = useState('');
 const [salvando, setSalvando] = useState(false);

 // Helpers
const toBRL = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const parseBRLInput = (s) => {
  const digits = String(s).replace(/\D/g, '');
  if (!digits) return null;            // permite limpar o campo
  return Number(digits) / 100;         // 123456 -> 1234.56
};


// Estado do modal de edição (sem base inicial)
const [editarObjetivoOpen, setEditarObjetivoOpen] = useState(false);
const [objetivoEdRaw, setObjetivoEdRaw] = useState(
  overview?.objetivo?.objetivo ?? null
);
const [objetivoEdFmt, setObjetivoEdFmt] = useState(
  overview?.objetivo?.objetivo != null ? toBRL(overview.objetivo.objetivo) : ''
);

// Sincroniza quando mudar ano/overview
useEffect(() => {
  const val = overview?.objetivo?.objetivo ?? null;
  setObjetivoEdRaw(val);
  setObjetivoEdFmt(val != null ? toBRL(val) : '');
}, [overview?.objetivo?.objetivo, ano]);

// Handler do input com formatação ao digitar
const handleObjetivoChange = (e) => {
  const raw = parseBRLInput(e.target.value);
  if (raw == null) {
    setObjetivoEdRaw(null);
    setObjetivoEdFmt('');
  } else {
    setObjetivoEdRaw(raw);
    setObjetivoEdFmt(toBRL(raw));
  }
};

// Aviso de aporte sugerido (por ano)
const [fecharAporteSug, setFecharAporteSug] = useState(() =>
  localStorage.getItem(`hideSugestaoAporte_${ano}`) === '1'
);
useEffect(() => {
  setFecharAporteSug(localStorage.getItem(`hideSugestaoAporte_${ano}`) === '1');
}, [ano]);
const fecharAvisoAporte = () => {
  setFecharAporteSug(true);
  localStorage.setItem(`hideSugestaoAporte_${ano}`, '1');
};


  const token = useMemo(() => localStorage.getItem('token'), []);
  const isDark = document.documentElement.classList.contains('dark');
  const toastStyle = isDark
    ? { background: '#1f2937', color: '#f3f4f6' }
    : { background: '#ffffff', color: '#1f2937', border: '1px solid #e5e7eb' };

  // --------- FETCHERS ----------
  async function carregarContas() {
    try {
      const res = await fetch('/api/patrimonio/contas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setContas(Array.isArray(data) ? data.filter(c => c.ativa) : []);
    } catch {
      toast.error('Erro ao carregar contas', { style: toastStyle });
    }
  }

  async function carregarOverview() {
    try {
      const res = await fetch(`/api/patrimonio/overview?ano=${ano}&mes=${mesSelecionado}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOverview(data);
    } catch {
      toast.error('Erro ao carregar resumo', { style: toastStyle });
    }
  }

// ADICIONE / SUBSTITUA por esta versão completa
async function carregarEvolucaoTotal() {
  try {
    const res = await fetch(`/api/patrimonio/evolucao?ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (Array.isArray(data)) {
      // 🔙 Legado (array): calcula totais e evolução anual no front
      setEvolucaoConsolidada(null);
      setEvolucaoTotal(data);
      const totais = {};
      for (let m = 1; m <= 12; m++) {
        const item = data.find(d => Number(d.mes) === m);
        totais[m] = Number(item?.total_saldo || 0);
      }
      setTotalPorMes(totais);
      // evolução no ano (primeiro e último MES com total > 0)
      setEvolucaoNoAno(evolucaoNoAnoNonZero(
        (data || []).filter(d => Number(d.ano) === Number(ano))
      ));
    } else {
      // ✅ Novo formato: { ano, meses, totais_por_mes, anual }
      setEvolucaoConsolidada(data);
      setEvolucaoTotal(Array.isArray(data.meses) ? data.meses : []);
      setTotalPorMes(data.totais_por_mes || {});
    // preferimos aplicar a mesma regra (>0) mesmo no consolidado
      const base = Array.isArray(data.meses)
        ? data.meses.map(d => ({ ano: data.ano, mes: d.mes, total_saldo: d.total_saldo }))
        : Object.entries(data.totais_por_mes || {}).map(([mes, total]) => ({
            ano: data.ano, mes: Number(mes), total_saldo: Number(total || 0)
          }));
      const evo = evolucaoNoAnoNonZero(base);
      setEvolucaoNoAno(evo != null ? evo : (data.anual?.evolucao_no_ano ?? null));
    }
  } catch {
    toast.error('Erro ao carregar evolução total', { style: toastStyle });
  }
}

  async function carregarEvolucaoContas(anoAlvo = ano, { preserve = true } = {}) {
    try {
      if (!Array.isArray(contas) || !contas.length) return;
      const prev = preserve ? (evolucaoPorConta || {}) : {};

      const tuples = await Promise.all(
        (contas || []).map(async (c) => {
          try {
            const res = await fetch(`/api/patrimonio/evolucao?conta_id=${c.id}&ano=${anoAlvo}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) return [c.id, null];
            const arr = await res.json(); // [{mes, saldo, taxa}]
            if (!Array.isArray(arr) || arr.length === 0) return [c.id, null];
            return [c.id, arr];
          } catch {
            return [c.id, null];
          }
        })
      );

      const mapa = { ...(preserve ? prev : {}) };
      tuples.forEach(([id, arr]) => { if (arr) mapa[id] = arr; });
      setEvolucaoPorConta(mapa);
    } catch {
      toast.error('Erro ao carregar evolução por conta', { style: toastStyle });
    }
  }

  // Primeiro carrega contas; depois (ou quando muda ano/mes) atualiza tudo
  useEffect(() => { carregarContas(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    carregarOverview();
    carregarEvolucaoTotal();
    // evolucao por conta depende das contas; se ainda não vieram, isso roda de novo no próximo effect
    if ((contas || []).length) carregarEvolucaoContas(ano);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mesSelecionado, contas.length]);

    // Busca as cotações USD/BRL só quando usuário liga o toggle USD e ainda não temos cache pro ano
  useEffect(() => {
    if (moeda !== 'USD') return;
    if (usdCache[ano]) return;
    (async () => {
      try {
        setCarregandoUSD(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/patrimonio/usd-mensal?ano=${ano}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json(); // { ano, usd_brl_por_mes: {1:5.0,...} }
        setUsdCache(prev => ({ ...prev, [data.ano]: data.usd_brl_por_mes || {} }));
      } catch {
        // se falhar, mantemos BRL
      } finally {
        setCarregandoUSD(false);
      }
    })();
  }, [moeda, ano]);

  // --------- TABELA (planilha) ----------
  const mesesHeader = MESES_NUM; // [1..12]

  function saldoDaCelula(contaId, mes) {
    const linha = evolucaoPorConta?.[contaId] || [];
    const m = linha.find(x => Number(x.mes) === mes);
    return Number(m?.saldo || 0);
  }

  function taxaDaCelula(contaId, mes) {
    const linha = evolucaoPorConta?.[contaId] || [];
    const m = linha.find(x => Number(x.mes) === mes);
    return Number(m?.taxa || 0);
  }

  // ---- Seletores para os CARDS (independentes do mesSelecionado) ----
const dadosAno = React.useMemo(() => {
  return (evolucaoTotal || [])
    .filter(d => Number(d.ano) === Number(ano));
}, [evolucaoTotal, ano]);

// Busca FX sob demanda
useEffect(() => {
  if (moeda !== 'USD') return;
  if (usdCache[ano]) return;
  (async () => {
    try {
      setCarregandoUSD(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/patrimonio/usd-mensal?ano=${ano}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json(); // { ano, usd_brl_por_mes: {1:5.0,...} }
      setUsdCache(prev => ({ ...prev, [data.ano]: data.usd_brl_por_mes || {} }));
    } catch {
      // mantém BRL se falhar
    } finally {
      setCarregandoUSD(false);
    }
  })();
}, [moeda, ano]);

// Converte os totais para USD quando possível;
// se ainda não houver FX p/ um mês, mantemos BRL naquele mês (evita “linha zerada”)
const totalPorMesConvertido = React.useMemo(() => {
  if (moeda !== 'USD') return totalPorMes;
  const fxAno = usdCache[ano] || {};
  const out = {};
  for (let m = 1; m <= 12; m++) {
    const brl = Number(totalPorMes?.[m] ?? 0);
    const usdbrl = Number(fxAno?.[m] ?? 0);
    out[m] = (brl > 0 && usdbrl > 0) ? (brl / usdbrl) : brl; // fallback: BRL
  }
  return out;
}, [moeda, totalPorMes, usdCache, ano]);

const toggleMoeda = (
  <div className="inline-flex rounded-lg border border-gray-200 dark:border-darkBorder overflow-hidden">
    <button
      className={`px-3 py-1 text-sm ${moeda==='BRL' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-700 dark:text-gray-200'}`}
      onClick={() => setMoeda('BRL')}
    >
      BRL
    </button>
    <button
      className={`px-3 py-1 text-sm ${moeda==='USD' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-700 dark:text-gray-200'}`}
      onClick={() => setMoeda('USD')}
      disabled={carregandoUSD}
      title={carregandoUSD ? 'Carregando cotações...' : 'Ver em dólar (fechamento do mês)'}
    >
      USD
    </button>
  </div>
);

  // Evolução (Δ% vs mês anterior) por mês, calculada no front
  const evolucaoPorMes = useMemo(() => calcularEvolucaoPorMes(evolucaoTotal), [evolucaoTotal]);

  // --------- SUBMIT DO FORMULÁRIO ----------
async function handleSubmit(e) {
  e.preventDefault();
  if (!contaNomeForm.trim()) { toast.info('Informe o nome da conta', { style: toastStyle }); return; }
  try {
    setSalvando(true);
    // 1) Tenta localizar a conta pelo nome (case-insensitive)
const existente = (contas || []).find(
  c => String(c.nome).toLowerCase().trim() === contaNomeForm.toLowerCase().trim()
);
let contaId = existente?.id;
// 2) Se não existir, cria rapidamente e usa o id retornado
if (!contaId) {
  const resConta = await fetch('/api/patrimonio/contas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nome: contaNomeForm.trim(), tipo: 'conta', instituicao: null, ativa: 1 })
  });
  if (!resConta.ok) throw new Error();
  const nova = await resConta.json();
  contaId = nova.id;
  // atualiza lista local de contas para já aparecer
  setContas(prev => [...prev, { id: contaId, nome: contaNomeForm.trim(), ativa: 1 }]);
}

    const payload = {
      conta_id: Number(contaId),
      ano,
      mes: mesSelecionado,
      saldo: Number(saldoForm || 0),
      aportes: Number(aporteForm || 0),
      retiradas: Number(retiradaForm || 0),
      obs: null
    };
    const res = await fetch('/api/patrimonio/saldos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error();
    toast.success('Patrimônio atualizado!', { style: toastStyle });
    // refresh dos dados da página
    await Promise.all([carregarOverview(), carregarEvolucaoTotal(), carregarEvolucaoContas(ano)]);
    // limpa formulário
    setContaNomeForm(''); setSaldoForm(''); setAporteForm(''); setRetiradaForm('');
  } catch {
    toast.error('Erro ao salvar atualização', { style: toastStyle });
  } finally {
    setSalvando(false);
  }
}

// Helper: tenta deduzir meses com alguma atualização real nas contas (células preenchidas)
const ultimoMesComAtualizacao = React.useMemo(() => {
  if (!Array.isArray(contas) || !Array.isArray(mesesHeader)) return null;

  // percorre de 12 -> 1 procurando algum mês com pelo menos uma célula válida
  for (let i = mesesHeader.length - 1; i >= 0; i--) {
    const m = Number(mesesHeader[i]);
    const temAlgumValor = (contas || []).some(c => {
      const v = saldoDaCelula?.(c.id, m);
      return v !== null && v !== undefined && Number.isFinite(Number(v));
    });
    if (temAlgumValor) return m;
  }
  return null;
}, [contas, mesesHeader, saldoDaCelula]);

// 1ª tentativa: último mês do ano com total_saldo > 0
// 2ª tentativa: último mês com alguma atualização nas células
const ultimoMesComDados = React.useMemo(() => {
  const candidatosPositivos = (dadosAno || [])
    .filter(d => Number(d.total_saldo) > 0)
    .map(d => Number(d.mes));

  if (candidatosPositivos.length) {
    return Math.max(...candidatosPositivos);
  }
  return ultimoMesComAtualizacao;
}, [dadosAno, ultimoMesComAtualizacao]);

const patrimonioTotalCard = React.useMemo(() => {
  if (ultimoMesComDados == null) return 0;
  const d = (dadosAno || []).find(x => Number(x.mes) === Number(ultimoMesComDados));
  return Number(d?.total_saldo || 0);
}, [dadosAno, ultimoMesComDados]);

// média das variações mensais até o último mês com dados
const evolucaoMediaCard = React.useMemo(() => {
  if (!ultimoMesComDados) return 0;
  const entradas = Object.entries(evolucaoPorMes || {})
    .filter(([mes, tx]) => tx != null && Number(mes) <= Number(ultimoMesComDados))
    .map(([, tx]) => Number(tx));
  if (!entradas.length) return 0;
  const soma = entradas.reduce((a, b) => a + b, 0);
  return soma / entradas.length;
}, [evolucaoPorMes, ultimoMesComDados]);

const objetivoAno = React.useMemo(() => {
  const v = overview?.objetivo?.objetivo;
  return v != null ? Number(v) : null;
}, [overview]);

const percAtingidaCard = React.useMemo(() => {
  if (!objetivoAno || objetivoAno === 0) return null;
  return patrimonioTotalCard / objetivoAno;
}, [objetivoAno, patrimonioTotalCard]);

async function handleExcluirContaTabela(id, nome) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/patrimonio/contas/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.ok) {
    toast.success('Conta excluída com sucesso');
    // recarrega listas/visões necessárias
    await Promise.all([carregarContas?.(), carregarEvolucaoContas(ano), carregarEvolucaoTotal(), carregarOverview?.()]);
  } else {
    toast.error('Erro ao excluir conta');
  }
}

async function salvarObjetivoAno() {
  try {
    const res = await fetch('/api/patrimonio/objetivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ano,
        objetivo: objetivoEdRaw == null ? null : Number(objetivoEdRaw),
        base_inicial: null, // removemos o campo do UI; envie null ou remova a prop se a API aceitar
      }),
    });
    if (!res.ok) throw new Error();
    await carregarOverview();
    toast.success('Objetivo atualizado!', { style: toastStyle });
    setEditarObjetivoOpen(false);
  } catch {
    toast.error('Erro ao salvar objetivo', { style: toastStyle });
  }
}

const [hideAvisoObjetivo, setHideAvisoObjetivo] = useState(false);

// Opcional: ao trocar o ano, reabre o aviso
useEffect(() => {
  setHideAvisoObjetivo(false);
}, [ano]);

const fecharAvisoObjetivo = () => {
  setHideAvisoObjetivo(true); // só esconde nesta montagem; ao reabrir a página volta a aparecer
};

// Gap até o objetivo (baseado no último mês com dados do ano filtrado)
const objetivoRestante = useMemo(() => {
  if (objetivoAno == null) return null;
  const gap = Number(objetivoAno) - Number(patrimonioTotalCard || 0);
  return gap > 0 ? gap : 0;
}, [objetivoAno, patrimonioTotalCard]);

// Meses restantes até dezembro (inclui o mês corrente; se quiser só os futuros, use 12 - mesAtual)
const mesesRestantesAno = useMemo(() => {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1; // 1..12

  if (ano < anoAtual) return 0;   // ano passado
  if (ano > anoAtual) return 12;  // ano futuro inteiro
  return Math.max(0, 12 - mesAtual); // ⚠️ exclui o mês atual (ex.: ago -> 4: set/out/nov/dez)
}, [ano]);

// Aumento mensal médio necessário
const aumentoMensalNecessario = useMemo(() => {
  if (objetivoRestante == null) return null;
  if (mesesRestantesAno <= 0) return objetivoRestante;
  return objetivoRestante / mesesRestantesAno;
}, [objetivoRestante, mesesRestantesAno]);

const handleSaved = useCallback(async () => {
  // 1ª passada: preserva o que tem (não some nada), atualiza o que já estiver pronto
  await Promise.all([
    carregarEvolucaoContas(ano, { preserve: true }),
    carregarEvolucaoTotal(),
    carregarOverview?.()
  ]);
  // 2ª passada: curtinha, pega os valores consolidados que podem ter terminado de calcular no backend
  setTimeout(() => {
    carregarEvolucaoContas(ano, { preserve: true });
  }, 350);
}, [ano, carregarEvolucaoContas, carregarEvolucaoTotal]);

// Retorna evolução no ano usando primeiro e último meses com total > 0
function evolucaoNoAnoNonZero(lista) {
  if (!Array.isArray(lista)) return null;
  // só do ano atual já filtrado por quem chama, mas vamos garantir
  const ord = lista
    .map(d => ({ mes: Number(d.mes), total: Number(d.total_saldo || 0), ano: Number(d.ano) }))
    .filter(d => Number.isFinite(d.mes) && d.ano) // mantém só válidos
    .sort((a, b) => a.mes - b.mes);

  const primeiro = ord.find(d => d.total > 0);
  const ultimo   = [...ord].reverse().find(d => d.total > 0);

  if (!primeiro || !ultimo) return null;
  if (primeiro.total <= 0) return null;
  return (ultimo.total - primeiro.total) / primeiro.total;
}

const handleCriarConta = useCallback(async (nome) => {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/patrimonio/contas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nome })
  });
  if (!res.ok) throw new Error('Erro ao criar conta');
  const nova = await res.json();
  await carregarContas();
  return nova;
}, []);

const handleExcluirConta = useCallback(async (id) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/patrimonio/contas/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Erro ao excluir conta');
}, []);

  // --------- UI ----------
  return (
  <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
    {/* Header padrão */}
    <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 text-center sm:text-left">
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center justify-center sm:justify-start gap-2 text-gray-800 dark:text-darkText">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Meu Patrimônio
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-darkMuted">
            Atualize mês a mês os valores de bens e investimentos e acompanhe a evolução do patrimônio por conta e no consolidado.
          </p>
        </div>
        {/* Ano */}
        <div className="flex items-center justify-center sm:justify-end gap-2">
          <label className="text-sm text-gray-600 dark:text-darkMuted">Ano</label>
          <input
            type="number"
            className="h-10 w-24 rounded-lg border bg-white px-3 text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
          />
        </div>
      </div>
      {/* Linha decorativa */}
      <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
    </section>

    {/* Cards-resumo (2 colunas no mobile, 4 no desktop) */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4" data-tour="pat-cards">
  {/* Patrimônio Total (último mês com dados do ano filtrado) */}
  <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 sm:p-5 border border-gray-100 dark:border-darkBorder
                  flex flex-col items-center justify-center text-center">
    <div className="text-sm text-gray-500 dark:text-darkMuted">
      Patrimônio Total {ultimoMesComDados ? `(até ${String(ultimoMesComDados).padStart(2,'0')}/${String(ano).slice(-2)})` : ''}
    </div>
    <div className="text-xl font-bold text-gray-800 dark:text-darkText">
      {Number(patrimonioTotalCard).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
    </div>
  </div>

  {/* Evolução no ano (início → último mês com dados) */}
  <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 sm:p-5 border border-gray-100 dark:border-darkBorder
                  flex flex-col items-center justify-center text-center">
    <div className="text-sm text-gray-500 dark:text-darkMuted">Evolução no ano</div>
    <div className={`text-xl font-bold ${Number(evolucaoNoAno ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      {evolucaoNoAno == null ? '—' : `${(evolucaoNoAno * 100).toFixed(2)}%`}
    </div>
  </div>

{/* Objetivo do Ano (editável) */}
<div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-4 sm:p-5 border border-gray-100 dark:border-darkBorder
                flex flex-col items-center justify-center text-center">
  {/* Ícone de edição no canto (fora do fluxo, não afeta centralização) */}
  <button
    type="button"
    onClick={() => setEditarObjetivoOpen(true)}
    className="absolute top-2 right-2 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100
               dark:text-darkMuted dark:hover:text-darkText dark:hover:bg-white/5"
    title="Editar objetivo do ano"
    aria-label="Editar objetivo do ano"
  >
    <Pencil className="w-4 h-4" />
  </button>

  <div className="text-sm text-gray-500 dark:text-darkMuted">Objetivo do Ano</div>
  <div className="text-xl font-bold text-gray-800 dark:text-darkText">
    {objetivoAno != null
      ? objetivoAno.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—'}
  </div>
</div>

  {/* % Atingida (saldo do último mês ÷ objetivo) */}
  <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 sm:p-5 border border-gray-100 dark:border-darkBorder
                  flex flex-col items-center justify-center text-center">
    <div className="text-sm text-gray-500 dark:text-darkMuted">% Atingida</div>
    <div className="text-xl font-bold text-blue-600">
      {percAtingidaCard != null
        ? `${(percAtingidaCard * 100).toFixed(2)}%`
        : '—'}
    </div>
  </div>
</div>

{/* Aviso: quanto falta para o objetivo */}
{!hideAvisoObjetivo &&
  objetivoAno != null &&
  objetivoRestante != null &&
  objetivoRestante > 0 &&
  mesesRestantesAno > 0 && (
  <div
    className="rounded-xl border px-3 sm:px-4 py-3 sm:py-4
               flex items-center justify-between gap-3
               min-h-12 sm:min-h-14
               bg-amber-50 border-amber-200 text-amber-900
               dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-200"
  >
    <div className="text-sm leading-snug">
      Faltam <span className="font-semibold">{fmtBRL(objetivoRestante)}</span> para atingir seu objetivo de{' '}
      <span className="font-semibold">{fmtBRL(objetivoAno)}</span> em {ano}. Isso reflete em um aporte médio de{' '}
      <span className="font-semibold">{fmtBRL(aumentoMensalNecessario)}</span> por mês nos próximos {mesesRestantesAno}{' '}
      {mesesRestantesAno === 1 ? 'mês' : 'meses'} até dezembro.
    </div>

    <button
      type="button"
      onClick={fecharAvisoObjetivo}
      className="ml-3 sm:ml-4 p-2 rounded-lg shrink-0
                 flex items-center justify-center
                 text-amber-900/80 hover:bg-amber-100
                 dark:text-amber-200 dark:hover:bg-amber-900/20"
      aria-label="Fechar"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
)}  

    {/* Gráfico de evolução (Mobile compacto / Desktop padrão) */}
    <div className="sm:hidden">
      <GraficoEvolucaoConta
        compact
        data={(evolucaoTotal || []).map(d => ({
          mesLabel: `${String(d.mes).padStart(2,'0')}/${String(d.ano).slice(-2)}`,
          saldo: Number(d.total_saldo || 0),
          taxa: Number(evolucaoPorMes?.[d.mes] ?? null),
        }))}
      />
    </div>
  <div className="hidden sm:block" data-tour="pat-grafico">

<GraficoEvolucaoConta
  data={Array.from({length:12}, (_,i)=>({
    mesLabel: MESES[i],
    saldo: Number(totalPorMesConvertido?.[i+1] ?? 0)
  }))}
  moeda={moeda}
  actionsLeft={toggleMoeda}
/>
{carregandoUSD && moeda==='USD' && (
  <div className="mt-2 text-sm text-gray-500 dark:text-gray-300">Baixando cotações USD/BRL…</div>
)}
    </div>

    {/* Calculadora — somente Desktop */}
    <section className="hidden sm:block" data-tour="pat-calc">
      <CalculadoraSaldo contas={contasDefer} />
    </section>

    {/* Atualização mensal — somente Desktop */}
<section className="hidden sm:block" data-tour="pat-atualiza">
  <AtualizacaoPatrimonio
  ano={ano}
  mes={mesSelecionado}
  setMes={setMesSelecionado}
  contas={contasDefer}
  onSaved={handleSaved}
  onCriarConta={handleCriarConta}
  onExcluirConta={handleExcluirConta}
/>
</section>

    {/* Tabela de saldos — somente Desktop */}
<section className="hidden sm:block" data-tour="pat-tabela">
<TabelaPatrimonio
  titulo="Patrimônio por Conta"
  subtitulo={`Valores por mês em ${ano} de cada conta que você possui e sua evolução.`}
  contas={contas}
  mesesHeader={mesesHeader}
  MESES={MESES}
  mesSelecionado={mesSelecionado}
  saldoDaCelula={saldoDaCelula}
  totalPorMes={totalPorMes}
  evolucaoPorMes={evolucaoPorMes}
  onExcluirConta={handleExcluirContaTabela}
  onRenomearConta={async (id, novoNome) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/patrimonio/contas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nome: novoNome }),
    });
    if (res.ok) {
      await Promise.all([carregarContas?.(), carregarEvolucaoContas(ano), carregarEvolucaoTotal(), carregarOverview?.()]);
    }
  }}
/>
</section>
{/* Modal: Editar objetivo */}
{editarObjetivoOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40" onClick={() => setEditarObjetivoOpen(false)} />
    <div className="relative w-full max-w-md bg-white dark:bg-darkCard rounded-xl shadow p-5
                    border border-gray-200 dark:border-white/10">
<div className="relative mb-3">
  <h4 className="text-base font-semibold text-gray-800 dark:text-darkText text-center">
    Objetivo de Patrimônio ({ano})
  </h4>
  <button
    onClick={() => setEditarObjetivoOpen(false)}
    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
    aria-label="Fechar"
  >
    <X className="w-4 h-4 text-gray-500 dark:text-darkMuted" />
  </button>
</div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs text-gray-500 dark:text-darkMuted">Digite abaixo qual sua meta de patrimônio para esse ano:</label>
          <input
            type="text"
            inputMode="numeric"
            value={objetivoEdFmt}
            onChange={handleObjetivoChange}
            placeholder="R$ 0,00"
            className="w-full mt-1 rounded-lg border px-3 py-2 bg-white dark:bg-darkBorder dark:text-darkText
                       border-gray-300 dark:border-darkBorder"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => setEditarObjetivoOpen(false)}
          className="px-3 py-2 rounded-lg border dark:border-darkBorder text-gray-700 dark:text-darkText
                     hover:bg-gray-50 dark:hover:bg-darkBorder/60"
        >
          Cancelar
        </button>
        <button
          onClick={salvarObjetivoAno}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={objetivoEdFmt === ''} // opcional: desabilita se vazio
        >
          Salvar
        </button>
      </div>
    </div>
  </div>
)}
  </div>
);
}
