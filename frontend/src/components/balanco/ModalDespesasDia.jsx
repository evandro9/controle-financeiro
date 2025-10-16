import React, { useEffect, useMemo, useState } from "react";

/**
 * Drawer lateral com a lista de despesas de um dia (YYYY-MM-DD).
 * Fechamento: X, ESC, clicar no backdrop.
 * Endpoint: ajuste a URL se necessário (placeholder abaixo).
 */
export default function ModalDespesasDia({ open, onClose, dataISO }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const dataFmtBR = useMemo(() => {
    if (!dataISO) return "";
    const [y, m, d] = dataISO.split("-");
    return `${d}/${m}/${y}`;
  }, [dataISO]);

  useEffect(() => {
    if (!open || !dataISO) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const token = localStorage.getItem("token");

        // >>> Ajuste esta URL conforme seu backend:
        // opção A que muitos usam no seu projeto:
        //   /lancamentos?ano=YYYY&mes=MM&dia=DD&tipo=despesa
        // opção B (criada especificamente p/ este modal):
        //   /lancamentos/por-dia?data=YYYY-MM-DD&tipo=despesa
        const [y, m, d] = dataISO.split("-");
 const url =
   `/api/lancamentos/por-dia?data=${dataISO}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Falha ao carregar despesas do dia");
        const arr = await res.json();
        if (!alive) return;
 let lista = Array.isArray(arr) ? arr : [];
 lista = lista.filter(it => (it.tipo || '').toLowerCase() === 'despesa');
 setItens(lista);
      } catch (e) {
        if (!alive) return;
        setErr("Não foi possível carregar as despesas deste dia.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, dataISO]);

  // total do dia (só despesas, já filtrado)
  const total = useMemo(() =>
    (itens || []).reduce((acc, it) => acc + Number(it.valor || 0), 0), [itens]
  );

  // fechar via ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => (e.key === "Escape") && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const money = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[80] transition ${open ? "visible bg-black/40" : "invisible bg-black/0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md z-[81] transform transition-transform
        bg-white dark:bg-darkCard border-l border-gray-200 dark:border-darkBorder
        ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Despesas em ${dataFmtBR}`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-darkBorder flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800 dark:text-darkText">
            Despesas em {dataFmtBR}
          </h3>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded-md text-sm text-gray-500 hover:bg-gray-100 dark:text-darkMuted dark:hover:bg-white/5"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="h-[calc(100%-8rem)] overflow-auto px-5 py-4">
          {loading && (
            <div className="text-sm text-gray-500 dark:text-darkMuted">Carregando…</div>
          )}
          {!loading && err && (
            <div className="text-sm text-red-600">{err}</div>
          )}
          {!loading && !err && itens.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-darkMuted">
              Nenhuma despesa registrada neste dia.
            </div>
          )}

          {!loading && !err && itens.length > 0 && (
            <ul className="space-y-2">
              {itens.map((it) => (
                <li
                  key={it.id ?? `${it.categoria}-${it.subcategoria}-${it.valor}-${it.data_lancamento}`}
                  className="border border-gray-100 dark:border-darkBorder rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-darkText truncate">
                      {it.subcategoria_nome || it.subcategoria || it.descricao || "Despesa"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-darkMuted">
                      {it.categoria_nome || it.categoria || "—"} • {it.forma_pagamento_nome || it.forma_pagamento || "Forma de pagamento"}
                      {it.status ? ` • ${it.status}` : ""}
                    </div>
                  </div>
                  <div className="ml-3 text-sm font-semibold text-gray-800 dark:text-darkText">
                    {money(it.valor)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="h-24 px-5 py-4 border-t border-gray-100 dark:border-darkBorder flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-darkMuted">Total do dia</span>
          <span className="text-base font-semibold text-gray-900 dark:text-darkText">
            {money(total)}
          </span>
        </div>
      </aside>
    </>
  );
}