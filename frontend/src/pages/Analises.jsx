import React, { useState, useEffect, useMemo } from 'react';
import { BarChart2, ChevronDown } from 'lucide-react';
import GraficoLinhaCategorias from '../components/analises/GraficoLinhaCategorias';
import GraficoBarrasSubcategorias from '../components/analises/GraficoBarrasSubcategorias';
import GraficoPizzaDistribuicao from '../components/analises/GraficoPizzaDistribuicao';
import TabelaResumoAnalises from '../components/analises/TabelaResumoAnalises';
import AnaliseRecorrencia from '../components/analises/AnaliseRecorrencia';
import GraficoBarrasReceitaDespesa from '../components/analises/GraficoBarrasReceitaDespesa';
import GraficoRadarHabitos from "../components/analises/GraficoRadarHabitos";
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getAnalisesSteps, getAnalisesMobileNoticeSteps } from '../tour/steps/analises';

function Analises() {
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [mesInicio, setMesInicio] = useState(1);
  const [mesFim, setMesFim] = useState(new Date().getMonth() + 1);
  const [categoria, setCategoria] = useState('');
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const currentYear = new Date().getFullYear();
  const ANOS = Array.from({ length: 10 }, (_, i) => currentYear - 3 + i);
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  // Tour "Análises"
  // Desktop: tour completo; Mobile: aviso único
  const stepsAnalises = useMemo(() => getAnalisesSteps(), []);
  const { maybeStart: maybeStartAnalises } = useFirstLoginTour('analises_v1', stepsAnalises);
  const stepsAnalisesMobile = useMemo(() => getAnalisesMobileNoticeSteps(), []);
  const { maybeStart: maybeStartAnalisesMobile } = useFirstLoginTour('analises_mobile_v1', stepsAnalisesMobile);

  useEffect(() => {
    setDadosCarregados(false);
    // fetchDados();
  }, [anoSelecionado, mesInicio, mesFim, categoria]);

  // Dispara o tour desta página:
  // - Desktop (>= lg): tour completo
  // - Mobile  (< lg): apenas aviso (1 passo)
  useEffect(() => {
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 1024px)').matches; // >= lg
    if (isDesktop) {
      maybeStartAnalises();
    } else {
      maybeStartAnalisesMobile();
    }
  }, [maybeStartAnalises, maybeStartAnalisesMobile]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header e filtros */}
      <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md space-y-3 border border-gray-100 dark:border-darkBorder">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-darkText flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-indigo-600" />
          Análise de Despesas
        </h2>
        <p className="text-left text-sm text-gray-600 dark:text-darkMuted">
          Explore seus padrões de despesa mês a mês por categoria e subcategoria.
        </p>

               {/* barra de fora a fora */}
        <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      </section>

            {/* Filtros (card separado, padrão "Filtros:" + componentes) */}
      <section className="hidden sm:block bg-white dark:bg-darkCard rounded-xl shadow px-3 py-4 w-auto border border-gray-100 dark:border-darkBorder" data-tour="analises-filtros">
        <div className="flex items-center gap-4">
          <span className="self-center text-sm font-medium text-gray-600 dark:text-darkText">Filtros:</span>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1">
            {/* Ano */}
            <div className="min-w-[140px]">
              <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Ano</label>
              <div className="relative">
                <select
                  value={anoSelecionado}
                  onChange={(e) => setAnoSelecionado(parseInt(e.target.value))}
                  className="h-9 w-full appearance-none rounded-lg border bg-white px-2 pr-7
                             text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                             dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
                >
                  {ANOS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
              </div>
            </div>

            {/* Mês início */}
            <div className="min-w-[180px]">
              <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">De</label>
              <div className="relative">
                <select
                  value={mesInicio}
                  onChange={(e) => setMesInicio(parseInt(e.target.value))}
                  className="h-9 w-full appearance-none rounded-lg border bg-white px-2 pr-7
                             text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                             dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
                >
                  {MESES.map((nome, i) => <option key={i+1} value={i+1}>{nome}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
              </div>
            </div>

            {/* Mês fim */}
            <div className="min-w-[180px]">
              <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Até</label>
              <div className="relative">
                <select
                  value={mesFim}
                  onChange={(e) => setMesFim(parseInt(e.target.value))}
                  className="h-9 w-full appearance-none rounded-lg border bg-white px-2 pr-7
                             text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                             dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
                >
                  {MESES.map((nome, i) => <option key={i+1} value={i+1}>{nome}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
              </div>
            </div>

            {/* Categoria (texto) */}
            <div className="min-w-[220px]">
              <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Categoria</label>
              <input
                type="text"
                placeholder="(opcional)"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-9 w-full rounded-lg border bg-white px-2 text-sm text-gray-700
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
              />
            </div>
          </div>
        </div>
      </section>

 {/* MOBILE ONLY: aviso curto sugerindo o desktop para análise completa */}
 <section className="sm:hidden bg-white dark:bg-darkCard rounded-xl shadow px-3 py-3 border border-gray-100 dark:border-darkBorder" data-tour="analises-mobile-aviso">
   <p className="text-sm text-gray-600 dark:text-darkMuted">
     A tela de <b>Análises</b> é acessível <b>somente no desktop</b> para acompanhar todos os detalhes
     (gráficos, tabelas, recorrência e comparativos). Use um computador para visualizar.
   </p>
 </section>

      {/* Área dos gráficos */}
      <section className="space-y-4 sm:space-y-6">
        {/* Gráfico 1: Linha por categoria */}
        <div className="hidden sm:block bg-white dark:bg-darkCard p-4 rounded-xl shadow border border-gray-100 dark:border-darkBorder" data-tour="analises-linha-categorias">
          <GraficoLinhaCategorias
            ano={anoSelecionado}
            mesInicio={mesInicio}
            mesFim={mesFim}
            categoria={categoria}
          />
        </div>

        {/* Gráfico 2: Barras por subcategoria */}
        <div className="hidden sm:block bg-white dark:bg-darkCard p-4 rounded-xl shadow border border-gray-100 dark:border-darkBorder" data-tour="analises-barras-subcategorias">
          <GraficoBarrasSubcategorias
            ano={anoSelecionado}
            mesInicio={mesInicio}
            mesFim={mesFim}
            categoria={categoria}
          />
        </div>

        {/* Gráfico 3: Distribuição total */}
        <div className="hidden sm:block bg-white dark:bg-darkCard p-4 rounded-xl shadow border border-gray-100 dark:border-darkBorder" data-tour="analises-pizza-distribuicao">
          <GraficoPizzaDistribuicao
            ano={anoSelecionado}
            mesInicio={mesInicio}
            mesFim={mesFim}
            categoria={categoria}
          />
        </div>

        {/* RECEITAS x DESPESAS (barras lado a lado / anual) */}
<div className="hidden sm:block bg-white dark:bg-darkCard p-4 rounded-xl shadow border border-gray-100 dark:border-darkBorder" data-tour="analises-barras-recdesp">
  <GraficoBarrasReceitaDespesa
    ano={anoSelecionado}
    mesInicio={mesInicio}
    mesFim={mesFim}
  />
</div>

        {/* Tabela Resumo Comparativa */}
        <div className="hidden sm:block bg-white dark:bg-darkCard p-4 rounded-xl shadow border border-gray-100 dark:border-darkBorder" data-tour="analises-tabela-resumo">  
          <TabelaResumoAnalises
            ano={anoSelecionado}
            mesInicio={mesInicio}
            mesFim={mesFim}
          />
        </div>

      <div className="hidden sm:block bg-white dark:bg-darkCard p-4 rounded-xl shadow border border-gray-100 dark:border-darkBorder h-[400px]" data-tour="analises-radar-habitos">
   <GraficoRadarHabitos
     ano={anoSelecionado}
     mesInicio={mesInicio}
     mesFim={mesFim}
     normalizacao="max"
   />
 </div>

      <div className="hidden sm:block" data-tour="analises-recorrencia">
        <AnaliseRecorrencia ano={anoSelecionado} mesInicio={mesInicio} mesFim={mesFim} />
      </div>

      </section>
    </div>
  );
}

export default Analises;