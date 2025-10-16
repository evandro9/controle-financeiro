// src/pages/RentabilidadeInvestimentos.jsx
import React, { useEffect, useMemo, useRef } from 'react';
import SimuladorMetas from '../components/simuladorInvestimentos/SimuladorMetas';
import { LineChart } from 'lucide-react';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getSimuladorSteps, getSimuladorMobileNoticeSteps } from '../tour/steps/simulador';
import { RequireFeature } from '../context/PlanContext.jsx';
import UpsellPremium from '../components/UpsellPremium.jsx';

export default function RentabilidadeInvestimentos() {
    // raiz onde vamos procurar inputs e tabelas para ancorar os passos
  const simRootRef = useRef(null);

  // Steps (desktop x mobile)
  const stepsSim = useMemo(() => getSimuladorSteps(), []);
  const { maybeStart: maybeStartSim } = useFirstLoginTour('simulador_v1', stepsSim);
  const stepsSimMobile = useMemo(() => getSimuladorMobileNoticeSteps(), []);
  const { maybeStart: maybeStartSimMobile } = useFirstLoginTour('simulador_mobile_v1', stepsSimMobile);

  useEffect(() => {
    const root = simRootRef.current;
    if (!root) return;
    // 1) Encontrar um contêiner que agrupe 2+ inputs: input/select/textarea
    const inputs = root.querySelectorAll('input, select, textarea');
    if (inputs.length >= 2) {
      // sobe até um ancestral que contenha >=2 inputs (o menor possível)
      let container = inputs[0].parentElement;
      while (container && container !== root) {
        const count = container.querySelectorAll('input, select, textarea').length;
        if (count >= 2) break;
        container = container.parentElement;
      }
      if (container) container.setAttribute('data-tour', 'sim-inputs');
    }
    // 2) As duas tabelas: primeira = esquerda, segunda = direita
    const tables = root.querySelectorAll('table');
    if (tables[0]) tables[0].setAttribute('data-tour', 'sim-tab-left');
    if (tables[1]) tables[1].setAttribute('data-tour', 'sim-tab-right');

    // 3) Quando os alvos existirem, iniciar o tour (desktop) ou aviso (mobile)
    const haveTargets =
      root.querySelector('[data-tour="sim-inputs"]') &&
      root.querySelector('[data-tour="sim-tab-left"]') &&
      root.querySelector('[data-tour="sim-tab-right"]');
    if (!haveTargets) return;
    const isDesktop =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(min-width: 1024px)').matches;
    const start = () => (isDesktop ? maybeStartSim() : maybeStartSimMobile());
    if ('requestAnimationFrame' in window) {
      requestAnimationFrame(() => setTimeout(start, 0));
    } else {
      setTimeout(start, 0);
    }
  }, [maybeStartSim, maybeStartSimMobile]);

  return (
    <RequireFeature feature="investimentos" fallback={<UpsellPremium title="Simulador de Investimentos" />}>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">  
      {/* Header padrão */}
      <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
        <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center justify-center sm:justify-start gap-2 text-gray-800 dark:text-darkText">
          <LineChart className="w-5 h-5 text-indigo-600" />
          Simulador de Metas de Investimento
        </h2>
        {/* Subtítulo sem limite de largura para evitar quebra desnecessária */}
        <p className="mt-1 text-sm text-gray-600 dark:text-darkMuted text-center sm:text-left">
          Projete a evolução do seu patrimônio com e sem reinvestimento. Compare prazos e aportes e veja o impacto nas metas.
        </p>
        <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      </section>

      {/* Conteúdo: uma ÚNICA moldura externa. 
          No mobile, deixamos a tipografia e paddings mais compactos via child selectors. */}
      <section
        className="
          bg-white dark:bg-darkCard rounded-xl shadow-md border border-gray-100 dark:border-darkBorder
          p-3 sm:p-6 overflow-x-auto
          text-[13px] sm:text-sm
          [&_table]:min-w-full
          [&_th]:px-2 [&_th]:py-1.5 sm:[&_th]:p-2
          [&_td]:px-2 [&_td]:py-1.5 sm:[&_td]:p-2
          [&_td]:align-middle
        "
        ref={simRootRef}
      >
        {/* pedimos ao SimuladorMetas para vir “cru”, sem moldura interna */}
        <SimuladorMetas bare />
      </section>
    </div>
    </RequireFeature>
  );
}