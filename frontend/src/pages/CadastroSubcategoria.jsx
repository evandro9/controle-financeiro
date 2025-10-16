import React, { useState, useEffect, useMemo } from 'react';
import ModalSubcategoria from '../components/subCategoria/ModalSubcategoria';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ModalConfirmacao from '../components/ModalConfirmacaoCategoria';
import { ListTree, Pencil, Trash2, Eye, EyeOff, ChevronDown } from 'lucide-react';

export default function CadastroSubcategoria() {
  const [categorias, setCategorias] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null);
  const [idParaExcluir, setIdParaExcluir] = useState(null);
  const [mostrarOcultas, setMostrarOcultas] = useState(false);

const subcatsFiltradas = useMemo(() => {
  const catSel = categorias.find(c => c.id === parseInt(categoriaSelecionada));
  const lista = catSel?.subcategorias || [];
  return mostrarOcultas ? lista : lista.filter(s => !s.oculta);
}, [categorias, categoriaSelecionada, mostrarOcultas]);

  useEffect(() => {
    carregarCategorias();
  }, []);

  const carregarCategorias = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/categorias-com-sub', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setCategorias(data);
  };

const abrirNovo = (categoriaId) => {
  setEditando({ nome: '', categoriaId }); // <-- já garante a associação
  setModalAberto(true);
};

const abrirEdicao = (sub) => {
  const categoriaId = parseInt(categoriaSelecionada); // já selecionada na tela
  setEditando({ ...sub, categoriaId }); // adiciona explicitamente
  setModalAberto(true);
};

  const alternarOcultacao = async (sub) => {
  const token = localStorage.getItem('token');
  const url = `/api/subcategorias/ocultar/${sub.id}`;
  const metodo = sub.oculta ? 'DELETE' : 'POST';

  const res = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok) {
    toast.success(sub.oculta ? 'Subcategoria reexibida com sucesso' : 'Subcategoria ocultada com sucesso');
    carregarCategorias();
  } else {
    toast.error('Erro ao atualizar visibilidade da subcategoria');
  }
};

  const excluirSubcategoria = async (id) => {
  const token = localStorage.getItem('token');
  const confirmar = window.confirm('Deseja realmente excluir esta subcategoria?');
  if (!confirmar) return;

  const res = await fetch(`/api/subcategorias/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.ok) {
    toast.success('Subcategoria excluída com sucesso');
    carregarCategorias();
  } else {
    toast.error('Erro ao excluir subcategoria');
  }
};

// Helpers da categoria selecionada (reuso em vários pontos)
const categoriaObjSelecionada = categorias.find(
  (c) => c.id === parseInt(categoriaSelecionada)
);
const categoriaOculta = !!categoriaObjSelecionada?.oculta;

  return (
  <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
    {/* Header padrão */}
    <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
      <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center gap-2 text-gray-800 dark:text-darkText">
        <ListTree className="w-5 h-5 text-blue-600" />
        Cadastro de Subcategorias
      </h2>
      <p className="text-sm text-gray-600 dark:text-darkMuted">
        Escolha uma categoria para visualizar, criar, editar, ocultar ou reexibir subcategorias vinculadas.
      </p>
      <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
    </section>

    {/* Seletor de categoria */}
    <section className="bg-white dark:bg-darkCard rounded-xl shadow-md border border-gray-100 dark:border-darkBorder p-4 sm:p-6 scroll-mt-24">
      <label className="block text-sm font-medium text-gray-700 dark:text-darkText mb-1 text-center">
        Selecione uma categoria:
      </label>
      <div className="relative w-full max-w-md mx-auto">
        <select
          value={categoriaSelecionada || ''}
          onChange={(e) => setCategoriaSelecionada(e.target.value)}
          className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10 text-sm text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
        >
          <option value="" disabled>Escolha uma categoria</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nome}{cat.oculta ? ' (oculta)' : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
      </div>
      {categoriaSelecionada && categoriaOculta && (
        <div className="mt-2 text-sm px-3 py-2 rounded-lg border
                        bg-yellow-50 text-yellow-700 border-yellow-200
                        dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800">
          A categoria selecionada está <b>oculta</b>. Reexiba a categoria na tela de <b>Categorias</b> para voltar a usá-la normalmente.
          Aqui você pode visualizar, mas algumas ações ficam limitadas.
        </div>
      )}
    </section>

    {/* Exibição das subcategorias */}
    {categoriaSelecionada && (
      <section className="bg-white dark:bg-darkCard rounded-xl shadow-md border border-gray-100 dark:border-darkBorder p-4 sm:p-6">
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 text-center sm:text-left">
  <h2 className="text-lg font-bold text-gray-800 dark:text-darkText">
    Subcategorias de: {categorias.find(c => c.id === parseInt(categoriaSelecionada))?.nome}
  </h2>

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
      onClick={() => abrirNovo(parseInt(categoriaSelecionada))}
      className="inline-flex h-9 items-center px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow transition whitespace-nowrap shrink-0"
    >
      + Nova Subcategoria
    </button>
  </div>
</div>

        {subcatsFiltradas.length > 0 ? (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-xs sm:text-sm">
      <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 uppercase">
        <tr>
          <th className="px-2 py-2 text-left">Nome</th>
          <th className="px-2 py-2 text-center hidden sm:table-cell">Origem</th>
          <th className="px-2 py-2 text-center">Status</th>
          <th className="px-2 py-2 text-center">Ações</th>
        </tr>
      </thead>
      <tbody className="text-gray-700 dark:text-darkText divide-y divide-gray-100 dark:divide-gray-700">
        {subcatsFiltradas.map((sub) => (
          <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            <td className="px-2 py-1.5 sm:p-2">
              <span className="block truncate max-w-[28ch] sm:max-w-none">{sub.nome}</span>
            </td>
            <td className="px-2 py-1.5 sm:p-2 text-center hidden sm:table-cell">
              {sub.usuario_id ? 'Usuário' : 'Padrão'}
            </td>
            <td className="px-2 py-1.5 sm:p-2 text-center">
              {sub.oculta ? 'Oculta' : 'Ativa'}
            </td>
            <td className="px-2 py-1.5 sm:p-2">
              {sub.usuario_id ? (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => abrirEdicao(sub)}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    aria-label="Editar"
                    title="Editar"
                  >
                    <span className="sm:hidden"><Pencil className="w-4 h-4" /></span>
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button
                    onClick={() => setIdParaExcluir(sub.id)}
                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                    aria-label="Excluir"
                    title="Excluir"
                  >
                    <span className="sm:hidden"><Trash2 className="w-4 h-4" /></span>
                    <span className="hidden sm:inline">Excluir</span>
                  </button>
                </div>
              ) : sub.oculta ? (
                categoriaOculta ? (
                  <span
                    className="block text-center text-gray-400 italic cursor-not-allowed"
                    onClick={() => toast.warn('⚠️ Reexiba a categoria primeiro')}
                  >
                    Reexiba a categoria primeiro
                  </span>
                ) : (
                  <div className="flex items-center justify-center">
                    <button
                      onClick={() => alternarOcultacao(sub)}
                      className="inline-flex items-center gap-1 text-green-600 hover:text-green-700"
                      aria-label="Reexibir"
                      title="Reexibir"
                    >
                      <span className="sm:hidden"><Eye className="w-4 h-4" /></span>
                      <span className="hidden sm:inline">Reexibir</span>
                    </button>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => alternarOcultacao(sub)}
                    className="inline-flex items-center gap-1 text-yellow-600 hover:text-yellow-700"
                    aria-label="Ocultar"
                    title="Ocultar"
                  >
                    <span className="sm:hidden"><EyeOff className="w-4 h-4" /></span>
                    <span className="hidden sm:inline">Ocultar</span>
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
) : (
  <p className="text-gray-500 dark:text-darkMuted italic">Nenhuma subcategoria cadastrada</p>
)}
      </section>  
    )}

    {modalAberto && (
      <ModalSubcategoria
        subcategoria={editando}
        onClose={() => {
          setModalAberto(false);
          carregarCategorias();
        }}
      />
    )}
    {idParaExcluir && (
      <ModalConfirmacao
        titulo="Excluir Subcategoria"
        mensagem="Deseja realmente excluir esta subcategoria?"
        onCancelar={() => setIdParaExcluir(null)}
        onConfirmar={async () => {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/subcategorias/${idParaExcluir}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            toast.success('Subcategoria excluída com sucesso');
            carregarCategorias();
          } else {
            toast.error('Erro ao excluir subcategoria');
          }

          setIdParaExcluir(null);
        }}
      />
    )}
  </div>
);
}