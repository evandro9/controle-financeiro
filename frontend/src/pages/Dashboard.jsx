import React from 'react';
import Balanco from './Balanco';
import PlanosMetas from './PlanosMetas';
import InvestimentosResumo from './InvestimentosResumo';
import Planejamento from './Planejamento';
import Lancamentos from './Lancamentos';
import Analises from './Analises';
import MeusInvestimentos from './MeusInvestimentos';
import Rebalanceamento from './Rebalanceamento';
import SimuladorInvestimentos from "./SimuladorInvestimentos"
import MeuPatrimonio from './MeuPatrimonio';
import ImportarConciliar from './ImportarConciliar';
import { Link, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import useFirstLoginTour from '../hooks/useFirstLoginTour';
import { getDashboardSteps, getDashboardMobileNoticeSteps } from '../tour/steps/dashboard';

function Dashboard({ modoUso }) {
  // Steps variam: desktop foca a sidebar aberta; mobile foca o botão de toggle.
  const steps = useMemo(() => getDashboardSteps(), []);
  const { maybeStart: maybeStartDashboard } = useFirstLoginTour('dashboard_v1', steps);
  // Aviso único no mobile (1 passo só)
  const stepsMobile = useMemo(() => getDashboardMobileNoticeSteps(), []);
  const { maybeStart: maybeStartDashboardMobile } = useFirstLoginTour('dashboard_mobile_v1', stepsMobile);
  const navigate = useNavigate();
  const location = useLocation();
  const nome = localStorage.getItem('usuario');

  function sair() {
    localStorage.clear();
    window.location.href = '/';
  }

  useEffect(() => {
    // dispara o tour da Dashboard SOMENTE quando a URL for exatamente /dashboard
    const p = (location.pathname || '').replace(/\/+$/, ''); // remove barra(s) finais
    if (p === '/dashboard') {
      const isDesktop = typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(min-width: 1024px)').matches; // >= lg
      if (isDesktop) {
        // Desktop: tour completo
        maybeStartDashboard();
      } else {
        // Mobile: apenas aviso (1 passo)
        maybeStartDashboardMobile();
      }
    }
  }, [location.pathname, maybeStartDashboard, maybeStartDashboardMobile]);

  return (
    <div className="py-0">
      <div className="space-y-4 sm:space-y-6">
        <Routes>
        <Route path="/balanco" element={<Balanco />} />
        <Route path="/planos" element={<PlanosMetas />} />
        <Route path="/investimentos" element={<InvestimentosResumo />} />
        <Route path="/planejamento" element={<Planejamento />} />
        <Route path="/lancamentos" element={<Lancamentos />} />
        <Route path="/analises" element={<Analises />} />
        <Route path="/meus-investimentos" element={<MeusInvestimentos />} />
        <Route path="/rebalanceamento" element={<Rebalanceamento />} />
        <Route path="/rentabilidade" element={<SimuladorInvestimentos />} />
        <Route path="/patrimonio" element={<MeuPatrimonio />} />
        <Route path="/importacoes" element={<ImportarConciliar />} />
      </Routes>
      </div>
    </div>
  );
}

export default Dashboard;
