import React, { useState, useEffect, useMemo } from 'react';
import ModalFormaPagamento from '../components/formaPgto/ModalFormaPagamento';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ModalConfirmacao from '../components/ModalConfirmacaoCategoria';
import { CreditCard, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

export default function CadastroFormaPagamento() {
  const [formas, setFormas] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [idParaExcluir, setIdParaExcluir] = useState(null);
  const [mostrarOcultas, setMostrarOcultas] = useState(false);

const formasFiltradas = useMemo(() => {
  return mostrarOcultas ? formas : formas.filter(f => !f.oculta);
}, [mostrarOcultas, formas]);

  useEffect(() => {
    carregarFormas();
  }, []);

  const carregarFormas = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/formas-pagamento', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setFormas(data);
  };

  const alternarOcultacao = async (forma) => {
  const token = localStorage.getItem('token');
  const url = `/api/formas-pagamento/ocultar/${forma.id}`;
  const metodo = forma.oculta ? 'DELETE' : 'POST';

  const res = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.ok) {
    toast.success(forma.oculta ? 'Forma reexibida com sucesso' : 'Forma ocultada com sucesso');
    carregarFormas();
  } else {
    toast.error('Erro ao atualizar visibilidade');
  }
};


const excluirForma = async (id) => {
  const token = localStorage.getItem('token');
  const confirmar = window.confirm('Deseja excluir esta forma de pagamento?');
  if (!confirmar) return;

  const res = await fetch(`/api/formas-pagamento/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.ok) {
    toast.success('Forma de pagamento excluída com sucesso');
    carregarFormas();
  } else {
    toast.error('Erro ao excluir forma de pagamento');
  }
};

 return (
  <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
    {/* Header padrão */}
    <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 text-center sm:text-left">
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center justify-center sm:justify-start gap-2 text-gray-800 dark:text-darkText">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Cadastro de Formas de Pagamento
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-darkMuted">
            Crie, edite, oculte e reexiba as formas utilizadas nos seus lançamentos.
          </p>
        </div>
        <div className="flex items-center justify-center sm:justify-end gap-3 flex-wrap">
          {/* Checkbox 'Mostrar ocultas' */}
          <label
            className="group inline-flex h-9 items-center select-none gap-2"
            title={mostrarOcultas ? 'Ocultas visíveis' : 'Ocultas escondidas'}
          >
            <input
              type="checkbox"
              className="sr-only peer"
              checked={mostrarOcultas}
              onChange={(e) => setMostrarOcultas(e.target.checked)}
            />
            <span
              className="
                flex items-center justify-center
                h-4 w-4 rounded-[4px] border border-gray-300 bg-white shadow-sm
                transition-colors duration-150 ease-out
                group-hover:border-blue-400
                peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/60
                peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white
                peer-checked:bg-blue-600 peer-checked:border-blue-600
                dark:border-darkBorder dark:bg-darkBg
                dark:group-hover:border-blue-400/70
                dark:peer-focus-visible:ring-offset-darkBg
                peer-checked:[&>svg]:opacity-100
              "
            >
              <svg
                className="pointer-events-none h-3 w-3 text-white opacity-0 transition-opacity duration-150"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <span className="text-sm leading-4 -translate-y-[1px] text-gray-700 dark:text-darkText">
              Mostrar ocultas
            </span>
          </label>

          {/* Botão com mesma altura (h-9) */}
          <button
            onClick={() => {
              setEditando(null);
              setModalAberto(true);
            }}
            className="inline-flex h-9 items-center px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow transition whitespace-nowrap shrink-0"
          >
            + Nova Forma
          </button>
        </div>
      </div>
      {/* Linha decorativa */}
      <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
    </section>
    {/* Tabela (card único, sem dupla borda; mobile compacto) */}
    <section className="bg-white dark:bg-darkCard rounded-xl shadow-md border border-gray-100 dark:border-darkBorder p-4 sm:p-6 overflow-x-auto">
      <table className="w-full border-collapse text-xs sm:text-sm">
        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 uppercase">
            <tr>
            <th className="px-2 py-2 text-left">Nome</th>
            <th className="px-2 py-2 text-center hidden sm:table-cell">Origem</th>
            <th className="px-2 py-2 text-center hidden sm:table-cell">Fech.</th>
            <th className="px-2 py-2 text-center hidden sm:table-cell">Venc.</th>
            <th className="px-2 py-2 text-center">Status</th>
            <th className="px-2 py-2 text-center">Ações</th>
            </tr>
        </thead>
        <tbody className="text-gray-700 dark:text-darkText divide-y divide-gray-100 dark:divide-gray-700">
          {formasFiltradas.map((forma) => (
            <tr key={forma.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <td className="px-2 py-1.5 sm:p-2">
                <span className="block truncate max-w-[28ch] sm:max-w-none">{forma.nome}</span>
              </td>
              <td className="px-2 py-1.5 sm:p-2 text-center hidden sm:table-cell">
                {forma.usuario_id === null ? 'Padrão' : 'Usuário'}
              </td>
              <td className="px-2 py-1.5 sm:p-2 text-center hidden sm:table-cell whitespace-nowrap">{forma.dia_fechamento ?? '—'}</td>
              <td className="px-2 py-1.5 sm:p-2 text-center hidden sm:table-cell whitespace-nowrap">{forma.dia_vencimento ?? '—'}</td>
              <td className="px-2 py-1.5 sm:p-2 text-center">{forma.oculta ? 'Oculta' : 'Ativa'}</td>
              <td className="px-2 py-1.5 sm:p-2">
                {forma.usuario_id === null ? (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => alternarOcultacao(forma)}
                      className={`inline-flex items-center gap-1 text-xs sm:text-sm ${forma.oculta ? 'text-green-600 hover:text-green-700' : 'text-yellow-600 hover:text-yellow-700'}`}
                      aria-label={forma.oculta ? 'Reexibir' : 'Ocultar'}
                      title={forma.oculta ? 'Reexibir' : 'Ocultar'}
                    >
                      <span className="sm:hidden">{forma.oculta ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</span>
                      <span className="hidden sm:inline">{forma.oculta ? 'Reexibir' : 'Ocultar'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => { setEditando(forma); setModalAberto(true); }}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      aria-label="Editar" title="Editar"
                    >
                      <span className="sm:hidden"><Pencil className="w-4 h-4" /></span>
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    <button
                      onClick={() => setIdParaExcluir(forma.id)}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                      aria-label="Excluir" title="Excluir"
                    >
                      <span className="sm:hidden"><Trash2 className="w-4 h-4" /></span>
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>

    {modalAberto && (
      <ModalFormaPagamento
        forma={editando}
        onClose={() => {
          setModalAberto(false);
          carregarFormas();
        }}
      />
    )}
    {idParaExcluir && (
      <ModalConfirmacao
        titulo="Excluir Forma de Pagamento"
        mensagem="Deseja realmente excluir esta forma de pagamento?"
        onCancelar={() => setIdParaExcluir(null)}
        onConfirmar={async () => {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/formas-pagamento/${idParaExcluir}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            toast.success('Forma de pagamento excluída com sucesso');
            carregarFormas();
          } else {
            toast.error('Erro ao excluir forma de pagamento');
          }

          setIdParaExcluir(null);
        }}
      />
    )}
  </div>
);
}