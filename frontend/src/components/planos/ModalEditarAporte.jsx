import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { NumericFormat } from 'react-number-format';
import ConfirmDialog from './ConfirmDialog';

export default function ModalEditarAporte({ aporte, onClose, onAtualizado }) {
  const apiBase = import.meta.env.VITE_API_URL ?? "/api";
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState('aporte');
  const [data, setData] = useState('');
  // confirmação custom
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmTone, setConfirmTone] = useState('warn');
  const [pendingEdit, setPendingEdit] = useState(null); // guarda o payload até confirmar

  useEffect(() => {
    if (aporte) {
      setValor(aporte.valor);
      setTipo(aporte.tipo);
      setData(aporte.data);
    }
  }, [aporte]);

const handleSalvar = async () => {
  const valorNumerico = parseFloat(valor);
  if (isNaN(valorNumerico) || valorNumerico <= 0) return;
  if (!data) return;

  // 🔎 checar saldo mensal negativo (após aplicar a edição)
  const vaiFicarNegativo = await checarSaldoMensalNegativo(tipo, valorNumerico, data);
  if (vaiFicarNegativo) {
    setConfirmMsg('Esta edição fará o saldo do mês ficar negativo. Deseja continuar?');
    setConfirmTone('danger');
    setPendingEdit({ ...aporte, valor: valorNumerico, tipo, data });
    setConfirmOpen(true);
    return;
  }
  // ok: segue sem confirmação
  onAtualizado({ ...aporte, valor: valorNumerico, tipo, data });
};

// 🧮 checa saldo mensal negativo com base nos endpoints existentes
async function checarSaldoMensalNegativo(tipoMov, valorMov, dataISO) {
  try {
    if (!dataISO) return false;
    const [ano, mes] = String(dataISO).split('-');
    const token = localStorage.getItem('token');
    const [resLanc, resPlan] = await Promise.all([
      fetch(`${apiBase}/lancamentos/resumo-mensal?ano=${ano}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`${apiBase}/planos-dashboard/mensal?ano=${ano}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);
    if (!resLanc.ok || !resPlan.ok) return false;
    const resumo = await resLanc.json();
    const planos = await resPlan.json();

    const key = String(mes).padStart(2,'0');
    const r = (resumo || []).find(x => String(x.mes).padStart(2,'0') === key) || { receita:0, despesa:0 };
    const p = (planos || []).find(x => String(x.mes).padStart(2,'0') === key) || { aporte:0, retirada:0 };

    const receita   = Number(r.receita || 0);
    const despesas  = Number(r.despesa || 0);
    const aportes   = Number(p.aporte || 0);
    const retiradas = Number(p.retirada || 0);

    let planosNet = aportes - retiradas;
    if (String(tipoMov).toLowerCase() === 'aporte') planosNet += Number(valorMov || 0);
    else planosNet -= Number(valorMov || 0); // retirada reduz impacto

    const saldoProj = receita - despesas - planosNet;
    return saldoProj < 0;
  } catch {
    return false; // em caso de erro, não bloquear
  }
}

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-md">
          <Dialog.Title className="text-lg font-bold text-center text-gray-800 dark:text-white mb-4">
            Editar Movimento
          </Dialog.Title>

          <div className="space-y-4">
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setTipo('aporte')}
                className={`px-4 py-1 rounded-full text-sm font-medium border transition ${
                  tipo === 'aporte'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                }`}
              >
                Aporte
              </button>
              <button
                onClick={() => setTipo('retirada')}
                className={`px-4 py-1 rounded-full text-sm font-medium border transition ${
                  tipo === 'retirada'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                }`}
              >
                Retirada
              </button>
            </div>

        <div className="grid grid-cols-2 gap-4">
  <div>
    <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">Valor</label>
    <NumericFormat
      value={valor}
      onValueChange={({ value }) => setValor(value)}
      thousandSeparator="."
      decimalSeparator=","
      prefix="R$ "
      allowNegative={false}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
    />
  </div>
  <div>
    <label className="text-sm text-gray-600 dark:text-gray-300 block mb-1">Data</label>
    <input
      type="date"
      value={data}
      onChange={(e) => setData(e.target.value)}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-800 dark:bg-gray-700 dark:text-white dark:border-gray-600"
    />
  </div>
</div>

          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Salvar Alterações
            </button>
          </div>
        </Dialog.Panel>
      </div>

<ConfirmDialog
        open={confirmOpen}
        title="Confirmar edição"
        message={confirmMsg}
        tone={confirmTone}
        confirmText="Sim, continuar"
        cancelText="Cancelar"
        onCancel={() => { setConfirmOpen(false); setPendingEdit(null); }}
        onConfirm={() => {
          setConfirmOpen(false);
          if (pendingEdit) {
            onAtualizado(pendingEdit);
            setPendingEdit(null);
          }
        }}
      />

    </Dialog>
  );
}