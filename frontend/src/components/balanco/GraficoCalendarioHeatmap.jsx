import React, { useEffect, useMemo, useState, useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext";
import InfoTip from "../ui/InfoTip";
import ModalDespesasDia from "./ModalDespesasDia";

/**
 * Calendário Heatmap (mês selecionado)
 * - Usa /lancamentos/diario?ano=YYYY&mes=MM (mesma rota do Comparador de Períodos)
 * - Pinta os dias pelo valor de DESPESAS diárias (quanto maior o gasto, mais “forte”)
 * - Semana começando na segunda-feira (seg → dom)
 * - Tooltip “leve” embutido
 */
export default function GraficoCalendarioHeatmap({ ano, mes }) {
  const { darkMode } = useContext(ThemeContext);
  const [dados, setDados] = useState([]); // [{data:'YYYY-MM-DD', receitas, despesas}]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [diaSelecionado, setDiaSelecionado] = useState(null); // "YYYY-MM-DD"
  const [open, setOpen] = useState(false);

  // tooltip leve
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, txt: "" });
  const rafRef = React.useRef(null);
  const pendingRef = React.useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const token = localStorage.getItem("token");
        const res = await fetch(
          `/api/lancamentos/diario?ano=${ano}&mes=${String(mes).padStart(2, "0")}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error("Falha ao carregar o diário");
        const arr = await res.json();
        if (!alive) return;
        setDados(Array.isArray(arr) ? arr : []);
      } catch (e) {
        if (!alive) return;
        setErr("Erro ao carregar heatmap diário");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [ano, mes]);

  // Mapa DD -> despesas do dia
  const mapaDespesas = useMemo(() => {
    const m = new Map();
    (dados || []).forEach(d => {
      // d.data em ISO “YYYY-MM-DD” — evitamos new Date() p/ não bagunçar fuso
      const dd = String(d?.data ?? "").slice(8, 10); // "DD"
      const val = Number(d?.despesas || 0);
      if (dd) m.set(Number(dd), val);
    });
    return m;
  }, [dados]);

  // util do mês
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay(); // 0=Dom ... 6=Sáb
  const offsetSegunda = (primeiroDiaSemana + 6) % 7; // segunda=0

  // vetor de células (até 6 semanas x 7 dias)
  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < offsetSegunda; i++) arr.push({ vazio: true });
    for (let dia = 1; dia <= diasNoMes; dia++) {
      arr.push({ dia, valor: mapaDespesas.get(dia) || 0 });
    }
    // completa até múltiplo de 7 (máx. 6 linhas)
    while (arr.length % 7 !== 0) arr.push({ vazio: true });
    return arr;
  }, [diasNoMes, offsetSegunda, mapaDespesas]);

  // escala de cor (5 buckets) baseada no máx do mês
  const max = useMemo(() => {
    let m = 0;
    mapaDespesas.forEach(v => { if (v > m) m = v; });
    return m;
  }, [mapaDespesas]);

  const thresholds = useMemo(() => {
    // 0, 20%, 40%, 65%, 100%
    return [0, max * 0.2, max * 0.4, max * 0.65, max];
  }, [max]);

  function bucket(v) {
    if (!v || v <= 0) return 0;
    if (v <= thresholds[1]) return 1;
    if (v <= thresholds[2]) return 2;
    if (v <= thresholds[3]) return 3;
    return 4;
  }

  // paleta coerente com o sistema (azul), variando para dark
  const PALETTE = darkMode
    ? [
        "rgba(59,130,246,0.10)", // quase zero
        "rgba(59,130,246,0.25)",
        "rgba(59,130,246,0.45)",
        "rgba(59,130,246,0.70)",
        "#3B82F6",               // forte
      ]
    : [
        "#EFF6FF", // blue-50
        "#DBEAFE", // blue-100
        "#93C5FD", // blue-300
        "#60A5FA", // blue-400
        "#2563EB", // blue-600
      ];

  const txtMuted = darkMode ? "text-darkMuted" : "text-gray-500";
  const txtStrong = darkMode ? "text-darkText" : "text-gray-800";
  const border = darkMode ? "dark:border-darkBorder" : "border-gray-100";

  const nomeMes = new Date(0, mes - 1).toLocaleString("pt-BR", { month: "long" });
  const nomeMesCap = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

  const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  const hasAlgumValor = max > 0;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header fixo com título central + InfoTip padronizado */}
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
        <h3 className={`text-base font-semibold ${txtStrong} text-center`}>
          Calendário de Despesas
        </h3>
        <div className="absolute right-0">
          <InfoTip title="Como ler este painel" ariaLabel="Informações do heatmap">
            <ul className="list-disc pl-4 space-y-1">
              <li>Cada quadrado representa um <b>dia do mês</b>.</li>
              <li>Quanto mais <b>escuro</b> o azul, <b>maior</b> o gasto do dia.</li>
              <li>O mês e ano seguem os <b>filtros globais</b> do topo.</li>
              <li>Passe o mouse para ver <b>o valor do dia</b>.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* Área de conteúdo */}
      {/* Área de conteúdo */}
      <div className={`flex-1 min-h-0 rounded-xl border ${border} px-3 py-2 overflow-hidden`}>
        {loading && (
          <div className={`h-full flex items-center justify-center ${txtMuted}`}>
            Carregando…
          </div>
        )}

        {!loading && err && (
          <div className="h-full flex items-center justify-center text-red-600">
            {err}
          </div>
        )}

{!loading && !err && (
  <div className="h-full flex flex-col min-h-0">
    {/* Cabeçalho dos dias da semana (seg → dom) */}
    <div className="grid grid-cols-7 gap-2 mb-1">
      {diasSemana.map((d) => (
        <div key={d} className={`text-xs text-center ${txtMuted}`}>{d}</div>
      ))}
    </div>

    {/* Grade do calendário ocupa TODO o espaço disponível */}
    <div className="flex-1 min-h-0 grid grid-cols-7 [grid-template-rows:repeat(6,minmax(0,1fr))] gap-2">
      {cells.map((c, idx) => {
        if (c.vazio) {
          return (
            <div
              key={idx}
              className={`rounded-lg border ${border} opacity-40 h-full w-full`}
            />
          );
        }
        const nivel = bucket(c.valor);
        const bg = PALETTE[nivel];
        const dataISO = `${ano}-${String(mes).padStart(2,"0")}-${String(c.dia).padStart(2,"0")}`;
        return (
          <div
            key={idx}
            className="rounded-lg relative cursor-pointer flex items-end justify-end p-1 h-full w-full"
            style={{ background: bg }}
            onClick={() => { setDiaSelecionado(dataISO); setOpen(true); }}
            role="gridcell"
   aria-label={`${String(c.dia).padStart(2,"0")}/${String(mes).padStart(2,"0")}/${ano} — ${ (Number(c.valor)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) }`}
            onMouseMove={(e) => {
              const valorFmt = (Number(c.valor)||0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
              pendingRef.current = {
                show: true,
                x: e.clientX + 12,
                y: e.clientY + 12,
                txt: `${String(c.dia).padStart(2,"0")}/${String(mes).padStart(2,"0")}/${ano} — ${valorFmt}`
              };
              if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(() => {
                  setTip(pendingRef.current);
                  rafRef.current = null;
                });
              }
            }}
            onMouseLeave={() => setTip(s => ({ ...s, show:false }))}
          >
            <span className={`text-[10px] font-medium ${darkMode ? "text-white/80" : "text-gray-800/80"}`}>
              {c.dia}
            </span>
          </div>
        );
      })}
    </div>

    {/* Legenda grudada no rodapé do card */}
    <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
      <div className={`text-xs ${txtMuted}`}>
        {hasAlgumValor
          ? "Escala baseada no maior gasto diário do mês."
          : "Sem despesas registradas neste mês."}
      </div>
      <div className="flex items-center gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-md" style={{ background: PALETTE[i] }} />
          </div>
        ))}
        <span className={`text-xs ml-1 ${txtMuted}`}>menor → maior</span>
      </div>
    </div>
  </div>
)}
      </div>

      {/* Tooltip absoluto simples */}
      {tip.show && (
        <div
          className={`fixed z-50 text-xs px-2 py-1 rounded-md border ${darkMode ? "bg-darkCard border-darkBorder text-darkText" : "bg-white border-gray-200 text-gray-800"} shadow`}
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.txt}
        </div>
      )}

      
      {/* Drawer com a lista do dia */}
      <ModalDespesasDia
        open={open}
        onClose={() => setOpen(false)}
        dataISO={diaSelecionado}
      />

    </div>
  );
}