import React, { useState, useEffect, useMemo } from 'react';
import ModalCategoria from '../components/categoria/ModalCategoria';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ModalConfirmacao from '../components/ModalConfirmacaoCategoria';
import { FolderTree, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

const CadastroCategoria = () => {
  const [categorias, setCategorias] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [idParaExcluir, setIdParaExcluir] = useState(null);
  const [mostrarOcultas, setMostrarOcultas] = useState(false);

  useEffect(() => {
    buscarCategorias();
  }, []);

  const buscarCategorias = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/categorias-com-sub', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setCategorias(data);
  };

  const alternarOcultacao = async (cat) => {
  const token = localStorage.getItem('token');
  const url = `/api/categorias/ocultar/${cat.id}`;
  const metodo = cat.oculta ? 'DELETE' : 'POST';

  const res = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok) {
    toast.success(cat.oculta ? 'Categoria reexibida com sucesso' : 'Categoria ocultada com sucesso');
    carregarCategorias();
  } else {
    toast.error('Erro ao atualizar visibilidade da categoria');
  }
};

  const excluirCategoria = async (id) => {
  const token = localStorage.getItem('token');
  const confirmar = window.confirm('Deseja realmente excluir esta categoria?');
  if (!confirmar) return;

  const res = await fetch(`/api/categorias/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.ok) {
    toast.success('Categoria excluída com sucesso');
    carregarCategorias();
  } else {
    toast.error('Erro ao excluir categoria');
  }
};


const carregarCategorias = async () => {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/categorias-com-sub', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  setCategorias(data);
};

const categoriasFiltradas = useMemo(() => {
  return mostrarOcultas ? categorias : categorias.filter(c => !c.oculta);
}, [mostrarOcultas, categorias]);

  return (
  <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
    {/* Header padrão */}
    <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 text-center sm:text-left">
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center justify-center sm:justify-start gap-2 text-gray-800 dark:text-darkText">
            <FolderTree className="w-5 h-5 text-blue-600" />
            Cadastro de Categorias
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-darkMuted">
            Crie, edite, oculte e reexiba categorias para organizar seus lançamentos.
          </p>
        </div>
        <div className="flex items-center justify-center sm:justify-end gap-3">
  {/* Checkbox 'Mostrar ocultas' com altura igual à do botão */}
<label
  className="group inline-flex h-9 items-center select-none gap-2"
  title={mostrarOcultas ? 'Ocultas visíveis' : 'Ocultas escondidas'}
>
    {/* input invisível, continua como 'peer' */}
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
        peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/60
        peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white
        group-hover:border-blue-400
        peer-checked:bg-blue-600 peer-checked:border-blue-600
        dark:border-darkBorder dark:bg-darkBg
        dark:group-hover:border-blue-400/70
        dark:peer-focus-visible:ring-offset-darkBg
        peer-checked:[&>svg]:opacity-100
      "
    >
      {/* check fica CENTRALIZADO dentro da caixinha */}
      <svg
        className="pointer-events-none h-3 w-3 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </span>

    {/* texto com linha baixa para alinhar ao centro da caixinha */}
<span className="text-sm leading-4 -translate-y-[1px] text-gray-700 dark:text-darkText">
  Mostrar ocultas
</span>
  </label>

  {/* Botão alinhado pela mesma altura (h-9) */}
  <button
    onClick={() => { setEditando(null); setModalAberto(true); }}
    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow transition"
  >
    + Nova Categoria
  </button>
</div>
      </div>
      {/* Linha decorativa */}
      <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
    </section>

    {/* Tabela (card único, sem dupla borda) */}
    <section className="bg-white dark:bg-darkCard rounded-xl shadow-md border border-gray-100 dark:border-darkBorder p-4 sm:p-6 overflow-x-auto">
      <table className="w-full border-collapse text-xs sm:text-sm">
        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 uppercase">
            <tr>
            <th className="px-2 py-2 text-left">Nome</th>
            <th className="px-2 py-2 text-center hidden sm:table-cell">Origem</th>
            <th className="px-2 py-2 text-center">Status</th>
            <th className="px-2 py-2 text-center">Ações</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-700 dark:text-darkText">
          {categoriasFiltradas.map((cat) => (
            <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              <td className="px-2 py-1.5 sm:p-2">
                <span className="block truncate max-w-[28ch] sm:max-w-none">{cat.nome}</span>
              </td>
              <td className="px-2 py-1.5 sm:p-2 text-center hidden sm:table-cell">
                {cat.usuario_id === null ? 'Padrão' : 'Usuário'}
              </td>
              <td className="px-2 py-1.5 sm:p-2 text-center">
                {cat.oculta ? 'Oculta' : 'Ativa'}
              </td>
              <td className="px-2 py-1.5 sm:p-2">
                {/* Ações: ícones no mobile | texto no desktop */}
                {cat.usuario_id === null ? (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => alternarOcultacao(cat)}
                      className={`inline-flex items-center gap-1 text-xs sm:text-sm ${
                        cat.oculta ? 'text-green-600 hover:text-green-700' : 'text-yellow-600 hover:text-yellow-700'
                      }`}
                      aria-label={cat.oculta ? 'Reexibir' : 'Ocultar'}
                      title={cat.oculta ? 'Reexibir' : 'Ocultar'}
                    >
                      <span className="sm:hidden">{cat.oculta ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</span>
                      <span className="hidden sm:inline">{cat.oculta ? 'Reexibir' : 'Ocultar'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => { setEditando(cat); setModalAberto(true); }}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                      aria-label="Editar"
                      title="Editar"
                    >
                      <span className="sm:hidden"><Pencil className="w-4 h-4" /></span>
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    <button
                      onClick={() => setIdParaExcluir(cat.id)}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                      aria-label="Excluir"
                      title="Excluir"
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
      <ModalCategoria
        categoria={editando}
        onClose={() => { setModalAberto(false); carregarCategorias(); }}
      />
    )}
    {idParaExcluir && (
      <ModalConfirmacao
        titulo="Excluir Categoria"
        mensagem="Deseja realmente excluir esta categoria?"
        onCancelar={() => setIdParaExcluir(null)}
        onConfirmar={async () => {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/categorias/${idParaExcluir}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            toast.success('Categoria excluída com sucesso');
            carregarCategorias();
          } else {
            toast.error('Erro ao excluir categoria');
          }
          setIdParaExcluir(null);
        }}
      />
    )}
  </div>
);
};

export default CadastroCategoria;