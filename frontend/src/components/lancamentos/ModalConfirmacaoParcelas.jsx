import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatarData(data) {
  return format(new Date(data), "dd/MM/yyyy", { locale: ptBR });
}

export default function ModalConfirmacaoParcelas({ parcelas, onConfirmar, onVoltar }) {
  return (
    <Transition show={true} as={Fragment}>
      <Dialog as="div" className="relative z-[999]" onClose={onVoltar}>
        <div className="fixed inset-0 bg-black/60" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg w-full max-w-2xl transition-all">
            <Dialog.Title className="text-xl font-semibold mb-4 text-center text-gray-800 dark:text-gray-100">
              Confirme as parcelas
            </Dialog.Title>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-center border dark:border-gray-700 mb-6">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr className="text-gray-800 dark:text-gray-200">
                    <th className="p-2">Parcela</th>
                    <th className="p-2">Data de Lançamento</th>
                    <th className="p-2">Data de Vencimento</th>
                    <th className="p-2">Valor</th>
                  </tr>
                </thead>
                <tbody className="dark:text-gray-100">
                  {parcelas.map((p, i) => (
                    <tr key={i} className="border-t dark:border-gray-700">
                      <td className="p-2">{p.parcela}</td>
                      <td className="p-2">{formatarData(p.data_lancamento + 'T12:00:00')}</td>
                      <td className="p-2">{formatarData(p.data_vencimento + 'T12:00:00')}</td>
                      <td className="p-2">R$ {p.valor.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={onVoltar}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Voltar
              </button>
              <button
                onClick={onConfirmar}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Confirmar e Salvar
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}