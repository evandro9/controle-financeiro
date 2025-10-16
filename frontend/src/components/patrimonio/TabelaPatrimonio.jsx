import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, AlertTriangle, X } from 'lucide-react';
import { HiTrash } from 'react-icons/hi';
import InfoTip from '../ui/InfoTip';
import ScrollArea from "../ui/ScrollArea";

const fmtBRL = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function TabelaPatrimonio({
  titulo = 'Saldos por Conta',
  subtitulo = 'Valores por mês no ano selecionado',
  contas = [],
  mesesHeader = [],
  MESES = [],
  mesSelecionado = null,
  saldoDaCelula,              // (contaId:number, mes:number) => number
  totalPorMes = {},           // { [mes:number]: number }
  evolucaoPorMes = {},        // { [mes:number]: number }
  onExcluirConta,             // (id:number, nome:string) => Promise<void> | void
  onRenomearConta,            // (id:number, novoNome:string) => Promise<void> | void
}) {
  const headerCols = useMemo(
    () => mesesHeader.map((m, i) => ({ mes: m, label: MESES[i] ?? m })),
    [mesesHeader, MESES]
  );

const [menuOpenId, setMenuOpenId] = useState(null);
const [menuAnchor, setMenuAnchor] = useState({ id: null, top: 0, left: 0 });
// Fecha ao clicar fora de QUALQUER dropdown da tabela
useEffect(() => {
  const closeOnOutside = (e) => {
    const target = e.target;
    // Se clicou dentro de um container marcado como menu, não fecha
    if (target && typeof target.closest === 'function') {
     // ignora cliques dentro do botão/td e também dentro do MENU no portal
     if (target.closest('[data-patri-menu="1"]')) return;
     if (target.closest('[data-patri-menu-portal="1"]')) return;
    }
    setMenuOpenId(null);
  };
  document.addEventListener('mousedown', closeOnOutside);
  return () => document.removeEventListener('mousedown', closeOnOutside);
}, []);

useEffect(() => {
  if (!menuOpenId) return;
  const close = () => setMenuOpenId(null);
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);
  return () => {
    window.removeEventListener('scroll', close, true);
    window.removeEventListener('resize', close);
  };
}, [menuOpenId]);

// Modais / Estados de ação
const [confirm, setConfirm] = useState({ open: false, id: null, nome: '' });
// Renomear inline (duplo clique continua funcionando)
const [editingId, setEditingId] = useState(null);
const [editingNome, setEditingNome] = useState('');
const inputRef = useRef(null);
useEffect(() => { if (editingId) inputRef.current?.focus(); }, [editingId]);
// Modal de renomear (quando vier do menu)
const [rename, setRename] = useState({ open: false, id: null, nome: '' });
const renameInputRef = useRef(null);
useEffect(() => { if (rename.open) renameInputRef.current?.focus(); }, [rename.open]);
                      

  const openConfirm = (id, nome) => { setConfirm({ open: true, id, nome }); setMenuOpenId(null); };
  const closeConfirm = () => setConfirm({ open: false, id: null, nome: '' });

const startInlineRename = (id, nome) => {
  // Edição direta (ex.: duplo clique na célula)
  setEditingId(id);
  setEditingNome(nome);
  setMenuOpenId(null);
};
const openRename = (id, nome) => { setRename({ open: true, id, nome }); setMenuOpenId(null); };
const closeRename = () => setRename({ open: false, id: null, nome: '' });
const handleSaveRename = async () => {
  const novo = (rename.nome || '').trim();
  if (!novo) { closeRename(); return; }
  try { await onRenomearConta?.(rename.id, novo); }
  finally { closeRename(); }
};
const cancelInlineRename = () => { setEditingId(null); setEditingNome(''); };
const commitInlineRename = async () => {
  const novo = (editingNome || '').trim();
  if (!novo || !editingId) { cancelInlineRename(); return; }
  try { await onRenomearConta?.(editingId, novo); }
  finally { cancelInlineRename(); }
};

  const handleConfirmDelete = async () => {
    try { await onExcluirConta?.(confirm.id, confirm.nome); }
    finally { closeConfirm(); }
  };

  // classe da coluna ativa (para TODAS as linhas)
  const activeColCls = 'bg-emerald-50 outline outline-1 outline-emerald-200 dark:bg-emerald-900/20 dark:outline-emerald-800';

  return (
    <div className="bg-white dark:bg-darkCard rounded-xl shadow border border-gray-100 dark:border-darkBorder">
      {/* Header: título central + i padronizado (sem subtítulo) */}
      <div className="px-4 pt-4">
        <div className="h-[36px] flex items-center justify-center mb-2 relative">
          <h3 className="text-lg font-semibold text-center text-gray-800 dark:text-darkText">
            {titulo}
          </h3>
          <div className="absolute right-0 z-[120]">
            <InfoTip title="Sobre esta tabela" ariaLabel="Informações da tabela" width="w-80">
              <ul className="list-disc pl-4 space-y-1">
                <li>Exibe os <b>saldos por conta</b> mês a mês.</li>
                <li>A coluna destacada indica o <b>mês selecionado</b>.</li>
                <li>Use o menu ⋮ para <b>renomear</b> ou <b>excluir</b> uma conta.</li>
                <li>Linhas “Total” e “Evolução” mostram agregados do período.</li>
              </ul>
            </InfoTip>
          </div>
        </div>
      </div>

<ScrollArea axis="x" className="rounded-lg">
  <table className="min-w-full text-sm table-fixed">
          <thead className="sticky top-0 z-10">
            <tr className="text-gray-800 dark:text-darkText bg-gray-50 border-b border-gray-200
                           dark:bg-darkBorder dark:border-white/10">
<th
  className="sticky left-0 z-40 p-3 text-left
             w-[11ch] min-w-[11ch] max-w-[11ch]
             bg-gray-50 dark:bg-darkBorder overflow-hidden whitespace-nowrap"
  title="Conta"
>
  <span className="block truncate">Conta</span>
</th>
              {headerCols.map(({ mes, label }) => (
                <th
                  key={mes}
                  className={`p-3 text-center ${mes === mesSelecionado ? activeColCls : ''}`}
                >
                  {label}
                </th>
              ))}
 <th
   className="sticky right-0 z-50 p-3 text-center w-20
              bg-gray-50 dark:bg-darkBorder"
 >
   Ações
 </th>
            </tr>
          </thead>

          <tbody className="text-gray-800 dark:text-darkText">
            {(contas || []).map((c, idx) => (
              <tr
                key={c.id}
 className={`border-t border-gray-100 dark:border-white/10
            ${idx % 2 === 1 ? 'bg-gray-50 dark:bg-darkBg' : ''}`}
              >
                {/* Conta (à esquerda) */}
<td
  className={`sticky left-0 z-30 p-3 font-medium text-left
    w-[13ch] min-w-[13ch] max-w-[13ch] overflow-hidden whitespace-nowrap
    ${idx % 2 === 1 ? 'bg-gray-50 dark:bg-darkBg' : 'bg-white dark:bg-darkCard'}
    border-r border-gray-200/60 dark:border-white/10
    shadow-[inset_-10px_0_10px_-10px_rgba(0,0,0,0.35)]
  `}
>
  {editingId === c.id ? (
    <input
      autoFocus
      ref={inputRef}
      value={editingNome}
      onChange={(e) => setEditingNome(e.target.value)}
      onBlur={commitInlineRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitInlineRename();
        if (e.key === 'Escape') cancelInlineRename();
      }}
      className="w-full rounded-md border px-2 py-1 bg-white dark:bg-darkBg
                 text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder"
    />
  ) : (
    <span
      className="block truncate"
      title={c.nome}               // tooltip nativo com o nome completo
      onDoubleClick={() => startInlineRename(c.id, c.nome)}
    >
      {c.nome}
    </span>
  )}
</td>

 {headerCols.map(({ mes }) => {
   // Normaliza: "01" -> 1, "12" -> 12
   const mesNum = typeof mes === 'string' ? parseInt(mes, 10) : mes;
   const valor = Number(saldoDaCelula?.(c.id, mesNum) ?? 0);
                  const isActive = mes === mesSelecionado;
                  return (
                    <td
                      key={`${c.id}-${mes}`}
                      className={`p-2 text-center ${isActive ? activeColCls : ''}`}
                    >
                      {fmtBRL(valor)}
                    </td>
                  );
                })}

               {/* Ações – menu ⋮ */}
 <td
   className={`sticky right-0 z-40 p-2 text-center
     ${idx % 2 === 1
       ? 'bg-gray-50 dark:bg-darkBg'   // MESMO fundo da zebra clara (sólido)
       : 'bg-white dark:bg-darkCard'   // MESMO fundo da linha normal (sólido)
     }
     border-l border-gray-200/60 dark:border-white/10
     shadow-[inset_10px_0_10px_-10px_rgba(0,0,0,0.35)]`}
 >
                  <div className="relative inline-block" data-patri-menu="1">
                    <button
                      type="button"
 onClick={(e) => {
  const r = e.currentTarget.getBoundingClientRect();
   // largura do menu ~160px; ancorado à direita do botão e 8px abaixo
   const width = 160;
   const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width));
   const top = Math.min(window.innerHeight - 8, r.bottom + 8);
   setMenuAnchor({ id: c.id, top, left });
   setMenuOpenId(menuOpenId === c.id ? null : c.id);
 }}
                      className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100
                                 focus:outline-none focus:ring-2 focus:ring-emerald-200
                                 dark:text-darkMuted dark:hover:text-darkText dark:hover:bg-white/5 dark:focus:ring-emerald-500/30"
                      title="Ações"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

 {menuOpenId === c.id && menuAnchor.id === c.id &&
   // PORTAL: menu fora do scroll container, sem clipping
   createPortal(
  <div
     data-patri-menu-portal="1"
     onMouseDown={(e) => e.stopPropagation()}
       style={{ position: 'fixed', top: menuAnchor.top, left: menuAnchor.left, width: 160 }}
       className="rounded-lg border bg-white shadow-lg z-[9999]
                  border-gray-200 dark:border-white/10 dark:bg-darkCard"
     >
       <button
         type="button"
         className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50
                    dark:text-darkText dark:hover:bg-white/5"
         onClick={(e) => {
           e.preventDefault(); e.stopPropagation();
           setMenuOpenId(null);           // fecha o menu
           openRename(c.id, c.nome);
         }}
       >
         <Pencil className="w-4 h-4" /> Renomear
       </button>
       <button
         type="button"
         className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50
                    dark:text-red-400 dark:hover:bg-red-900/20"
         onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); openConfirm(c.id, c.nome); }}
       >
         <HiTrash className="w-4 h-4" /> Excluir
       </button>
     </div>,
     document.body
   )
 }
                  </div>
                </td>
              </tr>
            ))}

            {/* TOTAL */}
            <tr className="border-t bg-gray-50 dark:bg-gray-900 font-semibold border-gray-200 dark:border-white/10">
<td className="sticky left-0 z-30 p-3 text-left bg-inherit
               w-[13ch] min-w-[13ch] max-w-[13ch] overflow-hidden whitespace-nowrap
               border-r border-gray-200/60 dark:border-white/10
               shadow-[inset_-10px_0_10px_-10px_rgba(0,0,0,0.35)]">
  <span className="block truncate" title="Total">Total</span>
</td>
              {headerCols.map(({ mes }) => (
                <td
                  key={`total-${mes}`}
                  className={`p-2 text-center ${mes === mesSelecionado ? activeColCls : ''}`}
                >
                  {fmtBRL(totalPorMes[mes] || 0)}
                </td>
              ))}
 <td
   className="sticky right-0 z-30 p-2 text-center bg-inherit
              border-l border-gray-200/60 dark:border-white/10
              shadow-[inset_10px_0_10px_-10px_rgba(0,0,0,0.35)]"
 >
   —
 </td>
            </tr>

            {/* EVOLUÇÃO – destaque maior */}
<tr className="border-t border-gray-200 dark:border-white/10 bg-amber-50 dark:bg-darkCard">
<td className="sticky left-0 z-30 p-3 text-left font-medium
               text-gray-700 dark:text-darkText bg-inherit
               w-[13ch] min-w-[13ch] max-w-[13ch] overflow-hidden whitespace-nowrap
               border-r border-gray-200/60 dark:border-white/10
               shadow-[inset_-10px_0_10px_-10px_rgba(0,0,0,0.35)]">
  <span className="block truncate" title="Evolução">Evolução</span>
</td>
              {headerCols.map(({ mes }) => {
                const tx = evolucaoPorMes[mes];
                const cor = (tx ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500';
                return (
                  <td
                    key={`evo-${mes}`}
                    className={`p-2 text-center font-medium ${cor} ${mes === mesSelecionado ? activeColCls : ''}`}
                  >
                    {tx == null ? '—' : `${(tx * 100).toFixed(2)}%`}
                  </td>
                );
              })}
<td
   className="sticky right-0 z-40 p-2 text-center
              bg-amber-50 dark:bg-darkCard
              border-l border-gray-200/60 dark:border-white/10
              shadow-[inset_10px_0_10px_-10px_rgba(0,0,0,0.35)]"
 >—</td>
            </tr>
          </tbody>
        </table>
        </ScrollArea>

      {/* Modal EXCLUIR */}
      {confirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeConfirm} />
          <div className="relative w-full max-w-sm bg-white dark:bg-darkCard rounded-xl shadow p-5
                          border border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="text-base font-semibold">Excluir conta</h4>
            </div>
            <p className="text-sm text-gray-700 dark:text-darkText mb-4">
              Tem certeza que deseja excluir a conta <span className="font-semibold">{confirm.nome}</span>?<br />
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={closeConfirm}
                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10
                           text-gray-700 dark:text-darkText hover:bg-gray-100 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
            <button
              onClick={closeConfirm}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
              aria-label="Fechar"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-darkMuted" />
            </button>
          </div>
        </div>
      )}

      {/* Modal RENOMEAR */}
      {rename.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeRename} />
          <div className="relative w-full max-w-sm bg-white dark:bg-darkCard rounded-xl shadow p-5
                          border border-gray-200 dark:border-white/10">
            <h4 className="text-base font-semibold mb-3 text-gray-800 dark:text-darkText">Renomear conta</h4>
            <input
              ref={renameInputRef}
              value={rename.nome}
              onChange={(e) => setRename({ ...rename, nome: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') closeRename(); }}
              className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 mb-4
                         bg-white dark:bg-darkBg text-gray-800 dark:text-darkText
                         focus:outline-none focus:ring focus:ring-emerald-200 dark:focus:ring-emerald-500/30"
              placeholder="Novo nome da conta"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={closeRename}
 className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10
            text-gray-700 dark:text-darkText hover:bg-gray-100 dark:hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRename}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Salvar
              </button>
            </div>
            <button
              onClick={closeRename}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
              aria-label="Fechar"
            >
              <X className="w-4 h-4 text-gray-500 dark:text-darkMuted" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}