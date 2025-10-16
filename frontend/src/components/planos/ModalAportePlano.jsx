import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { NumericFormat } from 'react-number-format';
import { Pencil, Trash2 } from 'lucide-react';
import ModalEditarAporte from './ModalEditarAporte';
import ModalExcluirAporte from './ModalExcluirAporte';
import { toast } from 'react-toastify';
import ConfirmDialog from './ConfirmDialog';

export default function ModalAportePlano({ aberto, setAberto, plano, onSalvar, onRefresh }) {
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState('aporte');
  const [data, setData] = useState('');
  const [arrecadado, setArrecadado] = useState(plano?.arrecadado || 0);
  const [salvando, setSalvando] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL ?? "/api";

    // 🔔 confirmação custom
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmTone, setConfirmTone] = useState('warn'); // 'warn' | 'danger'

    // edição/exclusão
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [mostrarModalExcluir, setMostrarModalExcluir] = useState(false);
  const [aporteSelecionado, setAporteSelecionado] = useState(null);
  const [movimentos, setMovimentos] = useState([]);

    // preview
  const valorNum        = Number(valor || 0);
  const valorTotalAtual = Number(plano?.valorTotal || 0);
  const arrecAtual      = Number(arrecadado || 0);
  const arrecadadoPrevisto = tipo === 'aporte'
   ? (arrecAtual + valorNum)
    : Math.max(arrecAtual - valorNum, 0);
  const restante        = Math.max(valorTotalAtual - arrecAtual, 0);
  const restantePrevisto = Math.max(valorTotalAtual - arrecadadoPrevisto, 0);

  useEffect(() => { setData(new Date().toISOString().split('T')[0]); }, []);
  useEffect(() => { if (aberto && plano?.id) carregarMovimentos(); }, [aberto, plano?.id]);
  useEffect(() => { setArrecadado(plano?.arrecadado || 0); }, [plano?.arrecadado]);

  const postAndClose = async () => {
  try {
    setSalvando(true);
    await onSalvar(plano.id, tipo, Number(valor), data); // vem do pai
    setValor('');                   // limpa
    setDirty(true);
    handleClose(true);
  } catch (err) {
    console.error('❌ Erro ao salvar movimento:', err);
    toast.error('Erro ao salvar movimento');
  } finally {
    setSalvando(false);
  }
};

  async function carregarMovimentos() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/planos-movimentos/${plano.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao buscar movimentos');
      const lista = await res.json();
      setMovimentos(Array.isArray(lista) ? lista : []);
    } catch (err) {
      console.error('❌ Erro ao carregar movimentos:', err);
      toast.error('Erro ao carregar movimentos');
    }
  }

const handleClose = (force = false) => {
  if (force || dirty) {
    window.dispatchEvent(new CustomEvent('planos:movimento:changed'));
  }
  setAberto(false);
};

const handleSalvar = () => {
const v = Number(valor || 0);
if (!v || v <= 0 || !data) return;

// excedente (plano)
const excedeu =
  (tipo === 'aporte'   && v > restante) ||
  (tipo === 'retirada' && v > arrecAtual);
if (excedeu) {
  const msg =
    tipo === 'aporte'
      ? `O aporte (R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) excede o restante do plano (R$ ${restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Deseja continuar?`
      : `A retirada (R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é maior que o total arrecadado (R$ ${arrecAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Deseja continuar?`;
  setConfirmMsg(msg);
  setConfirmTone(tipo === 'retirada' ? 'danger' : 'warn');
  setConfirmOpen(true);
  return;
}

// dentro do limite: checa saldo mensal negativo
checarSaldoMensalNegativo(tipo, v, data).then((ficaraNegativo) => {
      if (ficaraNegativo) {
        setConfirmMsg('Este movimento fará o saldo do mês ficar negativo. Deseja continuar?');
        setConfirmTone('danger');
        setConfirmOpen(true);
        return;
      }
      // ok: salva direto
      postAndClose();
    })
    .catch(() => {
      // se falhar a checagem, segue com o fluxo normal
      postAndClose();
    });
};

  const abrirModalEditar = (aporte) => { setAporteSelecionado(aporte); setMostrarModalEditar(true); };
  const abrirModalExcluir = (aporte) => { setAporteSelecionado(aporte); setMostrarModalExcluir(true); };

// 🧮 Checa se o saldo do mês (após aplicar este movimento) ficará negativo
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
    const resumo = await resLanc.json();   // [{mes:'01', receita, despesa,...}]
    const planos = await resPlan.json();   // [{mes:'01', aporte, retirada, liquido}]

    const key = String(mes).padStart(2,'0');
    const r = (resumo || []).find(x => String(x.mes).padStart(2,'0') === key) || { receita:0, despesa:0 };
    const p = (planos || []).find(x => String(x.mes).padStart(2,'0') === key) || { aporte:0, retirada:0 };

    const receita  = Number(r.receita || 0);
    const despesas = Number(r.despesa || 0);
    const aportes  = Number(p.aporte  || 0);
    const retiradas= Number(p.retirada|| 0);

    let planosNet = aportes - retiradas;
    if (String(tipoMov).toLowerCase() === 'aporte') planosNet += Number(valorMov || 0);
    else planosNet -= Number(valorMov || 0); // retirada diminui o impacto de planos

    const saldoProj = receita - despesas - planosNet;
    return saldoProj < 0;
  } catch (e) {
    console.warn('Falha ao checar saldo mensal negativo:', e);
    return false;
  }
}

  return (
        <Dialog open={aberto} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-md">
            <Dialog.Title className="text-lg font-bold text-center text-gray-800 dark:text-darkText mb-4">
              {tipo === 'aporte' ? 'Adicionar Aporte' : 'Registrar Retirada'}
            </Dialog.Title>

           {/* tipo */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setTipo('aporte')}
                className={`px-4 py-1 rounded-full text-sm font-medium border transition ${
                  tipo === 'aporte' ? 'bg-green-600 text-white border-green-600'
                                    : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                }`}
              >
                Aporte
              </button>
              <button
                onClick={() => setTipo('retirada')}
                className={`px-4 py-1 rounded-full text-sm font-medium border transition ${
                  tipo === 'retirada' ? 'bg-red-600 text-white border-red-600'
                                      : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                }`}
              >
                Retirada
              </button>
            </div>

             {/* valor/data */}
            <div className="grid grid-cols-2 gap-4 mt-4">
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

  {/* preview */}
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300 border rounded-lg p-4 mb-4 mt-4 dark:border-gray-600">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Arrecadado</p>
                <p className="font-medium text-emerald-500">R$ {arrecadadoPrevisto.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Restante</p>
                <p className="font-medium text-red-500">R$ {restantePrevisto.toLocaleString('pt-BR')}</p>
              </div>
            </div>

<div className="mt-6">
  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Últimos Movimentos</h3>
  <div className="max-h-52 overflow-y-auto rounded border dark:border-gray-600">
<table className="min-w-full text-sm">
    <thead className="bg-gray-100 text-gray-600 dark:bg-gray-700/90 dark:text-darkText">
      <tr>
        <th className="text-left px-3 py-2">Data</th>
        <th className="text-left px-3 py-2">Tipo</th>
        <th className="text-left px-3 py-2">Valor</th>
        <th className="text-center px-3 py-2">Ações</th>
      </tr>
    </thead>
    <tbody>
  {Array.isArray(movimentos) && movimentos.length === 0 && (
    <tr>
      <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Nenhum movimento registrado ainda.
      </td>
    </tr>
  )}
  {[...movimentos]
  .sort((a, b) => new Date(b.data) - new Date(a.data))
  .map((mov) => (
        <tr key={mov.id} className="border-t dark:border-gray-600">
          <td className="px-3 py-1 text-gray-700 dark:text-gray-300">{mov.data}</td>
          <td className="px-3 py-1">
  <span className={mov.tipo === 'aporte' ? 'text-green-600' : 'text-red-500'}>
    {mov.tipo === 'aporte' ? 'Aporte' : 'Retirada'}
  </span>
</td>
          <td className="px-3 py-1 text-right text-gray-700 dark:text-gray-300">
  R$ {Number(mov.valor || 0).toLocaleString('pt-BR')}
</td>
<td className="px-3 py-1 text-center">
  <div className="flex justify-center gap-2">
    <button
      onClick={() => abrirModalEditar(mov)}
      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <Pencil className="w-4 h-4 text-blue-600" />
    </button>
    <button
      onClick={() => abrirModalExcluir(mov)}
      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <Trash2 className="w-4 h-4 text-red-600" />
    </button>
  </div>
</td>
        </tr>
      ))}
    </tbody>
  </table>
  </div>
</div>

          <div className="mt-6 flex justify-end gap-3">
              <button
               onClick={() => handleClose()}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg"
              >
                Cancelar
              </button>
<button
  onClick={handleSalvar}
  disabled={salvando || !valor || Number(valor) <= 0 || !data}
  className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
>
  Confirmar
</button>
            </div>
          </Dialog.Panel>
        </div>

{mostrarModalEditar && (
  <ModalEditarAporte
    aporte={aporteSelecionado}
    onClose={() => setMostrarModalEditar(false)}
    onAtualizado={async (movimentoEditado) => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiBase}/planos-movimentos/${movimentoEditado.id}`, {  
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            tipo: movimentoEditado.tipo,
            valor: movimentoEditado.valor,
            data: movimentoEditado.data
          })
        });

        if (!res.ok) throw new Error('Erro ao atualizar');

        const resultado = await res.json(); // <- pegamos novoArrecadado

        toast.success('Movimento atualizado com sucesso!');
        setMostrarModalEditar(false);

        // Atualiza o valor arrecadado localmente no modal
        plano.arrecadado = resultado.novoArrecadado;
        setArrecadado(resultado.novoArrecadado);
         await carregarMovimentos();
         setDirty(true);

      } catch (err) {
        console.error('❌ Erro ao atualizar movimento:', err);
        toast.error('Erro ao atualizar movimento');
      }
    }}
  />
)}

{mostrarModalExcluir && (
  <ModalExcluirAporte
    aporte={aporteSelecionado}
    onClose={() => setMostrarModalExcluir(false)}
onExcluido={async (movimentoExcluido) => {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${apiBase}/planos-movimentos/${movimentoExcluido.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Erro ao excluir movimento');
    const data = await res.json(); // { success: true, novoArrecadado }

    toast.success('Movimento excluído com sucesso!');

    // fecha o modal de confirmação
    setMostrarModalExcluir(false);

    // atualiza preview local do modal
if (typeof data.novoArrecadado === 'number') {
  setArrecadado(data.novoArrecadado);     // preview do modal
  if (plano) plano.arrecadado = data.novoArrecadado; // mantém coerente
}
    // recarrega a lista de movimentos do modal
    await carregarMovimentos();
    // avisa o pai para recarregar os cards
if (typeof onRefresh === 'function') {
  await onRefresh();
}

// avisa o gráfico também
window.dispatchEvent(new CustomEvent('planos:movimento:changed'));
    setDirty(true);
    // opcional: se quiser fechar o modal pai após exclusão, descomente:
    // setAberto(false);

  } catch (err) {
    console.error('❌ Erro ao excluir movimento:', err);
    toast.error('Erro ao excluir movimento');
  }
}}  
  />
)}

<ConfirmDialog
  open={confirmOpen}
  title={tipo === 'aporte' ? 'Confirmar Aporte' : 'Confirmar Retirada'}
  message={confirmMsg}
  tone={confirmTone}
  confirmText="Sim, continuar"
  cancelText="Cancelar"
  onCancel={() => setConfirmOpen(false)}
  onConfirm={() => {
    setConfirmOpen(false);
    postAndClose();
  }}
/>
    </Dialog>   
  );
}