import React, { useEffect, useState } from 'react';
import { CreditCard, AlarmClock, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import InfoTip from '../ui/InfoTip';

const formatar = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CardsResumoLancamentos({ ano, mes, formaPagamentoId, msg }) {
  const [pendenteMes, setPendenteMes] = useState(0);
  const [vencidos, setVencidos] = useState(0);
  const [pendenteTotal, setPendenteTotal] = useState(0);
  const [despesaTotal, setDespesaTotal] = useState(0);

  useEffect(() => { 
    const token = localStorage.getItem('token');

    fetch(`/api/lancamentos/pendentes-mes?ano=${ano}&mes=${mes}${formaPagamentoId !== 'todas' ? `&forma_pagamento_id=${formaPagamentoId}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setPendenteMes(data.total || 0));

    fetch(`/api/lancamentos/vencidos-contagem?ano=${ano}&mes=${String(mes).padStart(2, '0')}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setVencidos(data.total || 0));

    fetch(`/api/lancamentos/pendentes-todos`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setPendenteTotal(data.total || 0));

    fetch(`/api/lancamentos/total-despesas?ano=${ano}&mes=${String(mes).padStart(2, '0')}${formaPagamentoId !== 'todas' ? `&forma_pagamento_id=${formaPagamentoId}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setDespesaTotal(data.total || 0));
  }, [ano, mes, formaPagamentoId, msg]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 text-sm">
      {/* Card Despesas */}
      <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-4 flex items-center gap-4 border-l-4 border-orange-400">
        <div className="absolute top-0 right-0">
          <InfoTip ariaLabel="Informações do card">
            <p>Soma total das despesas do mês/forma de pagamento selecionados.</p>
          </InfoTip>
        </div>
        <ArrowUpCircle className="text-orange-500" />
        <div>
          <p className="text-gray-500 dark:text-darkMuted">Despesas</p>
          <p className="text-orange-700 dark:text-orange-400 font-semibold">{formatar(despesaTotal)}</p>
        </div>
      </div>

      {/* Card À Pagar (Mês) */}
      <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-4 flex items-center gap-4 border-l-4 border-orange-400">
        <div className="absolute top-0 right-0">
          <InfoTip ariaLabel="Informações do card">
            <p>Soma das despesas pendentes com vencimento no mês e forma de pagamento selecionados.</p>
          </InfoTip>
        </div>
        <CreditCard className="text-yellow-500" />
        <div>
          <p className="text-gray-500 dark:text-darkMuted">À Pagar (Mês)</p>
          <p className="text-yellow-700 dark:text-yellow-400 font-semibold">{formatar(pendenteMes)}</p>
        </div>
      </div>

      {/* Card Vencidos */}
      <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-4 flex items-center gap-4 border-l-4 border-orange-400">
        <div className="absolute top-0 right-0">
          <InfoTip ariaLabel="Informações do card">
            <p>Soma das despesas pendentes com vencimento anterior à data atual.</p>
          </InfoTip>
        </div>
        <AlarmClock className="text-red-500" />
        <div>
          <p className="text-gray-500 dark:text-darkMuted">Vencidos</p>
          <p className="text-red-700 dark:text-red-400 font-semibold">{formatar(vencidos)}</p>
        </div>
      </div>

      {/* Card À Pagar (Total) */}
      <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-4 flex items-center gap-4 border-l-4 border-orange-400">
        <div className="absolute top-0 right-0">
          <InfoTip ariaLabel="Informações do card">
            <p>Soma de todas as despesas pendentes, independentemente do mês ou forma de pagamento.</p>
          </InfoTip>
        </div>
        <AlertTriangle className="text-amber-600" />
        <div>
          <p className="text-gray-500 dark:text-darkMuted">À Pagar (Total)</p>
          <p className="text-amber-700 dark:text-amber-400 font-semibold">{formatar(pendenteTotal)}</p>
        </div>
      </div>
    </div>
  );
}