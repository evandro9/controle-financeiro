import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import InfoTip from '../ui/InfoTip';

const toBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const parseBRLInput = (s) => {
  const digits = String(s).replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100; // "123456" -> 1234.56
};

export default function CalculadoraSaldo() {
  // Saldo atual (com máscara)
  const [saldoFmt, setSaldoFmt] = useState('');
  const saldo = useMemo(() => parseBRLInput(saldoFmt), [saldoFmt]);

  // Faturas (n linhas, com máscara)
  const [faturas, setFaturas] = useState([]);
  const totalDespesas = useMemo(
    () => faturas.reduce((acc, f) => acc + parseBRLInput(f.valorFmt), 0),
    [faturas]
  );
  const saldoProj = useMemo(() => saldo - totalDespesas, [saldo, totalDespesas]);

  function addLinha() {
    const nextId = (faturas.at(-1)?.id || 0) + 1;
    setFaturas((prev) => [...prev, { id: nextId, valorFmt: '' }]);
  }
  function rmLinha(id) {
    setFaturas((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="bg-white dark:bg-darkCard rounded-xl shadow p-5 border border-gray-100 dark:border-darkBorder">
      {/* Header: título central + i padronizado (sem subtítulo) */}
      <div className="h-[36px] flex items-center justify-center mb-4 relative">
        <h3 className="text-lg text-base font-semibold text-gray-800 dark:text-darkText text-center">
          Calculadora de Saldo
        </h3>
        <div className="absolute right-0">
          <InfoTip title="Como funciona" ariaLabel="Informações da calculadora">
            <ul className="list-disc pl-4 space-y-1">
              <li><b>Saldo atual</b>: informe o valor atual da conta.</li>
              <li><b>Faturas</b>: adicione os valores a pagar (quantas precisar).</li>
              <li><b>Total despesas</b>: soma das faturas adicionadas.</li>
              <li><b>Saldo projetado</b>: saldo atual − total de despesas.</li>
              <li>Use para prever o saldo após quitar faturas e atualizar o patrimônio da conta.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* Linha única: Saldo atual | Total despesas | Saldo projetado */}
      <div className="grid grid-cols-12 gap-4 items-end">
        {/* Saldo atual */}
        <div className="col-span-12 md:col-span-4">
          <label className="text-xs font-medium dark:text-darkText">Saldo atual (R$)</label>
          <input
            type="text"
            inputMode="numeric"
            value={saldoFmt}
            onChange={(e) => setSaldoFmt(toBRL(parseBRLInput(e.target.value)))}
            placeholder="R$ 0,00"
            className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-darkBg text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder"
          />
        </div>

        {/* Total despesas (read-only estilo input) */}
        <div className="col-span-12 md:col-span-4">
          <label className="text-xs font-medium dark:text-darkText">Total despesas</label>
          <div className="w-full rounded-lg border px-3 py-2 bg-gray-50 dark:bg-darkBorder
                          text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder">
            <span className="font-semibold">{toBRL(totalDespesas)}</span>
          </div>
        </div>

        {/* Saldo projetado (read-only estilo input) */}
        <div className="col-span-12 md:col-span-4">
          <label className="text-xs font-medium dark:text-darkText">Saldo projetado</label>
          <div className="w-full rounded-lg border px-3 py-2 bg-gray-50 dark:bg-darkBorder
                          border-gray-300 dark:border-darkBorder">
            <span className={`font-semibold ${saldoProj >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {toBRL(saldoProj)}
            </span>
          </div>
        </div>
      </div>

      {/* Faturas */}
<div className="mt-5">
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-gray-700 dark:text-darkText">Faturas</span>
    <button
      onClick={addLinha}
      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                 bg-gray-100 hover:bg-gray-200
                 dark:bg-darkBorder dark:hover:bg-gray-700 dark:text-darkText"
      title="Adicionar fatura"
      type="button"
    >
      <Plus className="w-4 h-4" />
      <span className="hidden sm:inline">Adicionar</span>
    </button>
  </div>

        {/* Grade responsiva para “ficar lado a lado” quando couber */}
        {faturas.length === 0 ? (
  <div className="mt-2 rounded-lg border border-dashed border-gray-300 dark:border-darkBorder p-4 text-center text-sm text-gray-500 dark:text-darkMuted">
    Nenhuma fatura adicionada. Clique em <span className="font-medium">Adicionar</span> para incluir.
  </div>
) : (
  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
    {faturas.map((f) => (
      <div key={f.id} className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={f.valorFmt}
          onChange={(e) => {
            const v = toBRL(parseBRLInput(e.target.value));
            setFaturas((prev) => prev.map((x) => (x.id === f.id ? { ...x, valorFmt: v } : x)));
          }}
          className="flex-1 rounded-lg border px-3 py-2 bg-white dark:bg-darkBg
                     text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder"
          placeholder="R$ 0,00"
        />
        <button
          onClick={() => rmLinha(f.id)}
          className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50
                     dark:text-darkMuted dark:hover:text-red-400 dark:hover:bg-red-900/20"
          title="Remover fatura"
          aria-label="Remover fatura"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
)}
      </div>
    </div>
  );
}