import React, { useState, useEffect } from 'react';
import GraficoLinhaMensal from '../components/balanco/GraficoLinhaMensal';
import GraficoPlanejamento from '../components/balanco/GraficoPlanejamento';
import GraficoPorCategoria from '../components/balanco/GraficoPorCategoria';
import FiltroPeriodo from '../components/FiltroPeriodo';
import { ArrowDownCircle, ArrowUpCircle, Wallet, CreditCard, AlarmClock, AlertTriangle, BarChart2, ChevronDown } from 'lucide-react';
import GraficoFormasPgto from '../components/balanco/GraficoFormasPgto';
import { useDashboardResumo } from '../../hooks/useDashboardResumo';
import ComparadorPeriodos from '../components/balanco/ComparadorPeriodos';
import GraficoCalendarioHeatmap from '../components/balanco/GraficoCalendarioHeatmap';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getBalancoSteps, getBalancoMobileNoticeSteps } from '../tour/steps/balanco';
import { useMemo } from 'react';

function HeaderBalanco({ ano, setAno, mes, setMes, mesesDisponiveis, anosDisponiveis, semDados }) {
  const [pendenteTotal, setPendenteTotal] = useState(0);
  const [vencidos, setVencidos] = useState([]);
  const [avisosInvestimentos, setAvisosInvestimentos] = useState([]);
  const [categoriasEstouradas, setCategoriasEstouradas] = useState([]);
  const [ocultarAvisoVencidos, setOcultarAvisoVencidos] = useState(false);
  const [ocultarAvisoEstouro, setOcultarAvisoEstouro] = useState(false);

  // 🔗 agregador
  const { status, cards, planejadoVsRealizado } = useDashboardResumo({
    ano,
    mes,
    formaPagamentoId: 'ALL',
    limitUltimos: 10
  });

  const resumo = {
    receita: Number(cards?.receitas || 0),
    despesa: Number(cards?.despesas || 0),
  };
  const pendenteMes = Number(cards?.pendentesMes || 0);
  const saldo = resumo.receita - resumo.despesa;
  const formatar = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // ⚠️ categorias estouradas usando o que já veio do agregador
  useEffect(() => {
    const estouradas = (planejadoVsRealizado || []).filter(
      (cat) => Number(cat.planejado) > 0 && Number(cat.realizado) > Number(cat.planejado)
    );
    setCategoriasEstouradas(estouradas);
  }, [planejadoVsRealizado]);

  useEffect(() => {
    const token = localStorage.getItem('token');

      // Essa rota fica normalmente
    fetch(`/api/lancamentos/pendentes-todos`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setPendenteTotal(data.total))
      .catch(() => console.warn('Erro ao buscar pendentes totais'));

      // Essa fica normalmente
      fetch('/api/investimentos/pendencias', {
  headers: { Authorization: `Bearer ${token}` }
})
  .then(res => res.json())
  .then(data => setAvisosInvestimentos(data.mensagens || ["⚠️ Mensagem de teste visível?"]))
  .catch(() => console.warn('Erro ao verificar pendências de investimentos'));

  // Busca lançamentos vencidos
  fetch(`/api/lancamentos/vencidos`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => {
      if (!res.ok) throw new Error('Erro ao buscar vencidos');
      return res.json();
    })
    .then(setVencidos)
    .catch(() => console.error('Erro ao buscar lançamentos vencidos'));

  }, [ano, mes]);


  return (
 <div className="max-w-6xl mx-auto py-4">
  {/* Título + subtítulo (mesma margem lateral dos cards no mobile) */}
  <div className="mb-4">
    <div className="p-4 sm:p-5 shadow-md rounded-xl border border-gray-100 dark:border-darkBorder bg-white dark:bg-darkCard">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-end gap-3">
        {/* Título e subtítulo */}
       <div className="text-left sm:max-w-[70%]">
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-gray-800 dark:text-darkText">
    <BarChart2 className="w-5 h-5 text-purple-600" />
    Balanço Mensal
  </h2>

          {/* Subtítulo curto no mobile; completo no desktop */}
          <p className="sm:hidden text-xs text-gray-500 dark:text-darkMuted">
            Resumo do mês selecionado.
          </p>
          <p className="hidden sm:block text-sm text-gray-500 dark:text-darkMuted">
            Confira o resumo do mês selecionado com gráficos interativos de receitas, despesas, planejamento, categorias e formas de pagamento.
          </p>
</div>

        <div
        data-tour="balanco-filtro"
          className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-end sm:gap-3
                     [&_select]:w-full
                     [&_select]:h-12 [&_select]:text-base [&_select]:rounded-xl [&_select]:px-3
                     [&_select]:border [&_select]:bg-card [&_select]:appearance-none
                     sm:[&_select]:h-9 sm:[&_select]:text-sm sm:[&_select]:rounded-lg"
        >
        {/* Ano */}
        <div className="flex flex-col min-w-[88px]">
          <label className="text-center text-xs text-gray-500 dark:text-darkMuted mb-1">Ano</label>
          <div className="relative">
            <select
              value={ano}
              onChange={(e) => setAno(parseInt(e.target.value))}
              disabled={anosDisponiveis.length === 0}
              className="h-9 w-full appearance-none rounded-lg border bg-white px-2 pr-7 text-sm
                         text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none
                         dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
            >
              {anosDisponiveis.length === 0 ? (
                <option>—</option>
              ) : (
                anosDisponiveis.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4
                                     text-gray-400 dark:text-darkMuted" />
          </div>
        </div>

        {/* Mês */}
        <div className="flex flex-col min-w-[130px]">
          <label className="text-center text-xs text-gray-500 dark:text-darkMuted mb-1">Mês</label>
          <div className="relative">
            <select
              value={mes}
              onChange={(e) => setMes(parseInt(e.target.value))}
              disabled={mesesDisponiveis.length === 0}
              className="h-9 w-full appearance-none rounded-lg border bg-white px-2 pr-7 text-sm
                         text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none
                         dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
            >
              {mesesDisponiveis.length === 0 ? (
                <option>—</option>
              ) : (
                mesesDisponiveis.map((m) => {
                  const nome = new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' });
                  const label = nome.charAt(0).toUpperCase() + nome.slice(1);
                  return <option key={m} value={m}>{label}</option>;
                })
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4
                                     text-gray-400 dark:text-darkMuted" />
          </div>
        </div>
      </div>
    </div>

      {/* Divisor só no desktop para economizar altura no mobile */}
      <div className="hidden sm:block mt-4 h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
  </div>
</div>

        {/* Linha 1 - cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-sm" data-tour="balanco-cards">
        <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 flex items-center gap-4 border-l-4 border-blue-400">
          <ArrowDownCircle className="text-blue-500" />
          <div>
            <p className="text-gray-500 dark:text-darkMuted">Receita</p>
 <p className="text-blue-700 font-semibold dark:text-blue-400">
   {semDados ? '—' : formatar(resumo.receita)}
 </p>
          </div>
        </div>

        <div className="bg-white dark:bg-darkCard rounded-xl shadow p-4 flex items-center gap-4 border-l-4 border-orange-400">
          <ArrowUpCircle className="text-orange-500" />
 <div>
   <p className="text-gray-500 dark:text-darkMuted">Despesas</p>
   <p className="text-orange-700 font-semibold dark:text-orange-400">
     {semDados ? '—' : formatar(resumo.despesa)}
   </p>
 </div>
        </div>

        <div className={`bg-white dark:bg-darkCard rounded-xl shadow p-4 flex items-center gap-4 border-l-4 ${saldo >= 0 ? 'border-green-400' : 'border-red-400'}`}>
          <Wallet className={saldo >= 0 ? 'text-green-600' : 'text-red-600'} />
          <div>
            <p className="text-gray-500 dark:text-darkMuted">Saldo</p>
 <p
   className={`font-semibold ${
     semDados
       ? 'text-gray-500 dark:text-darkMuted'
       : saldo >= 0
         ? 'text-green-700 dark:text-green-400'
         : 'text-red-700 dark:text-red-400'
   }`}
 >
   {semDados ? '—' : formatar(saldo)}
 </p>
          </div>
        </div>
      </div>

      {vencidos.length > 0 && !ocultarAvisoVencidos && (
        <div className="bg-red-100 dark:bg-red-950 border-l-4 border-red-500 dark:border-red-400 text-red-800 dark:text-red-200 p-4 mb-6 rounded-lg shadow max-w-6xl mx-auto relative">
          <button onClick={() => setOcultarAvisoVencidos(true)} className="absolute top-2 right-3 text-red-600 hover:text-red-800 text-lg font-bold" title="Fechar aviso">×</button>
          <p className="font-semibold mb-2 flex items-center justify-center gap-2">
            <AlertTriangle className="inline w-5 h-5 text-red-700 dark:text-red-300" />
            Lançamentos vencidos: você possui {vencidos.length} lançamentos pendentes com vencimento anterior a hoje.
          </p>
          <p className="text-center text-sm text-red-700 dark:text-red-300">
            Acesse a tela de <strong>Movimentações Financeiras</strong> para mais detalhes e ações.
          </p>
        </div>
      )}

{categoriasEstouradas.length > 0 && !ocultarAvisoEstouro && (
<div className="bg-yellow-100 dark:bg-yellow-950 border-l-4 border-yellow-500 dark:border-yellow-400 text-yellow-800 dark:text-yellow-200 p-4 rounded-lg shadow max-w-6xl mx-auto relative">
          <button onClick={() => setOcultarAvisoEstouro(true)} className="absolute top-2 right-3 text-yellow-600 hover:text-yellow-800 text-lg font-bold" title="Fechar aviso">×</button>
          <p className="font-semibold mb-2 flex items-center justify-center gap-2">
            <AlertTriangle className="inline w-5 h-5 text-yellow-700 dark:text-yellow-300" />
            Gastos acima do planejado:
          </p>
          <ul className="text-sm list-disc ml-5">
            {categoriasEstouradas.map(cat => (
              <li key={cat.categoria}>
                {cat.categoria}: planejado {Number(cat.planejado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, realizado {Number(cat.realizado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Balanco() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [mesesDisponiveis, setMesesDisponiveis] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [semDados, setSemDados] = useState(false);
  // Tour "Balanço"
  // Desktop: tour completo; Mobile: aviso único
  const stepsBalanco = useMemo(() => getBalancoSteps(), []);
  const { maybeStart: maybeStartBalanco } = useFirstLoginTour('balanco_v1', stepsBalanco);
  const stepsBalancoMobile = useMemo(() => getBalancoMobileNoticeSteps(), []);
  const { maybeStart: maybeStartBalancoMobile } = useFirstLoginTour('balanco_mobile_v1', stepsBalancoMobile);

    // Carrega ANOS disponíveis
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`/api/lancamentos/anos-disponiveis`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(anos => {
        setAnosDisponiveis(anos);
        if (anos.length === 0) {
          setSemDados(true);
          setMesesDisponiveis([]);
        } else {
          setSemDados(false);
          // garante ano válido
          if (!anos.includes(ano)) setAno(anos[0]);
        }
      })
      .catch(() => {
        setSemDados(true);
        setAnosDisponiveis([]);
        setMesesDisponiveis([]);
      });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth() + 1;

    fetch(`/api/lancamentos/meses-disponiveis?ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(meses => {
        const ordenados = [...meses].sort((a, b) => a - b);
        setMesesDisponiveis(ordenados);
        if (ordenados.length > 0) {
          if (ano === anoAtual && ordenados.includes(mesAtual)) {
            setMes(mesAtual);
          } else {
            setMes(ordenados[0]);
          }
          setSemDados(false);
        } else {
          setSemDados(true);
        }
      })
      .catch(() => alert('Erro ao carregar meses disponíveis'));
  }, [ano]);

  // Dispara o tour do Balanço nesta página:
  // - Desktop (>= lg): tour completo
  // - Mobile  (< lg): apenas aviso (1 passo)
  useEffect(() => {
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 1024px)').matches; // >= lg
    if (isDesktop) {
      maybeStartBalanco();
    } else {
      maybeStartBalancoMobile();
    }
  }, [maybeStartBalanco, maybeStartBalancoMobile]);

  return (
    <div className="max-w-6xl mx-auto">
      <HeaderBalanco
        ano={ano}
        setAno={setAno}
        mes={mes}
        setMes={setMes}
        mesesDisponiveis={mesesDisponiveis}
        anosDisponiveis={anosDisponiveis}
        semDados={semDados}
      />

      {/* Linha 1: no desktop ficam 2 painéis; no mobile mostramos SÓ LinhaMensal */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-darkCard rounded-xl shadow p-6 border border-gray-100 dark:border-darkBorder h-[400px] overflow-hidden flex flex-col" data-tour="balanco-grafico-linha">
          <GraficoLinhaMensal ano={ano} />
        </div>
        <div className="bg-white dark:bg-darkCard rounded-xl shadow p-6 border border-gray-100 dark:border-darkBorder h-[400px] flex flex-col" data-tour="balanco-grafico-planejamento">
          <GraficoPlanejamento ano={ano} mes={mes} />
        </div>
      </div>

      {/* LinhaMensal no mobile (mesma margem lateral dos cards) */}
      <div className="lg:hidden mb-4">
        <div className="bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder rounded-xl p-4 h-[260px]">

          <GraficoLinhaMensal ano={ano} />
        </div>
      </div>

      {/* Linha 2: essencial em ambas; no mobile empilha com UMA borda (do próprio componente) */}
      <div className="mt-6 lg:flex lg:gap-4">
        {/* mobile (sem wrapper com borda/padding) */}
        <div className="lg:hidden space-y-4">
          <div className="h-[260px]">
            <GraficoPorCategoria ano={ano} mes={mes} maxCategorias={6} />
          </div>
          <div className="h-[220px]">
            <GraficoFormasPgto ano={ano} mes={mes} maxItens={4} />
          </div>
        </div>
        {/* desktop */}
        <div className="hidden lg:block lg:w-[65%] lg:h-[400px]" data-tour="balanco-grafico-categorias">
          <GraficoPorCategoria ano={ano} mes={mes} />
        </div>
        <div className="hidden lg:block lg:w-[35%] lg:h-[400px]" data-tour="balanco-grafico-formas">
          <GraficoFormasPgto ano={ano} mes={mes} />
        </div>
      </div>

      {/* Heatmap: desktop-only */}
      <div className="mt-6 hidden lg:block">
        <div className="bg-white dark:bg-darkCard rounded-xl shadow p-6 border border-gray-100 dark:border-darkBorder h-[400px] flex flex-col" data-tour="balanco-heatmap">
          <GraficoCalendarioHeatmap ano={ano} mes={mes} />
        </div>
      </div>

      {/* Comparador: desktop-only */}
      <div className="mt-6 hidden lg:block" data-tour="balanco-comparador">
        <ComparadorPeriodos ano={ano} mes={mes} />
      </div>
    </div>
  );
}

export default Balanco;