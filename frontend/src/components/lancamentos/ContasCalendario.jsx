// src/components/lancamentos/ContasCalendario.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Props:
 * - ano (number)
 * - mes (1-12)
 * - items: [{ id, descricao, valor, data_vencimento: 'YYYY-MM-DD', status: 'pendente'|'pago'|'vencido', forma_pagamento }]
 *   Obs: Se preferir, pode ser Date real em data_vencimento.
 */
export default function ContasCalendario({ ano, mes, items = [] }) {
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' do mês corrente
  const start = useMemo(() => new Date(ano, mes - 1, 1), [ano, mes]);
  const end = useMemo(() => new Date(ano, mes, 0), [ano, mes]);
  const todayISO = format(new Date(), "yyyy-MM-dd");

  // mapa por dia (yyyy-MM-dd) => lista de lançamentos
  const byDay = useMemo(() => {
    const map = {};
    for (const it of items) {
      const iso = toISO(it.data_vencimento);
      if (!iso) continue;
      const d = new Date(iso);
      if (d.getFullYear() === ano && d.getMonth() === mes - 1) {
        map[iso] ??= [];
        map[iso].push(it);
      }
    }
    return map;
  }, [items, ano, mes]);

  // gera 35 células (5 semanas) — simples e robusto
  const cells = useMemo(() => {
    const firstDow = (start.getDay() + 6) % 7; // segunda=0
    const totalDays = end.getDate();
    const arr = [];
    for (let i = 0; i < 35; i++) {
      const dayNum = i - firstDow + 1;
      const inMonth = dayNum >= 1 && dayNum <= totalDays;
      let dateISO = null;
      if (inMonth) {
        dateISO = format(new Date(ano, mes - 1, dayNum), "yyyy-MM-dd");
      }
      arr.push({ inMonth, dayNum: inMonth ? dayNum : null, dateISO });
    }
    return arr;
  }, [start, end, ano, mes]);

  function statusCounts(list = []) {
    let pend = 0, pago = 0, venc = 0;
    for (const l of list) {
      if (l.status === "pago") pago++;
      else if (l.status === "vencido") venc++;
      else pend++;
    }
    return { pend, pago, venc };
  }

  const monthLabel = format(start, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-2 text-sm">
          <LegendDot className="bg-red-500/80" /> Vencido
          <LegendDot className="bg-yellow-500/80" /> Pendente
          <LegendDot className="bg-emerald-600/80" /> Pago
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground">
        {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
          <div key={d} className="text-center">{d}</div>
        ))}
      </div>

      {/* Grid 7x5 */}
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          const dayItems = c.dateISO ? byDay[c.dateISO] ?? [] : [];
          const { pend, pago, venc } = statusCounts(dayItems);
          const isToday = c.dateISO === todayISO;
          return (
            <button
              key={idx}
              disabled={!c.inMonth}
              onClick={() => c.inMonth && setSelectedDay(c.dateISO)}
              className={[
                "min-h-[96px] rounded-2xl border p-2 text-left transition",
                c.inMonth ? "bg-card hover:shadow-md" : "opacity-30 pointer-events-none",
                isToday ? "border-emerald-500" : "border-border"
              ].join(" ")}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold">{c.dayNum ?? ""}</span>
                {isToday && <span className="rounded-full px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">hoje</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {venc > 0 && <Badge color="red">{venc} v</Badge>}
                {pend > 0 && <Badge color="yellow">{pend} p</Badge>}
                {pago > 0 && <Badge color="emerald">{pago} pg</Badge>}
              </div>
              {dayItems.length > 0 && (
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {dayItems.slice(0,2).map(x => x.descricao).join(" • ")}
                  {dayItems.length > 2 ? " • ..." : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Drawer simples */}
      {selectedDay && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedDay(null)} />
          <div className="w-full max-w-md bg-background shadow-2xl p-4 overflow-auto">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {format(new Date(selectedDay), "dd 'de' MMMM", { locale: ptBR })}
              </h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setSelectedDay(null)}>✕</button>
            </div>
            <div className="space-y-2">
              {(byDay[selectedDay] ?? []).map(l => (
                <div key={l.id} className="rounded-xl border p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{l.descricao}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.forma_pagamento} • {formatCurrency(l.valor)}
                    </div>
                  </div>
                  <span className={chipClass(l.status)}>{labelStatus(l.status)}</span>
                </div>
              ))}
            </div>

            {(byDay[selectedDay] ?? []).length > 0 && (
              <div className="mt-4 flex gap-2">
                <button className="rounded-xl px-3 py-2 bg-emerald-600 text-white hover:opacity-90">
                  Pagar todos
                </button>
                <button className="rounded-xl px-3 py-2 bg-amber-600 text-white hover:opacity-90">
                  Marcar pendentes
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function toISO(d) {
  if (!d) return null;
  if (typeof d === "string") return d.length === 10 ? d : d.slice(0,10);
  try { return format(new Date(d), "yyyy-MM-dd"); } catch { return null; }
}

function formatCurrency(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function LegendDot({ className = "" }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}

function Badge({ children, color }) {
  const map = {
    red: "bg-red-500/15 text-red-600 dark:text-red-400",
    yellow: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${map[color]}`}>{children}</span>
  );
}

function labelStatus(s) {
  if (s === "pago") return "Pago";
  if (s === "vencido") return "Vencido";
  return "Pendente";
}

function chipClass(s) {
  if (s === "pago") return "text-xs rounded-full px-2 py-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (s === "vencido") return "text-xs rounded-full px-2 py-1 bg-red-500/15 text-red-600 dark:text-red-400";
  return "text-xs rounded-full px-2 py-1 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
}