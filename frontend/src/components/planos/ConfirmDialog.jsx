import React from 'react';
import { Dialog } from '@headlessui/react';

export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = 'Confirmação',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  tone = 'warn', // 'warn' | 'danger' | 'info'
}) {
  const confirmClasses = {
    warn:   'bg-amber-600 hover:bg-amber-700',
    danger: 'bg-red-600 hover:bg-red-700',
    info:   'bg-blue-600 hover:bg-blue-700',
  }[tone] || 'bg-emerald-600 hover:bg-emerald-700';

  return (
    <Dialog open={open} onClose={onCancel} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-md">
          <Dialog.Title className="text-lg font-bold text-gray-800 dark:text-white mb-3">
            {title}
          </Dialog.Title>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-5">{message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded-lg text-white ${confirmClasses}`}
            >
              {confirmText}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}