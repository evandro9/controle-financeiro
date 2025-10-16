import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

export default function ModalFormaPagamento({ forma, onClose }) {
  const [nome, setNome] = useState(forma?.nome || '');
  const [diaVenc, setDiaVenc] = useState('');
  const [diaFech, setDiaFech] = useState(forma?.dia_fechamento ?? '');

  // aceita "" (vazio) ou números; remove não-dígitos
const normalizeDayInput = (val) => {
  if (val === '' || val == null) return '';
  const digits = String(val).replace(/\D/g, '');
  return digits;
};

// clamp 1..31 (retorna "" se vazio)
const clampDay = (val) => {
  if (val === '' || val == null) return '';
  const n = Number(val);
  if (!Number.isFinite(n)) return '';
  return Math.min(31, Math.max(1, n));
};

const onBlurDay = (val, setter, label) => {
  if (val === '') return;
  const clamped = clampDay(val);
  if (String(clamped) !== String(val)) {
    setter(clamped === '' ? '' : String(clamped));
    toast.warn(`${label} ajustado para ${clamped} (permitido de 1 a 31).`);
  }
};

  useEffect(() => {
    if (forma) {
      setNome(forma.nome);
      setDiaVenc(forma?.dia_vencimento ?? '');
      setDiaFech(forma?.dia_fechamento ?? '');
    }
  }, [forma]);

  const salvar = async () => {
    const token = localStorage.getItem('token');
    const url = forma?.id
      ? `/api/formas-pagamento/${forma.id}`
      : '/api/formas-pagamento';
    const metodo = forma?.id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
       nome,
        dia_vencimento: diaVenc === '' ? null : Number(diaVenc),
        dia_fechamento: diaFech === '' ? null : Number(diaFech),
      })
    });

if (res.ok) {
  toast.success('Forma de pagamento salva com sucesso');
  onClose();
} else {
  toast.error('Erro ao salvar forma de pagamento');
}
  };

 return (
  <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-darkCard rounded-lg shadow-xl p-6 w-full max-w-md">
      <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-darkText">
        {forma ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
      </h2>

            {/* Form fields */}
      <div className="space-y-4">
        {/* Nome */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 dark:text-darkMuted mb-1">Nome</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Cartão Nubank"
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-darkText"
          />
        </div>

        {/* Linha com Vencimento e Fechamento (lado a lado em md+) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
            <label className="text-xs text-gray-500 dark:text-darkMuted mb-1">Dia de fechamento</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1..31 ou vazio"
              value={diaFech}
              onChange={(e) => setDiaFech(normalizeDayInput(e.target.value))}
              onBlur={() => onBlurDay(diaFech, setDiaFech, 'Fechamento')}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-darkText"
            />
            <span className="mt-1 text-[11px] text-gray-500 dark:text-darkMuted">Opcional. Define o ciclo da fatura.</span>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 dark:text-darkMuted mb-1">Dia de vencimento</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1..31 ou vazio"
              value={diaVenc}
              onChange={(e) => setDiaVenc(normalizeDayInput(e.target.value))}
              onBlur={() => onBlurDay(diaVenc, setDiaVenc, 'Vencimento')}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 dark:text-darkText"
            />
            <span className="mt-1 text-[11px] text-gray-500 dark:text-darkMuted">Deixe vazio se não houver vencimento.</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-darkText rounded hover:bg-gray-300 dark:hover:bg-gray-500"
        >
          Cancelar
        </button>
        <button
          onClick={salvar}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-500"
        >
          Salvar
        </button>
      </div>
    </div>
  </div>
);
}