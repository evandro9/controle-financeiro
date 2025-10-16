import React from 'react';
import { ChevronDown } from 'lucide-react';

function FiltroLancamentos({
  ano, setAno, mes, setMes, quantidade, setQuantidade,
  status, setStatus, formaPagamentoSelecionada, setFormaPagamentoSelecionada, formasPagamento,
  ordenarPor, setOrdenarPor, ordem, setOrdem
}) {

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const currentYear = new Date().getFullYear();
  const ANOS = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-sm w-full">
      {/* Ano */}
      <div className="w-full">
        <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Ano</label>
        <div className="relative">
          <select
            value={ano}
            onChange={(e) => setAno(parseInt(e.target.value))}
            className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                       text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            {ANOS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
        </div>
      </div>

      {/* Mês */}
      <div className="w-full">
        <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Mês</label>
        <div className="relative">
          <select
            value={mes}
            onChange={(e) => setMes(parseInt(e.target.value))}
            className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                       text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            {MESES.map((nome, i) => (
              <option key={i+1} value={i+1}>{nome}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted"/>
        </div>
      </div>

      {/* Quantidade */}
      <div className="w-full">
        <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Quantidade</label>
        <div className="relative">
          <select
            value={quantidade}
            onChange={(e) => setQuantidade(parseInt(e.target.value))}
            className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                       text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            {[10, 30, 50, 100, 9999].map((q) => (
              <option key={q} value={q}>{q === 9999 ? 'Todos' : q}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
        </div>
      </div>

      {/* Status */}
      <div className="w-full">
        <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Status</label>
        <div className="relative">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                       text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            <option value="">Todos</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
        </div>
      </div>

      {/* Forma Pgto */}
      <div className="w-full">
        <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Forma Pgto</label>
        <div className="relative">
          <select
            value={formaPagamentoSelecionada}
            onChange={(e) => setFormaPagamentoSelecionada(e.target.value)}
            className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                       text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            <option value="todas">Todas</option>
            {formasPagamento.map(fp => (
              <option key={fp.id} value={fp.id}>{fp.nome}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
        </div>
      </div>

      {/* Ordenar por */}
      <div className="w-full">
        <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Ordenar por</label>
        <div className="relative">
          <select
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value)}
            className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                       text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            <option value="data_lancamento">Data</option>
            <option value="data_vencimento">Vencimento</option>
            <option value="valor">Valor</option>
            <option value="forma_pagamento">Forma Pgto</option>
            <option value="categoria_nome">Categoria</option>
            <option value="subcategoria_nome">Subcategoria</option>
            <option value="status">Status</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
        </div>
      </div>

      {/* Ordem */}
      <div className="w-full">
        <label className="text-center text-xs text-gray-600 dark:text-darkMuted mb-1 block">Ordem</label>
        <div className="relative">
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value)}
            className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10
                       text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            <option value="DESC">Decrescente</option>
            <option value="ASC">Crescente</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
        </div>
      </div>
    </div>
  );
}

export default FiltroLancamentos;