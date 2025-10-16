import React, { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';

export default function ModalExcluirPlano({ plano, onClose, onConfirmar }) {
const apiBase = import.meta.env.VITE_API_URL ?? "/api";
const [qtdMovs, setQtdMovs] = useState(null);
const [loading, setLoading] = useState(true);
const [err, setErr] = useState(null);

useEffect(() => {
  let alive = true;
  (async () => {
    try {
      setLoading(true); setErr(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/planos-movimentos/${plano.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar movimentos');
      const lista = await res.json();
      if (!alive) return;
      setQtdMovs(Array.isArray(lista) ? lista.length : 0);
    } catch (e) {
      if (!alive) return;
      setErr(e);
      setQtdMovs(0);
    } finally {
      if (alive) setLoading(false);
    }
  })();
  return () => { alive = false; };
}, [plano?.id]);

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-sm">
          <Dialog.Title className="text-lg font-bold text-gray-800 dark:text-darkText mb-4">
            Confirmar Exclusão
          </Dialog.Title>

<div className="space-y-2 text-sm mb-4">
  <p className="text-gray-700 dark:text-gray-200">
    Tem certeza que deseja excluir o plano <strong>{plano?.nome}</strong>?
  </p>
  <div className="rounded-md border px-3 py-2 dark:border-gray-700">
    {loading ? (
      <p className="text-gray-500 dark:text-gray-400">Verificando movimentações…</p>
    ) : err ? (
      <p className="text-red-600">Não foi possível verificar as movimentações agora.</p>
    ) : (
      <>
        {qtdMovs > 0 ? (
          <p className="text-amber-700 dark:text-amber-400">
            Este plano possui <strong>{qtdMovs}</strong> movimenta{qtdMovs === 1 ? 'ção' : 'ções'}.
            Ao confirmar, <strong>todas as movimentações</strong> e seus
            <strong> lançamentos vinculados</strong> serão excluídos definitivamente.
          </p>
        ) : (
          <p className="text-gray-600 dark:text-gray-300">
            Não há movimentações vinculadas a este plano.
          </p>
        )}
      </>
    )}
  </div>
</div>

          <div className="border rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
            <p><strong>Nome:</strong> {plano.nome}</p>
            <p><strong>Valor total:</strong> R$ {parseFloat(plano.valorTotal || 0).toLocaleString('pt-BR')}</p>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirmar(plano)}
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