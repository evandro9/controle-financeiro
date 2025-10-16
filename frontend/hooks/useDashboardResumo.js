import { useEffect, useMemo, useState } from 'react';
import { fetchDashboardResumo } from '../services/dashboardApi';

export function useDashboardResumo({ ano, mes, formaPagamentoId = 'ALL', limitUltimos = 10 }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [error, setError] = useState(null);

  const key = useMemo(() => `${ano}-${mes}-${formaPagamentoId}-${limitUltimos}`, [ano, mes, formaPagamentoId, limitUltimos]);

  useEffect(() => {
    let alive = true;
    async function run() {
      setStatus('loading'); setError(null);
      try {
        const json = await fetchDashboardResumo({ ano, mes, forma_pagamento_id: formaPagamentoId, limitUltimos });
        if (!alive) return;
        setData(json);
        setStatus('success');
      } catch (err) {
        if (!alive) return;
        setError(err);
        setStatus('error');
      }
    }
    run();
    return () => { alive = false; };
  }, [key]);

  const receitasDespesasAportes = useMemo(() => (data ? [
    { nome: 'Receitas', valor: Number(data.receitasMes || 0) },
    { nome: 'Despesas', valor: Number(data.despesasMes || 0) },
    { nome: 'Aportes',  valor: Number(data.aportesPlanosMes || 0) },
  ] : []), [data]);

  const planejadoVsRealizado = useMemo(() => (data?.planejadoVsRealizado || []).map(r => ({
    categoria: r.categoria || '—',
    planejado: Number(r.planejado || 0),
    realizado: Number(r.realizado || 0),
  })), [data]);

  const gastosPorCategoria = useMemo(() => (data?.gastosPorCategoria || []).map(g => ({
    categoria: g.categoria || '—',
    total: Number(g.total || 0),
  })), [data]);

  const gastosPorFormaPgto = useMemo(() => (data?.gastosPorFormaPgto || []).map(g => ({
    forma: g.forma || '—',
    total: Number(g.total || 0),
  })), [data]);

  const cards = useMemo(() => ({
    receitas: Number(data?.receitasMes || 0),
    despesas: Number(data?.despesasMes || 0),
    saldo: Number(data?.saldoMes || 0),
    aportes: Number(data?.aportesPlanosMes || 0),
    pendentesMes: Number(data?.pendentesMes || 0),
    vencidos: Number(data?.vencidos || 0),
  }), [data]);

  return {
    status,
    error,
    data,
    cards,
    receitasDespesasAportes,
    planejadoVsRealizado,
    gastosPorCategoria,
    gastosPorFormaPgto,
    ultimosLancamentos: data?.ultimosLancamentos || [],
  };
}