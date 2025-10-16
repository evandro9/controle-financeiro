import React from 'react';
import { Dialog } from '@headlessui/react';

export default function ModalExcluirAporte({ aporte, onClose, onExcluido }) {
  if (!aporte) return null;

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-sm">
          <Dialog.Title className="text-lg font-bold text-gray-800 dark:text-white mb-4">
            Confirmar Exclusão
          </Dialog.Title>

          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Deseja realmente excluir este movimento?
          </p>

          <div className="border rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
            <p><strong>Tipo:</strong> {aporte.tipo === 'aporte' ? 'Aporte' : 'Retirada'}</p>
            <p><strong>Valor:</strong> R$ {aporte.valor.toLocaleString('pt-BR')}</p>
            <p><strong>Data:</strong> {aporte.data}</p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              Cancelar
            </button>
<button
  onClick={async () => {
    try {
      await onExcluido(aporte); // faz o DELETE
    } finally {
      onClose(); // fecha SEMPRE o modal de confirmação
    }
  }}
  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
>
  Excluir
</button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}