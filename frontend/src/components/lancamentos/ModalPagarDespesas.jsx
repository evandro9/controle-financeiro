import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

export default function ModalPagarDespesas({ aberto, onClose, onAplicar, anoAtual, mesAtual, formasPagamento }) {
  const [ano, setAno] = useState(anoAtual);
  const [mes, setMes] = useState(mesAtual);
  const [formaPagamento, setFormaPagamento] = useState('todas');

  const aplicar = () => {
    onAplicar({ ano, mes, formaPagamento });
    onClose();
  };

  return (
    <Transition show={aberto} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-6 shadow-lg transition-all">
            <Dialog.Title className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Pagar Despesas
            </Dialog.Title>

            <div className="mb-3">
              <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Ano</label>
              <input
                type="number"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>

            <div className="mb-3">
              <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Mês de Vencimento</label>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Forma de Pagamento</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="todas">Todas</option>
                {formasPagamento.map(fp => (
                  <option key={fp.id} value={fp.id}>{fp.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancelar
              </button>

              <button
                onClick={aplicar}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Aplicar Filtros
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}