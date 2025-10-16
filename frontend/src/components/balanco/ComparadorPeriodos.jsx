import React, { useEffect, useMemo, useState, useContext } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line
} from "recharts";
import { ThemeContext } from "../../context/ThemeContext";
import InfoTip from "../ui/InfoTip";
import ChartTooltip from "../ui/ChartTooltip";

const COLORS = {
  // mesmas cores do GraficoLinhaMensal (receitas/despesas)
  linhaReceitaLight: "#0072B2",  // receitas (modo claro)
  linhaReceitaDark:  "#58a6ff",  // receitas (modo escuro)
  linhaDespesaLight: "#D55E00",  // despesas (modo claro)
  linhaDespesaDark:  "#f78166",  // despesas (modo escuro)
  azulBarra: "#3B82F6",
  tickLight: "#374151",
  tickDark: "#9CA3AF",
};
export default function ComparadorPeriodos({ ano, mes }) {
  const alvo = { ano, mes };
  const anterior = prevMonth(ano, mes);
  const anoPassado = { ano: ano - 1, mes };
  const { darkMode } = useContext(ThemeContext);

  const [data, setData] = useState({ alvo:null, anterior:null, anoPassado:null, loading:false, error:null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setData(s => ({ ...s, loading: true, error: null }));
        const [dAlvo, dAnt, dAP] = await Promise.all([
          fetchDataset(alvo.ano, alvo.mes),
          fetchDataset(anterior.ano, anterior.mes),
          fetchDataset(anoPassado.ano, anoPassado.mes),
        ]);
        if (!alive) return;
        setData({
          alvo: normalizeEmpty(dAlvo),
          anterior: normalizeEmpty(dAnt),
          anoPassado: isEmptyDataset(dAP) ? null : dAP, // 👈 oculta a terceira coluna se vazio
          loading: false,
          error: null
        });
      } catch (err) {
        if (!alive) return;
        setData(s => ({ ...s, loading: false, error: "Falha ao carregar comparador" }));
      }
    })();
    return () => { alive = false; };
  }, [ano, mes]);

  const cols = useMemo(() => {
    const base = [
      { key: "anterior", title: labelPeriodo(anterior.ano, anterior.mes) }, // esquerda
      { key: "alvo", title: labelPeriodo(alvo.ano, alvo.mes) },             // centro/direita
    ];
    if (data.anoPassado) {
      // quando existe ano anterior: esquerda=anterior, meio=alvo, direita=anoPassado
      base.push({ key: "anoPassado", title: labelPeriodo(anoPassado.ano, anoPassado.mes) });
    }
    return base;
  }, [ano, mes, data.anoPassado]);

  return (
    <div className="rounded-xl border border-gray-100 dark:border-darkBorder bg-white dark:bg-darkCard p-4">
  <div className="mb-3 h-[36px] flex items-center justify-center relative">
    <h3 className="text-base font-semibold text-gray-800 dark:text-darkText text-center">
      Comparador de Períodos
    </h3>
    <div className="absolute right-0">
      <InfoTip title="Como ler este painel" ariaLabel="Informações do componente">
        <ul className="list-disc pl-4 space-y-1">
          <li>Compara o mês <b>selecionado</b> com o <b>mês anterior</b>{data.anoPassado ? " e o <b>mesmo mês do ano anterior</b>" : ""}.</li>
          <li>À esquerda ficam os <b>cards</b> (Receitas, Despesas e Saldo).</li>
          <li><b>Top categorias</b> usa o azul padrão do sistema.</li>
          <li>O gráfico <b>diário</b> é <b>acumulado</b>, para leitura crescente do mês.</li>
        </ul>
      </InfoTip>
    </div>
  </div>

      {data.loading && (
        <div className="py-10 text-center text-gray-500 dark:text-darkMuted">Carregando…</div>
      )}

      {!data.loading && data.error && (
        <div className="py-10 text-center text-red-600">{data.error}</div>
      )}

      {!data.loading && !data.error && (
        <div className={`grid gap-4 md:grid-cols-${data.anoPassado ? "3" : "2"}`}>
          {cols.map(c => {
            const d = data[c.key];
            if (!d) {
              return (
                <div key={c.key} className="rounded-2xl border border-gray-100 dark:border-darkBorder p-4">
                  <div className="mb-2 text-sm text-gray-600 dark:text-darkMuted">{c.title}</div>
                  <div className="h-[280px] flex items-center justify-center text-gray-500 dark:text-darkMuted">Sem dados</div>
                </div>
              );
            }
            const { resumo, porCategoria, linha } = d;
            const pctPlanejado = percent(resumo.realizado, resumo.planejado);

            return (
              <div key={c.key} className="rounded-2xl border border-gray-100 dark:border-darkBorder p-4 bg-white dark:bg-transparent">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-darkMuted">{c.title}</div>
                  <SemaforoMini planejado={resumo.planejado} realizado={resumo.realizado} />
                </div>

                {/* Cards */}
                <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
                  <SmallCard label="Receitas" value={resumo.receitas} tone="emerald" />
                  <SmallCard label="Despesas" value={resumo.despesas} tone="red" />
                  <SmallCard label="Saldo" value={resumo.saldo} tone="indigo" />
                </div>

                {/* Top categorias — tooltip no padrão da casa */}
                <div className="mb-3">
                  <div className="mb-1 text-xs font-medium text-gray-700 dark:text-darkText">Top categorias</div>
                  <div className="h-36">
  {/* Top categorias */}
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={porCategoria.slice(0,6)}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={darkMode ? 0.2 : 0.3}/>
                        <XAxis
                          dataKey="categoria"
                          tick={{ fontSize: 10, fill: darkMode ? COLORS.tickDark : COLORS.tickLight }}
                        />
                        <YAxis
                          tickFormatter={formatCurrency}
                          tick={{ fontSize: 10, fill: darkMode ? COLORS.tickDark : COLORS.tickLight }}
                        />
                        <Tooltip
                          content={
                            <ChartTooltip
                              darkMode={darkMode}
                              valueFormatter={formatCurrency}
                            />
                          }
                          cursor={{ fill: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(17,24,39,0.04)' }}
                        />
                        <Bar dataKey="valor" radius={[8,8,0,0]} fill={COLORS.azulBarra} />
    </BarChart>
  </ResponsiveContainer>
                  </div>
                </div>

                {/* Linha diária receitas x despesas — tooltip padrão e dados reais se disponíveis */}
                <div>
                  <div className="mb-1 text-xs font-medium text-gray-700 dark:text-darkText">Receitas x Despesas (diário)</div>
                  <div className="h-36">
{/* Linha diária receitas x despesas */}
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={linha}>
                              <CartesianGrid strokeDasharray="3 3" strokeOpacity={darkMode ? 0.2 : 0.3}/>
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: darkMode ? COLORS.tickDark : COLORS.tickLight }}
                        />
                        <YAxis
                          tickFormatter={formatCurrency}
                          tick={{ fontSize: 10, fill: darkMode ? COLORS.tickDark : COLORS.tickLight }}
                        />
                        <Tooltip
                          content={
                            <ChartTooltip
                              darkMode={darkMode}
                              labelFormatter={formatLabelDia}
                              valueFormatter={formatCurrency}
                            />
                          }
                          cursor={{ stroke: darkMode ? '#ffffff' : '#111827', strokeOpacity: 0.06, strokeWidth: 36 }}
                        />
                        <Line
                          type="monotone"
                          name="Receitas"
                          dataKey="receitas"
                          dot={false}
                          strokeWidth={2}
                          stroke={darkMode ? COLORS.linhaReceitaDark : COLORS.linhaReceitaLight}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          name="Despesas"
                          dataKey="despesas"
                          dot={false}
                          strokeWidth={2}
                          stroke={darkMode ? COLORS.linhaDespesaDark : COLORS.linhaDespesaLight}
                          activeDot={{ r: 4 }}
                        />
    </LineChart>
  </ResponsiveContainer>
                  </div>
                </div>

                {/* Rodapé: % do planejado */}
                <div className="mt-3 text-xs text-gray-600 dark:text-darkMuted">
                  Planejado consumido: <b>{isNaN(pctPlanejado) ? "-" : `${pctPlanejado.toFixed(0)}%`}</b>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===== Helpers de dados (usam tuas rotas) ===== */

async function fetchDataset(ano, mes) {
  const token = localStorage.getItem('token');

  // 1) receitas/despesas/saldo do mês (usa tua rota anual e escolhe o mês)
  const resumoMensal = await fetch(`/api/lancamentos/resumo-mensal?ano=${ano}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  const alvo = Array.isArray(resumoMensal)
    ? resumoMensal.find(r => parseInt(r.mes, 10) === parseInt(mes, 10))
    : null;

  const receitas = Number(alvo?.receita || 0);
  const despesas = Number(alvo?.despesa || 0);
  const saldo = receitas - despesas;

  // 2) planejado/realizado do mês
  const pr = await fetch(`/api/planejamentos/resumo?ano=${ano}&mes=${String(mes).padStart(2,'0')}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  let planejado = 0, realizado = 0;
  (Array.isArray(pr) ? pr : []).forEach(item => {
    planejado += Number(item?.valor_planejado || 0);
    realizado += Number(item?.valor_realizado || 0);
  });

  // 3) despesas por categoria do mês
  const cats = await fetch(`/api/lancamentos/despesas-por-categoria?ano=${ano}&mes=${String(mes).padStart(2,'0')}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  const porCategoria = (Array.isArray(cats) ? cats : []).map(c => ({
    categoria: c.categoria ?? c.categoria_nome ?? c.nome ?? "Categoria",
    valor: Number(c.valor ?? c.total ?? 0),
  }));

  // 4) linha diária — tenta endpoint real; se não houver, usa fallback
  let linha = [];
try {
  const diario = await fetch(`/api/lancamentos/diario?ano=${ano}&mes=${String(mes).padStart(2,'0')}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (diario.ok) {
    const arr = await diario.json(); // [{data:'YYYY-MM-DD', receitas, despesas}]
    let accR = 0, accD = 0;
    linha = (Array.isArray(arr) ? arr : []).map(d => {
      accR += Number(d.receitas || 0);
      accD += Number(d.despesas || 0);
      return {
        // ⚠️ Nada de new Date(): evita “voltar” pro dia anterior por fuso
        label: String(d.data).slice(8,10), // "DD" para o eixo X
        raw: d.data,                       // mantém ISO se precisar no tooltip
        receitas: accR,
        despesas: accD,
      };
    });
  }
} catch {
    // ignora — cai no fallback abaixo
  }
  if (linha.length === 0) {
    // fallback: 4 pontos proporcionais — não quebra a UI
    linha = [
      { label: "01", receitas: receitas * 0.25, despesas: despesas * 0.25 },
      { label: "10", receitas: receitas * 0.50, despesas: despesas * 0.50 },
      { label: "20", receitas: receitas * 0.75, despesas: despesas * 0.75 },
      { label: "30", receitas, despesas },
    ];
  }

  return {
    resumo: { receitas, despesas, saldo, planejado, realizado },
    porCategoria,
    linha,
  };
}

/* ===== Utils ===== */

function prevMonth(ano, mes) {
  const d = new Date(ano, mes - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}
function labelPeriodo(ano, mes) {
  const nome = new Date(0, mes - 1).toLocaleString("pt-BR", { month: "long" });
  return `${capitalize(nome)} / ${ano}`;
}
function capitalize(s) { return String(s||"").charAt(0).toUpperCase() + String(s||"").slice(1); }
function percent(a, b) { return b ? (Number(a)/Number(b))*100 : NaN; }
function formatCurrency(v) {
  return (Number(v)||0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDiaCurto(iso) {
  try { const d = new Date(iso); return String(d.getDate()).padStart(2,'0'); } catch { return iso; }
}
function formatLabelDia(label) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const d = new Date(label);
    const mes = d.toLocaleString("pt-BR",{ month:"long" });
    return `${String(d.getDate()).padStart(2,'0')} de ${capitalize(mes)}`;
  }
  if (/^\d{2}$/.test(label)) return `Dia ${label}`;
  return label;
}
function isEmptyDataset(d) {
  if (!d) return true;
  const r = d.resumo || {};
  const zeroNums = [r.receitas, r.despesas, r.planejado, r.realizado].every(x => !Number(x));
  const semCats = !(Array.isArray(d.porCategoria) && d.porCategoria.length);
  return zeroNums && semCats;
}
function normalizeEmpty(d) {
  if (!d) return { resumo:{receitas:0,despesas:0,planejado:0,realizado:0,saldo:0}, porCategoria:[], linha:[] };
  return d;
}

/* UI helpers */
function SmallCard({ label, value = 0, tone = "slate" }) {
  const toneMap = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  };
  return (
    <div className={`rounded-xl p-2 ${toneMap[tone]}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-sm font-semibold">{formatCurrency(value)}</div>
    </div>
  );
}
function SemaforoMini({ planejado = 0, realizado = 0 }) {
  const status = getStatus(planejado, realizado);
  const color = status === "ok" ? "bg-emerald-500"
    : status === "alerta" ? "bg-yellow-500" : "bg-red-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={status} />;
}
function getStatus(planejado, realizado) {
  if (!planejado || planejado <= 0) return "ok";
  const p = realizado / planejado;
  if (p <= 0.95) return "ok";
  if (p <= 1.05) return "alerta";
  return "estouro";
}