import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CircleDollarSign, CalendarDays, ChevronDown, BarChart3, LayoutGrid, Layers, Wand2 } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import InfoTip from '../components/ui/InfoTip';
import ScrollArea from "../components/ui/ScrollArea";
import ChartTooltip from '../components/ui/ChartTooltip';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getPlanejamentoSteps, getPlanejamentoMobileNoticeSteps } from '../tour/steps/planejamento';

function Planejamento() {
  // ====== ESTADO BASE ======
  const [categorias, setCategorias] = useState([]);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);

  // formulário clássico (reutilizado no modo "Por Mês" via quick edit)
  const [categoriaId, setCategoriaId] = useState('');
  const [valorPlanejado, setValorPlanejado] = useState(0);
  const [valorPlanejadoTexto, setValorPlanejadoTexto] = useState('');
  const [replicarTodosMeses, setReplicarTodosMeses] = useState(false);
  const [modo, setModo] = useState('fixo');           // 'fixo' | 'percentual'
  const [percentual, setPercentual] = useState(0);    // número 0..100
  const [percentualTexto, setPercentualTexto] = useState(''); // máscara "20%"
  const [planejamentos, setPlanejamentos] = useState([]);
  const [receitasAno, setReceitasAno] = useState(Array(12).fill(0));

  const [msg, setMsg] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [invalid, setInvalid] = useState(new Set());

  // exibição tabela por categoria
  const [mostrarPercentuais, setMostrarPercentuais] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem('planejamento.mostrarPercentuais');
    if (saved !== null) setMostrarPercentuais(saved === '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('planejamento.mostrarPercentuais', mostrarPercentuais ? '1' : '0');
  }, [mostrarPercentuais]);

  // abas (default: Por Categoria)
const [aba, setAba] = useState('categoria'); // 'categoria' | 'mes' | 'geral'
  // mobile?
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  // se for mobile e estiver na aba 'geral', volta para 'categoria'
  useEffect(() => {
    if (isMobile && aba === 'geral') setAba('categoria');
  }, [isMobile, aba]);

  // what-if (cenários de receita) — multiplicador sobre a receita do mês corrente
  const [receitaFactor, setReceitaFactor] = useState(1); // 1.0 = 100%

  // resumo por mês (realizado/planejado por categoria)
  const [resumoMes, setResumoMes] = useState([]); // array de {categoria, valor_planejado, valor_realizado, modo, percentual}
  const [heatmap, setHeatmap] = useState({ loadedAno: null, porCategoria: {} });

    // ---- Tours (desktop x mobile)
  const stepsPlan = useMemo(() => getPlanejamentoSteps(), [aba]);
  const { maybeStart: maybeStartPlan } = useFirstLoginTour('planejamento_v1', stepsPlan);
  const stepsPlanMobile = useMemo(() => getPlanejamentoMobileNoticeSteps(), []);
  const { maybeStart: maybeStartPlanMobile } = useFirstLoginTour('planejamento_mobile_v1', stepsPlanMobile);

  // Dispara quando a página estiver pronta (1ª visita)
  useEffect(() => {
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(min-width: 1024px)').matches; // >= lg
    const start = () => (isDesktop ? maybeStartPlan() : maybeStartPlanMobile());
    // dá um tick pro DOM montar conforme a aba atual
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [aba, maybeStartPlan, maybeStartPlanMobile]);

  // ====== HELPERS ======
  const invalidCls =
    "border-red-500 dark:border-red-500 focus:border-red-500 dark:focus:border-red-500 focus:ring-2 focus:ring-red-500/40 dark:focus:ring-red-500/40";
  const validCls =
    "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 dark:focus:border-blue-400 dark:focus:ring-blue-400/40";
  const clearInvalid = (name) => setInvalid(prev => { const n = new Set(prev); n.delete(name); return n; });

  const formatBRL = (n) => (n == null || isNaN(n)) ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const handleValorPlanejadoChange = (e) => {
    const digits = (e.target.value || '').replace(/\D/g, '');
    const asNumber = digits ? Number(digits) / 100 : 0;
    setValorPlanejado(asNumber);
    setValorPlanejadoTexto(digits ? formatBRL(asNumber) : '');
  };
  const handlePercentChange = (e) => {
    const raw = (e.target.value || '').replace(/[^\d.,]/g, '').replace(',', '.');
    let num = parseFloat(raw);
    if (!Number.isFinite(num)) num = 0;
    if (num < 0) num = 0; if (num > 100) num = 100;
    setPercentual(num);
    setPercentualTexto(num ? `${num}%` : '');
  };

  // ====== LOAD DATA ======
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`/api/categorias`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data?.error || 'Erro'); return data; })
      .then(setCategorias)
      .catch(err => alert('❌ Erro ao carregar categorias:\n' + err.message));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`/api/planejamentos/receitas-ano?ano=${ano}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setReceitasAno(d?.receitas || Array(12).fill(0)))
      .catch(() => setReceitasAno(Array(12).fill(0)));
  }, [ano]);

  useEffect(() => { buscarPlanejamentos(); }, [ano]);
  const buscarPlanejamentos = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/planejamentos?ano=${ano}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setPlanejamentos)
      .catch(() => alert('Erro ao buscar planejamentos'));
  };

  // Resumo do mês corrente (para Aba "Por Mês")
  useEffect(() => {
    if (aba !== 'mes') return;
    const token = localStorage.getItem('token');
    fetch(`/api/planejamentos/resumo?ano=${ano}&mes=${mes}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setResumoMes)
      .catch(() => setResumoMes([]));
  }, [aba, ano, mes]);

  // Heatmap anual (faz 12 chamadas ao resumo — simples e efetivo)
  useEffect(() => {
    if (aba !== 'geral' && aba !== 'categoria') return; // carrega quando for útil
    if (heatmap.loadedAno === ano) return;
    const token = localStorage.getItem('token');

    const porCategoria = {}; // {nome: {1:{pl, rl}, 2:..., 12:...}}
    const fetchMes = (m) => fetch(`/api/planejamentos/resumo?ano=${ano}&mes=${m}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(rows => {
        (rows||[]).forEach(rw => {
          if (!porCategoria[rw.categoria]) porCategoria[rw.categoria] = {};
          porCategoria[rw.categoria][m] = { pl: Number(rw.valor_planejado)||0, rl: Number(rw.valor_realizado)||0 };
        });
      })
      .catch(() => {});

    (async () => {
      for (let m=1;m<=12;m++) { // sequencial pra ser leve no dev server
        await fetchMes(m);
      }
      setHeatmap({ loadedAno: ano, porCategoria });
    })();
  }, [aba, ano]);

  // ====== SOMATÓRIOS ======
  const totaisPorMes = useMemo(() => {
    const arr = Array(12).fill(0);
    planejamentos.forEach(p => { const i = (parseInt(p.mes)||1)-1; arr[i] += Number(p.valor_planejado)||0; });
    return arr;
  }, [planejamentos]);

  // mapa para Tabela por Categoria
  const categoriasMap = useMemo(() => planejamentos.reduce((acc, p) => {
    const nome = p.categoria_nome; const idx = (Number(p.mes)||1)-1;
    if (!acc[nome]) acc[nome] = { values: Array(12).fill(0), isPct: Array(12).fill(false), pct: Array(12).fill(null) };
    acc[nome].values[idx] = Number(p.valor_planejado)||0;
    const isPercent = String(p.modo) === 'percentual' && p.percentual != null;
    acc[nome].isPct[idx] = isPercent; acc[nome].pct[idx] = isPercent ? Number(p.percentual) : null;
    return acc;
  }, {}), [planejamentos]);

  // ====== SUBMISSÃO DO FORM ======
  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(''); setErroForm(''); setInvalid(new Set());
    const faltando = [];
    if (!categoriaId) faltando.push('categoria_id');
    if (!ano) faltando.push('ano');
    if (!replicarTodosMeses && !mes) faltando.push('mes');
    if (modo === 'percentual') {
      if (percentualTexto === '' && (percentual === null || percentual === undefined)) faltando.push('percentual');
    } else {
      if (valorPlanejadoTexto === '' && (valorPlanejado === null || valorPlanejado === undefined)) faltando.push('valor_planejado');
    }
    if (faltando.length) { setInvalid(new Set(faltando)); setErroForm('Preencha os campos obrigatórios.'); return; }

    const token = localStorage.getItem('token');
    const payload = { categoria_id: parseInt(categoriaId), ano, mes, replicarTodosMeses };
    if (modo === 'percentual') { payload.modo = 'percentual'; payload.percentual = Number(percentual)||0; }
    else { payload.modo = 'fixo'; payload.valor_planejado = Number(valorPlanejado)||0; }

    const res = await fetch('/api/planejamentos', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload)
    });
    if (res.ok) {
      toast.success('Planejamento salvo com sucesso');
      buscarPlanejamentos();
      // limpa somente campos de valor, mantém ano/mês selecionados
      setValorPlanejado(0); setValorPlanejadoTexto(''); setPercentual(0); setPercentualTexto(''); setReplicarTodosMeses(false);
    } else { toast.error('Erro ao salvar planejamento'); }
  }

  // quick edit via cards (aba Por Mês): pré-preenche formulário e rola até ele
  const formRef = useRef(null);
  const quickEdit = (catNome, preferModo) => {
    const cat = categorias.find(c => c.nome === catNome);
    if (cat) setCategoriaId(cat.id);
    setModo(preferModo || 'fixo');
    setValorPlanejado(0); setValorPlanejadoTexto('');
    setPercentual(0); setPercentualTexto('');
    setReplicarTodosMeses(false);
    setAba('mes');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 10);
  };

  // toggle percentuais na tabela por categoria
  const handleTogglePercentuais = (checked) => {
    if (checked) {
      const temPercentual = (planejamentos || []).some(p => String(p.modo) === 'percentual');
      if (!temPercentual) { toast.warn('Não há categorias com planejamento em % da receita neste ano.'); return; }
    }
    setMostrarPercentuais(checked);
  };

  // estilo da coluna do mês selecionado na tabela
  const colSelClass = "bg-blue-50 outline outline-1 outline-blue-200 text-blue-700 dark:bg-blue-900/20 dark:outline-blue-800 dark:text-blue-300 font-semibold";

  // ====== RENDER ======
  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Título */}
      <div className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md space-y-3 border border-gray-100 dark:border-darkBorder">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-darkText">
          <CircleDollarSign className="w-5 h-5 text-green-600" />
          Planejamento Financeiro
        </h2>
<p className="text-left text-sm text-gray-600 dark:text-darkMuted mt-1">
  Defina o orçamento mensal por categoria, compare planejado vs realizado e identifique excessos.
</p>
        <div className="mt-4 h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      </div>

      {/* FORM (usado sempre; quick-edit preenche) */}
      <div
        ref={formRef}
        data-tour="plan-form"
        className="px-3 py-4 shadow-md rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder"
      >
        {erroForm && (
          <div className="mb-3 rounded-lg border px-3 py-2 text-sm border-red-400 bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-200 dark:border-red-600">{erroForm}</div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          {/* Ano */}
          <div className="w-full sm:w-24">
            <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Ano</label>
            <div className="relative">
              <select value={ano} onChange={(e)=>{ setAno(parseInt(e.target.value)); clearInvalid('ano'); }} className={`h-9 w-full rounded-lg border px-2 pr-7 text-sm appearance-none dark:bg-darkBg dark:text-darkText dark:border-darkBorder ${invalid.has('ano')?invalidCls:validCls}`}>
                {Array.from({length:10}, (_,i)=>{const y=new Date().getFullYear()-5+i; return <option key={y} value={y}>{y}</option>;})}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
            </div>
          </div>
          {/* Mês */}
          <div className="w-full sm:w-32">
            <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Mês</label>
            <div className="relative">
              <select value={mes} onChange={(e)=>{ setMes(parseInt(e.target.value)); clearInvalid('mes'); }} className={`h-9 w-full rounded-lg border px-2 pr-7 text-sm appearance-none dark:bg-darkBg dark:text-darkText dark:border-darkBorder ${invalid.has('mes')?invalidCls:validCls}`}>
                {["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"].map((mLabel,i)=>{
                  const label=mLabel.charAt(0).toUpperCase()+mLabel.slice(1); return <option key={i+1} value={i+1}>{label}</option>;
                })}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
            </div>
          </div>
          {/* Categoria */}
          <div className="w-full sm:flex-1 min-w-[180px]">
            <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Categoria</label>
            <div className="relative">
              <select value={categoriaId} onChange={(e)=>{ setCategoriaId(parseInt(e.target.value)); clearInvalid('categoria_id'); }} className={`h-9 w-full rounded-lg border px-2 pr-7 text-sm appearance-none dark:bg-darkBg dark:text-darkText dark:border-darkBorder ${invalid.has('categoria_id')?invalidCls:validCls}`}>
                <option value="">Selecione</option>
                {categorias.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
            </div>
          </div>
          {/* Modo */}
          <div className="w-full sm:w-56">
            <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Modo</label>
            <div className="relative">
              <select value={modo} onChange={(e)=> setModo(e.target.value)} className={`h-9 w-full rounded-lg border px-2 pr-7 text-sm appearance-none dark:bg-darkBg dark:text-darkText dark:border-darkBorder ${validCls}`}>
                <option value="fixo">Valor fixo</option>
                <option value="percentual">% da receita</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
            </div>
          </div>
          {/* Valor */}
          {modo==='fixo' && (
            <div className="w-full sm:w-40">
              <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Valor Planejado</label>
              <input type="text" inputMode="decimal" placeholder="R$ 0,00" value={valorPlanejadoTexto} onChange={(e)=>{ handleValorPlanejadoChange(e); clearInvalid('valor_planejado'); }} className={`h-9 w-full text-sm rounded-lg border px-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText dark:border-darkBorder ${invalid.has('valor_planejado')?invalidCls:validCls}`} />
            </div>
          )}
          {/* Percentual */}
          {modo==='percentual' && (
            <div className="w-full sm:w-40">
              <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">% da Receita</label>
              <input type="text" inputMode="decimal" placeholder="0%" value={percentualTexto} onChange={(e)=>{ handlePercentChange(e); clearInvalid('percentual'); }} className={`h-9 w-full text-sm rounded-lg border px-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText dark:border-darkBorder ${invalid.has('percentual')?invalidCls:validCls}`} />
            </div>
          )}
{/* Salvar */}
<div className="w-full sm:w-auto sm:ml-auto self-end">
  <button
    type="submit"
    className="w-full sm:w-auto h-9 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
  >
    Salvar
  </button>
</div>
          {/* Replicar — checkbox padronizado (igual Importar & Conciliar) */}
          <div className="w-full flex items-center gap-2 mt-1">
            <label
              className="group inline-flex h-6 w-6 items-center justify-center relative cursor-pointer select-none"
              title={replicarTodosMeses ? 'Aplicar em todos os meses (ligado)' : 'Aplicar em todos os meses (desligado)'}
              aria-label="Aplicar esse valor para todos os meses"
            >
              {/* input acessível, visualmente escondido */}
              <input
                type="checkbox"
                className="sr-only peer"
                checked={replicarTodosMeses}
                onChange={e=> setReplicarTodosMeses(e.target.checked)}
              />
              {/* caixinha */}
              <span
                className="
                  absolute h-4 w-4 rounded-[4px] border border-gray-300 bg-white shadow-sm
                  transition-colors duration-150 ease-out
                  group-hover:border-blue-400
                  peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/60
                  peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white
                  peer-checked:bg-blue-600 peer-checked:border-blue-600
                  dark:border-darkBorder dark:bg-darkBg
                  dark:group-hover:border-blue-400/70
                  dark:peer-focus-visible:ring-offset-darkBg
                "
                aria-hidden="true"
              />
              {/* ícone de check sobreposto */}
              <svg
                className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </label>
            <span className="text-sm dark:text-darkText">Aplicar esse valor para todos os meses</span>
          </div>
        </form>
      </div>

      {/* ABAS */}
      <div className="shadow-md rounded-xl bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder">
{/* Tabs header */}
<div className="px-3 pt-3">
  <div className="relative">
    {/* InfoTip fixo no canto direito e acima da tabela */}
    <div className="absolute right-0 top-0 z-[60]">
      <InfoTip
        title={aba === 'categoria' ? 'Tabela por Categoria' : 'Visão Geral'}
        ariaLabel="Informações desta seção"
        width="w-80"
      >
        {aba === 'categoria' ? (
          <ul className="list-disc pl-4 space-y-1 text-sm">
            <li>Mostra o <b>planejado por categoria</b>, mês a mês.</li>
            <li>A 1ª coluna é <b>fixa</b>; role horizontalmente para ver os meses.</li>
            <li>O selo <b>%</b> indica planejamento <b>vinculado à receita</b>.</li>
            <li>A coluna destacada é o <b>mês selecionado</b>.</li>
          </ul>
        ) : (
          <ul className="list-disc pl-4 space-y-1 text-sm">
            <li><b>Planejado no ano</b>: soma mensal dos planejamentos.</li>
            <li><b>Heatmap</b>: uso do planejado por categoria (realizado ÷ planejado).</li>
            <li>Cores: azul claro &lt;70%, azul forte 70–100%, âmbar &gt;100%.</li>
          </ul>
        )}
      </InfoTip>
    </div>

    {/* Toggle centralizado — oculto no mobile */}
    <div className="hidden sm:flex items-center justify-center" data-tour="plan-tabs-toggle">
      <div className="inline-flex rounded-lg bg-gray-100 dark:bg-white/10 p-1">
        <button
          onClick={() => setAba('categoria')}
          className={
            'px-3 py-1.5 text-sm rounded-md flex items-center gap-1 ' +
            (aba === 'categoria'
              ? 'bg-white dark:bg-darkBg shadow text-blue-600'
              : 'text-gray-600 dark:text-darkText')
          }
        >
          <Layers className="w-4 h-4" /> Por Categoria
        </button>

        <button
          onClick={() => setAba('geral')}
          className={
            'px-3 py-1.5 text-sm rounded-md flex items-center gap-1 ' +
            (aba === 'geral'
              ? 'bg-white dark:bg-darkBg shadow text-blue-600'
              : 'text-gray-600 dark:text-darkText')
          }
        >
          <BarChart3 className="w-4 h-4" /> Visão Geral
        </button>
      </div>
    </div>
  </div>
</div>

        {/* Conteúdo da aba */}
<div className="p-3">
  {!isMobile && aba==='geral' && (
    <VisaoGeral totaisPorMes={totaisPorMes} heatmap={heatmap} formatBRL={formatBRL} />
  )}

  {aba==='categoria' && (
    <PorCategoria
      ano={ano}
      mes={mes}
      categoriasMap={categoriasMap}
      receitasAno={receitasAno}
      totaisPorMes={totaisPorMes}
      mostrarPercentuais={mostrarPercentuais}
      setMostrarPercentuais={handleTogglePercentuais}
      colSelClass={colSelClass}
      formatBRL={formatBRL}
    />
  )}
</div>
      </div>
    </div>
  );
}

function VisaoGeral({ totaisPorMes, heatmap, formatBRL }) {
  const max = Math.max(1, ...(totaisPorMes || []));
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const categorias = Object.keys((heatmap && heatmap.porCategoria) || {});
  const [tip, setTip] = useState(null); // {x,y,cat,mes,pl,rl,pct}

  // detecta dark-mode para estilizar a tooltip
const [isDark, setIsDark] = useState(
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
);
useEffect(() => {
  const el = document.documentElement;
  const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')));
  obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  return () => obs.disconnect();
}, []);

// cor do "Realizado" na tooltip, combinando com a faixa do heatmap
const colorForPct = (pct, dark) => {
  if (!pct) return dark ? '#374151' : '#e5e7eb';        // gray-700 / gray-200
  if (pct < 70) return dark ? '#60a5fa' : '#3b82f6';    // blue-400 / blue-500
  if (pct <= 100) return '#f59e0b';                     // amber-500 (igual em ambos)
  return dark ? '#f87171' : '#ef4444';                  // red-400 / red-500
};

// Paleta por faixas (semáforo), com variantes para dark mode
const tileClass = (pct) => {
  if (!pct) return 'bg-gray-200 dark:bg-white/10';                   // sem dados

  if (pct < 70) return 'bg-blue-200 dark:bg-blue-900/50';            // <70%  (azul suave)
  if (pct <= 100) return 'bg-amber-300/80 dark:bg-amber-400/60';     // 70–100% (amarelo)
  return 'bg-red-500/70 dark:bg-red-400/70';                         // >100% (vermelho)
};

  return (
    <div className="space-y-4">
      {/* Barras totais planejados por mês */}
      <div data-tour="plan-vg-barras">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-darkText mb-2">Planejado no ano</h4>
        <div className="grid grid-cols-12 gap-2">
          {(totaisPorMes || []).map((v, i) => {
            const h = Math.max(8, (v / max) * 90);
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-full bg-gray-200 dark:bg-white/10 rounded">
                  <div className="bg-blue-600 dark:bg-blue-500 rounded" style={{ height: h + 'px' }} />
                </div>
                <span className="text-xs text-gray-600 dark:text-darkMuted">{meses[i]}</span>
                <span className="text-[10px] text-gray-500">{formatBRL(v)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Heatmap 100% largura (sem calc(), sem innerHTML) */}
      <div className="w-full" data-tour="plan-vg-heatmap">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-darkText mb-2">Uso do planejado por categoria (ano)</h4>

        {/* Cabeçalho dos meses */}
        <div className="flex items-center mb-1">
          <div className="w-64 text-xs font-medium text-gray-600 dark:text-darkMuted">Categoria</div>
          <div className="flex-1 grid grid-cols-12 gap-1 text-center text-xs text-gray-600 dark:text-darkMuted">
            {meses.map((m, i) => <div key={i}>{m}</div>)}
          </div>
        </div>

        {/* Linhas */}
        <div className="space-y-1">
          {categorias.map(cat => (
            <div key={cat} className="flex items-center hover:bg-gray-50 dark:hover:bg-white/10 rounded">
              <div className="w-64 px-1 text-xs truncate text-gray-700 dark:text-gray-300" title={cat}>
  {cat}
</div>
              <div className="flex-1 grid grid-cols-12 gap-1 py-1">
                {Array.from({ length: 12 }).map((_, j) => {
                  const m = j + 1;
                  const pt = (heatmap.porCategoria[cat] && heatmap.porCategoria[cat][m]) || { pl: 0, rl: 0 };
const pct = pt.pl > 0 ? Math.min(200, Math.round((pt.rl / pt.pl) * 100)) : 0;
const cls = tileClass(pct);

return (
  <div
    key={m}
    className={`h-5 rounded ${cls}`}
    onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, cat, mes: m, pl: pt.pl, rl: pt.rl, pct })}
    onMouseMove={(e) => setTip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : null))}
    onMouseLeave={() => setTip(null)}
  />
);
                })}
              </div>
            </div>
          ))}
        </div>

{tip && (
  <div className="fixed z-[80] pointer-events-none" style={{ left: tip.x + 12, top: tip.y + 12 }}>
    <ChartTooltip
      active
      darkMode={isDark}
      // título no padrão dos gráficos (categoria — mês · %)
      label={`${tip.cat} — ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][tip.mes - 1]} · ${tip.pct}%`}
      // dois itens: Planejado/Realizado (ambos em BRL)
      payload={[
        { name: 'Planejado', value: tip.pl, color: isDark ? '#60a5fa' : '#2563eb' },        // blue-400/600
        { name: 'Realizado', value: tip.rl, color: colorForPct(tip.pct, isDark) },
      ]}
      valueFormatter={(v) => formatBRL(v)}
    />
  </div>
)}
      </div>
    </div>
  );
}

function PorMes({ ano, mes, resumoMes, receitaMes, receitaFactor, setReceitaFactor, quickEdit, formatBRL }) {
  const receitaAjustada = (Number(receitaMes) || 0) * (Number(receitaFactor) || 1);

  // Recalcula os cards quando mexe no slider (ou chega novo resumoMes)
  const data = useMemo(() => {
    const base = (resumoMes || []).map(r => {
      const basePl = Number(r.valor_planejado) || 0;
      const pl = String(r.modo) === 'percentual' && r.percentual != null
        ? +((receitaAjustada * (Number(r.percentual) / 100)).toFixed(2))
        : basePl;

      const rl = Number(r.valor_realizado) || 0;
      const pct = pl > 0 ? Math.min(999, (rl / pl) * 100) : (rl > 0 ? 999 : 0);

      return { categoria: r.categoria, modo: r.modo, percentual: r.percentual, pl, rl, pct };
    });
    return base.sort((a, b) => b.pct - a.pct);
  }, [resumoMes, receitaAjustada]);

  return (
    <div className="space-y-4">
      {/* Controle de cenário */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-gray-700 dark:text-darkText flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-blue-600" />
          <span>Simular receita do mês:</span>
          <strong>{formatBRL(receitaAjustada)}</strong>
          <span className="text-xs text-gray-500">(base {formatBRL(receitaMes)})</span>
        </div>
        <input
          type="range"
          min="50" max="150" step="5"
          value={Math.round((receitaFactor || 1) * 100)}
          onChange={(e) => setReceitaFactor(Number(e.target.value) / 100)}
          className="w-56"
        />
        <div className="flex items-center gap-1 text-xs">
          <button type="button" className="px-2 py-1 rounded border" onClick={() => setReceitaFactor(0.8)}>−20%</button>
          <button type="button" className="px-2 py-1 rounded border" onClick={() => setReceitaFactor(1)}>Base</button>
          <button type="button" className="px-2 py-1 rounded border" onClick={() => setReceitaFactor(1.2)}>+20%</button>
        </div>
      </div>

      {/* Cartões por categoria */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map(row => (
          <div key={row.categoria} className="rounded-lg border border-gray-200 dark:border-white/10 p-3 bg-white dark:bg-darkCard hover:shadow-sm transition">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-darkText truncate" title={row.categoria}>{row.categoria}</div>
                <div className="text-xs text-gray-500 dark:text-darkMuted mt-0.5">
                  Planejado: <strong>{formatBRL(row.pl)}</strong> · Realizado: <strong>{formatBRL(row.rl)}</strong>
                  {String(row.modo) === 'percentual' && (
                    <span className="ml-2 align-middle text-[10px] px-1 rounded border border-blue-200/60 text-blue-700 bg-blue-50 dark:border-blue-400/20 dark:text-blue-300 dark:bg-blue-400/10">% receita</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => quickEdit(row.categoria, row.modo)}
                className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Editar
              </button>
            </div>

            {/* barra de progresso */}
            <div className="mt-3 h-2 rounded bg-gray-200 dark:bg-white/10 overflow-hidden">
              <div
                className={row.pct <= 100 ? 'bg-blue-600 dark:bg-blue-500' : 'bg-amber-500'}
                style={{ width: Math.min(100, row.pct) + '%', height: '8px' }}
              />
            </div>
            <div className="mt-1 text-[11px] text-gray-600 dark:text-darkMuted">
              {Math.min(999, row.pct).toFixed(0)}% do planejado
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PorCategoria({ ano, mes, categoriasMap, receitasAno, totaisPorMes, mostrarPercentuais, setMostrarPercentuais, colSelClass, formatBRL }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  return (
    <div>
      {/* Header da tabela (switch à direita) */}
      <div className="mb-2 flex items-center justify-between" data-tour="plan-tab-categoria">
        <h3 className="text-base font-semibold flex items-center gap-2 text-gray-800 dark:text-darkText">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          Planejamentos do Ano: {ano}
        </h3>
        <div className="hidden sm:flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-darkMuted">Exibir selo de % na tabela</span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input type="checkbox" checked={mostrarPercentuais} onChange={(e)=> setMostrarPercentuais(e.target.checked)} className="sr-only peer" aria-label="Exibir percentuais na tabela" />
            <span className="block w-10 h-5 rounded-full bg-gray-300 dark:bg-white/20 transition-colors peer-checked:bg-blue-600" />
            <span className="pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5" />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-gray-200 dark:border-white/10" data-tour="plan-tab-categoria-tabela">
              {/* Tabela com ScrollArea horizontal e 1ª coluna sticky sólida */}
      <ScrollArea axis="x" className="rounded-lg border border-gray-200 dark:border-white/10">
        <table className="min-w-full text-sm table-fixed">
          <thead className="sticky top-0 z-30 bg-gray-50 border-b border-gray-200
                           dark:bg-darkBorder dark:border-white/10 text-gray-800 dark:text-darkText">
            <tr>
              <th
                className="sticky left-0 z-40 p-3 text-left
                           w-[17ch] min-w-[17ch] max-w-[17ch]
                           bg-gray-50 dark:bg-darkBorder overflow-hidden whitespace-nowrap
                           border-r border-gray-200/60 dark:border-white/10
                           shadow-[inset_-10px_0_10px_-10px_rgba(0,0,0,0.35)]"
                title="Categoria"
              >
                <span className="block truncate">Categoria</span>
              </th>

              {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((mLabel, i)=> (
                <th key={i} className={`p-3 text-center ${mes === (i+1) ? colSelClass : ''}`}>{mLabel}</th>
              ))}
            </tr>
          </thead>

          <tbody className="text-gray-800 dark:text-darkText">
            {/* Receita */}
            {Array.isArray(receitasAno) && (
              <tr className="font-semibold border-t border-b border-gray-100 dark:border-white/10 bg-gray-100 dark:bg-darkBorder">
<td
  className="sticky left-0 z-[70] p-3 text-left
             w-[17ch] min-w-[17ch] max-w-[17ch] overflow-hidden whitespace-nowrap
             bg-gray-100 dark:bg-darkBorder
             border-r border-b border-gray-200/60 dark:border-white/10
             shadow-[inset_-10px_0_10px_-10px_rgba(0,0,0,0.35)]"
>
  Receita
</td>
                {receitasAno.map((v,i)=> (
                  <td key={i} className={`p-2 text-right tabular-nums ${mes === i + 1 ? colSelClass : ''}`}>
                    {formatBRL(Number(v)||0)}
                  </td>
                ))}
              </tr>
            )}

            {/* Linhas de categorias (zebra sólida e sticky sólido) */}
            {Object.entries(categoriasMap).map(([categoria, data], idx) => (
<tr
  key={categoria}
  className={`group border-t border-b border-gray-100 dark:border-white/10
              ${idx % 2 === 1 ? 'bg-gray-50 dark:bg-darkBg' : 'bg-white dark:bg-darkCard'}
              transition-none`}
>
<td
  className={`sticky left-0 z-[70] p-3 text-left
              w-[17ch] min-w-[17ch] max-w-[17ch] overflow-hidden whitespace-nowrap
              ${idx % 2 === 1 ? 'bg-gray-50 dark:bg-darkBg' : 'bg-white dark:bg-darkCard'}
              group-hover:bg-blue-50 dark:group-hover:bg-slate-800 transition-none
              bg-clip-padding
              border-r border-b border-gray-200 dark:border-white/10
              shadow-[inset_-10px_0_10px_-10px_rgba(0,0,0,0.35)]`}
  title={categoria}
>
  <span className="block truncate align-middle">{categoria}</span>
</td>

      {data.values.map((v,i)=>{
        const ePercentual = data.isPct[i] && data.pct[i]!=null;
        return (
<td
  key={i}
  className={`p-2 text-right tabular-nums ${mes === i + 1 ? colSelClass : ''} 
              group-hover:bg-blue-50 dark:group-hover:bg-slate-800 transition-none`}
>
  <span>{formatBRL(Number(v)||0)}</span>
  {mostrarPercentuais && !isMobile && ePercentual && (
    <span
      className="ml-1 align-middle text-[10px] px-1 rounded border
                 border-blue-200/60 text-blue-700 bg-blue-50
                 dark:border-blue-400/20 dark:text-blue-300 dark:bg-blue-400/10"
      title={`Planejamento em ${Number(data.pct[i]).toFixed(0)}% da receita`}
    >
      %
    </span>
  )}
</td>
        );
      })}
    </tr>
  ))}
</tbody>

          <tfoot>
<tr className="font-semibold border-t border-b border-gray-200 dark:border-white/10
               bg-gray-100 dark:bg-darkBorder text-gray-900 dark:text-darkText">
              <td
                className="sticky left-0 z-[70] p-3 text-left
                           w-[17ch] min-w-[17ch] max-w-[17ch] overflow-hidden whitespace-nowrap
                           bg-gray-100 dark:bg-darkBorder
                           border-r border-gray-200/60 dark:border-white/10
                           shadow-[inset_-10px_0_10px_-10px_rgba(0,0,0,0.35)]"
              >
                Total
              </td>
              {totaisPorMes.map((total, i)=> (
                <td key={i} className={`p-2 text-right tabular-nums ${mes === i + 1 ? colSelClass : ''}`}>
                  {formatBRL(Number(total)||0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </ScrollArea>
      </div>
    </div>
  );
}

export default Planejamento;