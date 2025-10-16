import React, { useState, useEffect, useMemo } from 'react';
import { toast } from "react-toastify";
// ⬇️ mesmo import das telas de Categoria/Subcategoria
import ModalConfirmacao from '../components/ModalConfirmacaoCategoria'; // ajuste o caminho se necessário
import { Layers, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { RequireFeature } from '../context/PlanContext.jsx';
import UpsellPremium from '../components/UpsellPremium.jsx';

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function CadastroClassesInvestimento() {
  const [carregando, setCarregando] = useState(true);
  const [itens, setItens] = useState([]);
  const [mostrarOcultas, setMostrarOcultas] = useState(false);

  // modal de novo/editar
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null); // null = novo
  const [nomeCampo, setNomeCampo] = useState("");

  // modal de confirmação (excluir)
  const [idParaExcluir, setIdParaExcluir] = useState(null);

  const token = useMemo(() => localStorage.getItem("token"), []);

  async function listar() {
    try {
      setCarregando(true);
      const resp = await fetch(
        `${API}/investimentos/classes?ocultas=${mostrarOcultas ? 1 : 0}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.erro || "Falha ao listar classes");
      setItens(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { listar(); /* eslint-disable-next-line */ }, [mostrarOcultas]);

  // NOVO
  function abrirNovo() {
    setEditando(null);
    setNomeCampo("");
    setModalAberto(true);
  }

  // EDITAR
  function abrirEdicao(item) {
    setEditando(item);
    setNomeCampo(item.nome || "");
    setModalAberto(true);
  }

  async function salvarModal() {
    if (!nomeCampo.trim()) return toast.warn("Digite o nome");
    try {
      if (editando) {
        const resp = await fetch(`${API}/investimentos/classes/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nome: nomeCampo.trim() }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.erro || "Falha ao atualizar");
        toast.success("Classe atualizada");
      } else {
        const resp = await fetch(`${API}/investimentos/classes`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nome: nomeCampo.trim() }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.erro || "Falha ao criar");
        toast.success("Classe criada");
      }
      setModalAberto(false);
      listar();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function toggleOcultar(item) {
    try {
      const resp = await fetch(`${API}/investimentos/classes/${item.id}/ocultar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oculto: item.oculto ? 0 : 1 }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.erro || "Falha ao atualizar visibilidade");
      toast.success(item.oculto ? "Reexibida" : "Ocultada");
      listar();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function excluirClasse(id) {
    try {
const resp = await fetch(`${API}/investimentos/classes/${id}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` },
});
const data = await resp.json().catch(() => ({}));

if (!resp.ok) {
  if (data.motivo === 'investimentos') {
    toast.error(`Não é possível excluir: existem ${data.quantidade ?? ''} investimentos vinculados a esta classe.`);
  } else if (data.motivo === 'subclasses') {
    toast.error(`Não é possível excluir: existem ${data.quantidade ?? ''} subclasses vinculadas a esta classe.`);
  } else if (data.motivo === 'ticker_map') {
    toast.error(`Não é possível excluir: existem ${data.quantidade ?? ''} mapeamentos de ticker vinculados a esta classe.`);
  } else if (data.motivo === 'padrao') {
    toast.error('Esta é uma classe padrão do sistema e não pode ser excluída. Você pode apenas ocultá-la.');
  } else {
    toast.error(data.erro || 'Falha ao excluir classe.');
  }
  setIdParaExcluir(null);
  return;
}

toast.success('Classe excluída');
setIdParaExcluir(null);
listar();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const itensFiltrados = useMemo(
    () => (mostrarOcultas ? itens : itens.filter(i => !i.oculto)),
    [mostrarOcultas, itens]
  );

  return (
    <RequireFeature feature="investimentos" fallback={<UpsellPremium title="Simulador de Investimentos" />}>
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header padrão */}
      <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 text-center sm:text-left">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center justify-center sm:justify-start gap-2 text-gray-800 dark:text-darkText">
              <Layers className="w-5 h-5 text-blue-600" />
              Classes de Investimento
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-darkMuted">
              Gerencie as classes utilizadas nos seus ativos.
            </p>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-3 flex-wrap">
            {/* checkbox com ✓ visível (peer) — padrão */}
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
                className="flex items-center justify-center h-4 w-4 rounded-[4px] border border-gray-300 bg-white shadow-sm
                           transition-colors duration-150 ease-out group-hover:border-blue-400
                           peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400/60
                           peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white
                           peer-checked:bg-blue-600 peer-checked:border-blue-600
                           dark:border-darkBorder dark:bg-darkBg dark:group-hover:border-blue-400/70
                           dark:peer-focus-visible:ring-offset-darkBg peer-checked:[&>svg]:opacity-100"
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

            <button
              onClick={abrirNovo}
              className="inline-flex h-9 items-center px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow transition whitespace-nowrap shrink-0"
            >
              + Nova Classe
            </button>
          </div>
        </div>
        {/* Linha decorativa */}
        <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      </section>

      {/* Tabela (card único; mobile compacto) */}
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
          <tbody className="text-gray-700 dark:text-darkText divide-y divide-gray-100 dark:divide-gray-700">
            {itensFiltrados.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                <td className="px-2 py-1.5 sm:p-2">
                  <span className="block truncate max-w-[28ch] sm:max-w-none">{item.nome}</span>
                </td>
                <td className="px-2 py-1.5 sm:p-2 text-center hidden sm:table-cell">
                  {item.usuario_id === null ? 'Padrão' : 'Usuário'}
                </td>
                <td className="px-2 py-1.5 sm:p-2 text-center whitespace-nowrap">
                  {item.oculto ? 'Oculta' : 'Ativa'}
                </td>
                <td className="px-2 py-1.5 sm:p-2">
                  {item.usuario_id === null ? (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => toggleOcultar(item)}
                        className={`inline-flex items-center gap-1 text-xs sm:text-sm ${item.oculto ? 'text-green-600 hover:text-green-700' : 'text-yellow-600 hover:text-yellow-700'}`}
                        aria-label={item.oculto ? 'Reexibir' : 'Ocultar'}
                        title={item.oculto ? 'Reexibir' : 'Ocultar'}
                      >
                        <span className="sm:hidden">{item.oculto ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</span>
                        <span className="hidden sm:inline">{item.oculto ? 'Reexibir' : 'Ocultar'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => abrirEdicao(item)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        aria-label="Editar" title="Editar"
                      >
                        <span className="sm:hidden"><Pencil className="w-4 h-4" /></span>
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => setIdParaExcluir(item.id)}
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

            {!carregando && itensFiltrados.length === 0 && (
              <tr><td className="px-2 py-2 text-center" colSpan={4}>Nenhuma classe</td></tr>
            )}
            {carregando && (
              <tr><td className="px-2 py-2 text-center" colSpan={4}>Carregando...</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Modal novo/editar */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-darkCard rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-darkText">
              {editando ? 'Editar Classe' : 'Nova Classe'}
            </h2>

            <input
              value={nomeCampo}
              onChange={(e) => setNomeCampo(e.target.value)}
              className="h-10 w-full px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-darkText outline-none
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-500/50"
              placeholder="Ex.: Ação, FII, ETF…"
              autoFocus
            />

            <div className="mt-5 flex justify-end gap-2">
             <button onClick={() => setModalAberto(false)} className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700">Cancelar</button>
              <button onClick={salvarModal} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação de exclusão — igual ao de Categorias */}
      {idParaExcluir && (
        <ModalConfirmacao
          titulo="Excluir Classe"
          mensagem="Deseja realmente excluir esta classe?"
          onCancelar={() => setIdParaExcluir(null)}
          onConfirmar={() => excluirClasse(idParaExcluir)}
        />
      )}
    </div>
    </RequireFeature>
  );
}