// Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFeature } from '../context/PlanContext.jsx';
// breakpoint lg: 1024px (usado para decidir comportamento mobile x desktop)
import {
  LayoutDashboard, BarChart, Target, DollarSign, List, Settings, TrendingUp, LineChart, Gauge,
  Goal, LogOut, ChevronLeft, ChevronRight, ClipboardList, PieChart, SlidersHorizontal, Wallet, Landmark, Upload
} from 'lucide-react';

export default function Sidebar({ onSair, modoUso, onRequestClose }) {
  // Lê entitlements (via PlanContext)
 const isPremium = useFeature('premium');
 const hasInvestimentos = useFeature('investimentos');
 const liberarInvestimentos = hasInvestimentos || isPremium;
  const location = useLocation();
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    const salvo = localStorage.getItem('sidebarAberto');
    if (salvo !== null) {
      setAberto(salvo === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarAberto', aberto.toString());
  }, [aberto]);

  const isActive = (path) => location.pathname.includes(path);
  console.log('Dashboard recebeu modoUso:', modoUso);

  // Ao clicar na seta do topo:
  // - Desktop (>= lg): alterna entre aberto/compacto (ícones).
  // - Mobile (< lg): pede pro AppShell fechar o drawer (sem mexer no "aberto").
  const handleTopArrowClick = () => {
    const isDesktop = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      setAberto(prev => !prev);
    } else {
      if (typeof onRequestClose === 'function') onRequestClose(); // mobile: fecha o drawer
    }
  };

  return (
    <aside
      data-tour="sidebar-menu"
      data-open={aberto ? 'true' : 'false'}
      className={`transition-all duration-300
        bg-white dark:bg-darkCard
        border-gray-200 dark:border-darkBorder
        ${aberto ? 'w-full lg:w-64 lg:border-r' : 'w-full lg:w-16 lg:border-r-0'}
        flex lg:flex  /* mobile: sempre visível dentro do drawer; desktop: sempre visível */
        flex-col h-full lg:h-dvh lg:sticky lg:top-0 lg:shadow-sm
      `}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-darkBorder">
        {aberto ? (
<div className="flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-darkText">
  <LayoutDashboard size={20} className="text-gray-800 dark:text-darkText" />
  <span className="truncate">Dashboard</span>
</div>
        ) : (
          <LayoutDashboard size={24} className="text-gray-700 mx-auto" />
        )}
        <button
          onClick={handleTopArrowClick}
          data-tour="sidebar-toggle"
          aria-label={aberto ? 'Recolher menu' : 'Expandir menu'}
        >
          {aberto ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

<nav className="flex-1 overflow-y-auto p-3 text-sm space-y-6">
        <Section title="Dashboard" icon={<Gauge size={14} />} aberto={aberto}>
          <Item to="/dashboard/balanco" label="Balanço Mensal" icon={<BarChart size={16} />} aberto={aberto} />
          <Item to="/dashboard/planos" label="Planos e Metas" icon={<Target size={16} />} aberto={aberto} />
          <Item to="/dashboard/analises" label="Análises de Despesas" icon={<PieChart size={16} />} aberto={aberto} />
          {liberarInvestimentos && (
            <Item to="/dashboard/investimentos" label="Painel de Investimentos" icon={<DollarSign size={16} />} aberto={aberto} />
          )}
        </Section>

        <Section title="Controle Financeiro" icon={<Settings size={14} />} aberto={aberto}>
  <Item to="/dashboard/planejamento" label="Planejamento Financeiro" icon={<ClipboardList size={16} />} aberto={aberto} />
  <Item to="/dashboard/lancamentos" label="Movimentações Financeiras" icon={<List size={16} />} aberto={aberto} />
  <Item to="/dashboard/importacoes" label="Importar & Conciliar" icon={<Upload size={16} />} aberto={aberto} />
        </Section>

        {liberarInvestimentos && (
          <Section title="Investimentos" icon={<TrendingUp size={14} />} aberto={aberto}>
            <Item to="/dashboard/meus-investimentos" label="Meus Investimentos" icon={<DollarSign size={16} />} aberto={aberto} />
            <Item to="/dashboard/rebalanceamento" label="Rebalanceamento" icon={<SlidersHorizontal size={16} />} aberto={aberto} />
            <Item to="/dashboard/rentabilidade"label="Simulador de Investimentos"icon={<LineChart size={16} />}aberto={aberto}/>
            {/* <Link to="/investimentos/rentabilidade" className="flex items-center gap-2 p-2 hover:bg-zinc-800 rounded-md"><LineChart size={20} /><span>Rentabilidade</span></Link> */}
          </Section>
        
        )}
          <Section title="Patrimônio" icon={<Landmark size={14} />} aberto={aberto}>
            <Item to="/dashboard/patrimonio" label="Meu Patrimônio" icon={<Wallet size={16} />} aberto={aberto} />
          </Section>
        
      </nav>
    </aside>
  );
}

function Section({ title, icon, children, aberto }) {
  return (
    <div className="mb-2">
      {aberto && (
        <div className="flex items-center gap-1 text-gray-500 text-xs uppercase mb-1 font-semibold">
          {icon && <span>{icon}</span>}
          {title}
        </div>
      )}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Item({ to, label, icon, aberto }) {
  const location = useLocation();
  return (
    <Link to={to} className="relative group">
<div
  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all ${
    location.pathname.includes(to)
      ? 'bg-blue-100 text-blue-600 font-medium dark:bg-blue-900/60 dark:text-blue-300'
      : 'text-gray-700 hover:bg-gray-100 dark:text-darkText dark:hover:bg-darkBorder'
  }`}
        title={!aberto ? label : ''}
      >
        {icon}
        {aberto && <span>{label}</span>}
      </div>
    </Link>
  );
}