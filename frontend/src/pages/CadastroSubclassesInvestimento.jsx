import React, { useState, useEffect, useMemo } from 'react';
import { toast } from "react-toastify";
import ModalConfirmacao from '../components/ModalConfirmacaoCategoria'; // mesmo usado em Categorias
import { ListTree, Pencil, Trash2, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { RequireFeature } from '../context/PlanContext.jsx';
import UpsellPremium from '../components/UpsellPremium.jsx';

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function CadastroSubclassesInvestimento() {
  const [classes, setClasses] = useState([]);
  const [classeId, setClasseId] = useState("");
  const [mostrarOcultas, setMostrarOcultas] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [itens, setItens] = useState([]);
const [nomeCampo, setNomeCampo] = useState("");

  const token = useMemo(() => localStorage.getItem("token"), []);

  const [subIdParaExcluir, setSubIdParaExcluir] = useState(null);

 const [modalAberto, setModalAberto] = useState(false);
 const [editando, setEditando] = useState(null); // {id?, nome, classeId}

  // Carrega classes (com ocultas opcional) e mantém seleção
  async function carregarClasses() {
    try {
      const resp = await fetch(
        `${API}/investimentos/classes?ocultas=${mostrarOcultas ? 1 : 0}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.erro || "Falha ao listar classes");
      setClasses(data);
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function listarSubclasses() {
    if (!classeId) return setItens([]);
    setCarregando(true);
    try {
      const resp = await fetch(
        `${API}/investimentos/subclasses?classe_id=${classeId}&ocultas=${mostrarOcultas ? 1 : 0}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.erro || "Falha ao listar subclasses");
      setItens(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarOcultas]);

  useEffect(() => {
    listarSubclasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeId, mostrarOcultas]);

 async function salvarModal() {
   if (!classeId) return toast.warn("Selecione uma classe");
   const token = localStorage.getItem('token');
   const nome = nomeCampo.trim();
   if (!nome) return toast.warn("Digite o nome");

   try {
     let resp;
     if (editando?.id) {
       // EDITAR
       resp = await fetch(`${API}/investimentos/subclasses/${editando.id}`, {
         method: "PUT",
         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
         body: JSON.stringify({ nome })
       });
     } else {
       // NOVA
       resp = await fetch(`${API}/investimentos/subclasses`, {
         method: "POST",
         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
         body: JSON.stringify({ classe_id: Number(classeId), nome })
       });
     }
     const data = await resp.json().catch(() => ({}));
     if (!resp.ok) throw new Error(data?.erro || "Falha ao salvar subclasse");
     toast.success(editando?.id ? "Subclasse atualizada" : "Subclasse criada");
     setModalAberto(false);
     setEditando(null);
     setNomeCampo("");
     listarSubclasses();
   } catch (e) {
     toast.error(e.message);
   }
 }

  async function toggleOcultar(item) {
    try {
      const resp = await fetch(`${API}/investimentos/subclasses/${item.id}/ocultar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oculto: item.oculto ? 0 : 1 }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.erro || "Falha ao atualizar visibilidade");
      toast.success(item.oculto ? "Reexibida" : "Ocultada");
      listarSubclasses();
    } catch (e) {
      toast.error(e.message);
    }
  }

   async function excluirSubclasse(id) {
   try {
     const resp = await fetch(`${API}/investimentos/subclasses/${id}`, {
       method: "DELETE",
       headers: { Authorization: `Bearer ${token}` },
     });
     const data = await resp.json().catch(() => ({}));

     if (!resp.ok) {
       // mensagens amigáveis (se o backend retornar motivo/quantidade)
       if (data.motivo === 'investimentos') {
         toast.error(`Não é possível excluir: existem ${data.quantidade ?? ''} investimentos vinculados a esta subclasse.`);
       } else {
         toast.error(data.erro || 'Falha ao excluir subclasse.');
       }
       setSubIdParaExcluir(null);
       return;
     }
     toast.success('Subclasse excluída');
     setSubIdParaExcluir(null);
     listarSubclasses();
   } catch (e) {
     toast.error(e.message);
   }
 }

  // Para o aviso quando a classe estiver oculta (mesma UX do CadastroSubcategoria)
  const classeObjSelecionada = classes.find(c => c.id === parseInt(classeId));
  const classeOculta = !!classeObjSelecionada?.oculto;

  const itensFiltrados = useMemo(
    () => (mostrarOcultas ? itens : itens.filter(i => !i.oculto)),
    [mostrarOcultas, itens]
  );

 function abrirNovo() {
   if (!classeId) return toast.warn('Selecione uma classe');
   setEditando({ id: null, nome: '', classeId: parseInt(classeId) });
   setNomeCampo('');
   setModalAberto(true);
 }

 function abrirEdicao(sub) {
   setEditando({ id: sub.id, nome: sub.nome, classeId: parseInt(classeId) });
   setNomeCampo(sub.nome);
   setModalAberto(true);
 }

  return (
    <RequireFeature feature="investimentos" fallback={<UpsellPremium title="Simulador de Investimentos" />}>
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header padrão */}
      <section className="mt-4 sm:mt-4 bg-white dark:bg-darkCard p-6 rounded-xl shadow-md border border-gray-100 dark:border-darkBorder space-y-3">
        <h2 className="text-lg sm:text-xl leading-tight font-semibold flex items-center gap-2 text-gray-800 dark:text-darkText">
          <ListTree className="w-5 h-5 text-blue-600" />
          Subclasses de Investimento
        </h2>
        <p className="text-sm text-gray-600 dark:text-darkMuted">
          Selecione uma classe para visualizar, criar, editar, ocultar e reexibir suas subclasses vinculadas.
        </p>
        <div className="h-px w-full bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      </section>

      {/* Seletor de classe */}
      <section className="bg-white dark:bg-darkCard rounded-xl shadow-md border border-gray-100 dark:border-darkBorder p-4 sm:p-6 scroll-mt-24">
        <label className="block text-sm font-medium text-gray-700 dark:text-darkText mb-1 text-center">
          Selecione uma classe:
        </label>
        <div className="relative w-full max-w-md mx-auto">
          <select
            value={classeId || ''}
            onChange={(e) => setClasseId(e.target.value)}
            className="h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10 text-sm text-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
          >
            <option value="" disabled>Escolha uma classe</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}{c.oculto ? ' (oculta)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-darkMuted" />
        </div>

        {classeId && classeOculta && (
          <div className="mt-2 text-sm px-3 py-2 rounded-lg border
                          bg-yellow-50 text-yellow-700 border-yellow-200
                          dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800">
            A classe selecionada está <b>oculta</b>. Reexiba a classe em <b>Classes de Investimento</b> para voltar a usá-la normalmente.
            Aqui você pode visualizar, mas algumas ações ficam limitadas.
          </div>
        )}
      </section>

      {/* Tabela no mesmo padrão */}
      {classeId && (
        <section className="bg-white dark:bg-darkCard rounded-xl shadow-md border border-gray-100 dark:border-darkBorder p-4 sm:p-6">
          {/* Header da seção (título + toggle + botão) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 text-center sm:text-left">
  <h2 className="text-lg font-bold text-gray-800 dark:text-darkText">
    Subclasses de: {classes.find(c => c.id === parseInt(classeId))?.nome}
  </h2>

  <div className="flex items-center justify-center sm:justify-end gap-3 flex-wrap">
    {/* Checkbox 'Mostrar ocultas' com ✓ visível (mesmo markup do Subcategorias) */}
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

    <button
      onClick={abrirNovo}
      className="inline-flex h-9 items-center px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow transition whitespace-nowrap shrink-0"
    >
      + Nova Subclasse
    </button>
  </div>
</div>
          {/* Tabela (sem borda dupla; mobile compacto) */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 uppercase">
                <tr>
                  <th className="px-2 py-2 text-left">Subclasse</th>
                  <th className="px-2 py-2 text-center hidden sm:table-cell">Origem</th>
                  <th className="px-2 py-2 text-center">Status</th>
                  <th className="px-2 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-darkText divide-y divide-gray-100 dark:divide-gray-700">
                {itensFiltrados.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    <td className="px-2 py-1.5 sm:p-2">
                      <span className="block truncate max-w-[28ch] sm:max-w-none">{sub.nome}</span>
                    </td>
                    <td className="px-2 py-1.5 sm:p-2 text-center hidden sm:table-cell">{sub.usuario_id ? 'Usuário' : 'Padrão'}</td>
                    <td className="px-2 py-1.5 sm:p-2 text-center">{sub.oculto ? 'Oculta' : 'Ativa'}</td>
                    <td className="px-2 py-1.5 sm:p-2">
  {sub.usuario_id == null ? (
    // PADRÃO: só Ocultar/Reexibir
    <>
      {sub.oculto ? (
        classeOculta ? (
          <span
            className="block text-center text-gray-400 italic cursor-not-allowed"
            onClick={() => toast.warn('⚠️ Reexiba a classe primeiro')}
          >
            Reexiba a classe primeiro
          </span>
        ) : (
          <div className="flex items-center justify-center">
            <button
              onClick={() => toggleOcultar(sub)}
              className="inline-flex items-center gap-1 text-green-600 hover:text-green-700"
              aria-label="Reexibir" title="Reexibir"
            >
              <span className="sm:hidden"><Eye className="w-4 h-4" /></span>
              <span className="hidden sm:inline">Reexibir</span>
            </button>
          </div>
        )
      ) : (
        <div className="flex items-center justify-center">
          <button
            onClick={() => toggleOcultar(sub)}
            className="inline-flex items-center gap-1 text-yellow-600 hover:text-yellow-700"
            aria-label="Ocultar" title="Ocultar"
          >
            <span className="sm:hidden"><EyeOff className="w-4 h-4" /></span>
            <span className="hidden sm:inline">Ocultar</span>
          </button>
        </div>
      )}
    </>
  ) : (
    // USUÁRIO: Editar e Excluir (com modal)
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => abrirEdicao(sub)}
        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
        aria-label="Editar" title="Editar"
      >
        <span className="sm:hidden"><Pencil className="w-4 h-4" /></span>
        <span className="hidden sm:inline">Editar</span>
      </button>
      <button
        onClick={() => setSubIdParaExcluir(sub.id)}
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
                  <tr><td className="px-2 py-2 text-center" colSpan={4}>Nenhuma subclasse</td></tr>
                )}
                {carregando && (
                  <tr><td className="px-2 py-2 text-center" colSpan={4}>Carregando...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

 {modalAberto && (
   <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
     <div className="bg-white dark:bg-darkCard rounded-xl shadow-xl w-full max-w-md p-6">
       <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-darkText">
         {editando?.id ? 'Editar Subclasse' : 'Nova Subclasse'}
       </h2>

       <label className="block text-sm mb-1 text-gray-600 dark:text-darkMuted">Nome</label>
       <input
         value={nomeCampo}
         onChange={(e) => setNomeCampo(e.target.value)}
         className="h-10 w-full px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-darkText
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-500/50"
         placeholder="Ex.: Ação BR, Ação EUA, FII Tijolo…"
         autoFocus
       />

       <div className="mt-5 flex justify-end gap-2">
         <button onClick={() => { setModalAberto(false); setEditando(null); setNomeCampo(''); }} className="h-9 px-4 rounded-lg bg-gray-200 dark:bg-gray-700">Cancelar</button>
         <button onClick={salvarModal} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Salvar</button>
       </div>
     </div>
   </div>
 )}

   {subIdParaExcluir && (
   <ModalConfirmacao
     titulo="Excluir Subclasse"
     mensagem="Deseja realmente excluir esta subclasse?"
     onCancelar={() => setSubIdParaExcluir(null)}
     onConfirmar={() => excluirSubclasse(subIdParaExcluir)}
   />
 )}

    </div>
    </RequireFeature>
  );
}