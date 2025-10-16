import React from 'react';

export default function ModalConfirmacaoCategoria({ titulo, mensagem, onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-darkCard p-6 rounded-xl shadow-lg w-full max-w-md">
        <h3 className="text-lg font-bold text-gray-800 dark:text-darkText mb-2">{titulo}</h3>
        <p className="text-sm text-gray-600 dark:text-darkMuted mb-6">{mensagem}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancelar}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-darkText rounded hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 dark:hover:bg-red-500"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}