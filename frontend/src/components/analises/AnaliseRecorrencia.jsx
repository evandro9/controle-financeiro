// src/components/analises/AnaliseRecorrenciaPeriodo.jsx
import { apiFetch } from '../../services/http';
import React, { useEffect, useState, useContext } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { ChevronDown, Repeat, Activity, CreditCard, Info } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


function CardResumo({ titulo, valor, pctReceita, dark, fmtBRL }) {
  return (
    <div className={`p-4 rounded-xl ${dark ? 'bg-darkCard' : 'bg-white'} shadow border ${dark ? 'border-darkBorder' : 'border-gray-100'}`}>
      <div className="text-sm text-gray-600 dark:text-darkMuted">{titulo}</div>
      <div className="mt-1 text-xl font-semibold text-gray-800 dark:text-darkText">{fmtBRL.format(Number(valor||0))}</div>
      <div className="text-xs text-gray-600 dark:text-darkMuted mt-1">{Number(pctReceita||0).toFixed(1)}% da receita do mês</div>
    </div>
  );
}

function TabelaItens({ itens, mostrarPresencas=false, onCriarRegra }) {
  if (!itens?.length) return <p className="text-sm text-gray-500 dark:text-darkMuted">Nada a exibir nesse período.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full text-sm">
        <thead className="text-xs text-gray-600 dark:text-darkMuted normal-case">
          <tr className="border-b border-gray-200 dark:border-white/10">
            <th className="text-left py-2">Categoria</th>
            <th className="text-left py-2">Padrão</th>
            {mostrarPresencas && <th className="text-center py-2">Presenças (W)</th>}
            <th className="text-right py-2">Valor no período</th>
            <th className="text-right py-2">% despesa</th>
            <th className="text-right py-2">% receita</th>
            <th className="text-right py-2">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/10">
          {itens.map((it, i)=>(
            <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-white/[0.04]">
              <td className="py-2 text-left text-gray-800 dark:text-darkText">{it.categoria_nome}</td>
              <td className="py-2 text-left text-gray-700 dark:text-gray-300">{it.pattern || '—'}</td>
              {mostrarPresencas && <td className="py-2 text-center text-gray-700 dark:text-gray-300">{it.presencas}/{it.janela}</td>}
              <td className="py-2 text-right text-gray-800 dark:text-darkText">R$ {Number(it.valor_periodo).toFixed(2)}</td>
              <td className="py-2 text-right text-gray-700 dark:text-gray-300">{Number(it.pct_despesa).toFixed(1)}%</td>
              <td className="py-2 text-right text-gray-700 dark:text-gray-300">{Number(it.pct_receita).toFixed(1)}%</td>
              <td className="py-2 text-right">
                <button onClick={()=>onCriarRegra?.(it)}
                  className="px-3 py-1 rounded-lg border border-gray-300 dark:border-darkBorder text-xs hover:bg-gray-100 dark:hover:bg-white/10">
                  Criar regra
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnaliseRecorrencia() {
  const { darkMode } = useContext(ThemeContext);
  const [tab, setTab] = useState('parcelas');  
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1); // 1..12
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  // moeda padrão BRL
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const nomeMes = (m) => {
    const raw = new Date(0, m-1).toLocaleString('pt-BR', { month:'short' }).replace('.', '');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  async function carregar() {
    try {
      setLoading(true);
      // token e base já são tratados em apiFetch()
      const json = await apiFetch(`/analises/recorrencia-mensal?ano=${ano}&mes=${mes}&tipo=despesa`); 
      setData(json);
    } catch (e) {
      console.error(e);
      toast.error('Falha ao carregar análise mensal');
    } finally {
      setLoading(false);
    }
  }

useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [ano, mes]);

  const receita = Number(data?.receita_mes || 0);
  const tot = data?.totais || {};
  const tabs = [
    { key:'parcelas',    label:'Parcelas',    icon:<CreditCard className="w-4 h-4" /> },
    { key:'recorrentes', label:'Recorrentes', icon:<Repeat className="w-4 h-4" /> },
    { key:'pontuais',    label:'Pontuais',    icon:<Activity className="w-4 h-4" /> },
  ];

  return (
      <div className="bg-white dark:bg-darkCard p-4 rounded-xl shadow border border-gray-100 dark:border-darkBorder">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Filtros à esquerda */}
        <div className="flex items-end gap-3 flex-wrap self-center">
          {/* Ano */}
          <div className="flex flex-col min-w-[88px]">
            <label className="text-xs text-gray-500 dark:text-darkMuted mb-1">Ano</label>
            <div className="relative">
              <select
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value))}
                className="h-9 w-full appearance-none rounded-lg border bg-white px-2 pr-7 text-sm
                           text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none
                           dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
              >
                {Array.from({ length: 10 }, (_, i) => {
                  const y = new Date().getFullYear() - 5 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4
                                     text-gray-400 dark:text-darkMuted" />
            </div>
          </div>

          {/* Mês */}
          <div className="flex flex-col min-w-[130px]">
            <label className="text-xs text-gray-500 dark:text-darkMuted mb-1">Mês</label>
            <div className="relative">
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value))}
                className="h-9 w-full appearance-none rounded-lg border bg-white px-2 pr-7 text-sm
                           text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none
                           dark:bg-darkBg dark:text-darkText dark:border-darkBorder dark:focus:ring-blue-500/50"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                  <option key={m} value={m}>{nomeMes(m)}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4
                                     text-gray-400 dark:text-darkMuted" />
            </div>
          </div>
        </div>

        {/* Título centralizado */}
        <div className="self-center text-center">
          <h3 className="text-lg text-center font-semibold text-gray-800 dark:text-darkText">Análise de despesas do mês</h3>
        </div>

        {/* Ícone de informação à direita (mesma posição dos outros) */}
        <div className="flex justify-end self-center">
          <div className="relative group">
            <button
              type="button"
              aria-label="Informações desta análise"
              className="p-1.5 rounded-full transition
                         bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <Info className="w-4 h-4 text-gray-500 dark:text-gray-300" />
            </button>
            <div
              className="hidden group-hover:block absolute right-0 mt-2 w-80
                         rounded-md shadow-lg p-3 text-xs leading-relaxed
                         bg-white text-gray-800 border border-gray-200
                         dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700"
              style={{ pointerEvents: 'none' }}
            >
              <div className="font-semibold mb-1">Sobre esta análise</div>
              <ul className="list-disc pl-4 space-y-1">
                <li><b>Parcelas</b>: gastos fracionados (ex.: 5/10), somados no mês corrente.</li>
                <li><b>Recorrentes</b>: pagamentos repetitivos (assinaturas/contas) do mês.</li>
                <li><b>Pontuais</b>: despesas únicas do mês, sem padrão.</li>
                <li>Os <b>cards</b> mostram total e % da <b>receita do mês</b>.</li>
                <li>As <b>tabelas</b> listam categoria, subcategoria, observação e valor no mês.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Cards topo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <CardResumo titulo="Parcelas no mês"
          valor={Number(tot.parcelas||0)}
          pctReceita={(Number(data?.receita_mes||0)>0)? (100*Number(tot.parcelas||0)/Number(data.receita_mes)).toFixed(1) : 0}
          dark={darkMode}
          fmtBRL={fmtBRL}
        />
        <CardResumo titulo="Recorrentes no mês"
          valor={Number(tot.recorrentes||tot.recorrente||0)}
          pctReceita={(Number(data?.receita_mes||0)>0)? (100*Number((tot.recorrentes||tot.recorrente)||0)/Number(data.receita_mes)).toFixed(1) : 0}
          dark={darkMode}
          fmtBRL={fmtBRL}
        />
        <CardResumo titulo="Pontuais no mês"
          valor={Number(tot.pontuais||tot.pontual||0)}
          pctReceita={receita>0 ? (100*Number((tot.pontuais||tot.pontual)||0)/receita) : 0}
          dark={darkMode}
          fmtBRL={fmtBRL}
        />
      </div>

            {/* Avisos de excesso vs. receita */}
      <div className="mt-3 space-y-2">
        {(() => {
          const r = Number(data?.receita_mes||0)||0;
          const pParcelas = r>0 ? (100*(Number(tot.parcelas||0))/r) : 0;
          const pRec = r>0 ? (100*(Number(tot.recorrentes||tot.recorrente||0))/r) : 0;
          return (
            <>
              {pParcelas >= 30 && (
                <div className="px-3 py-2 rounded-lg text-sm border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10">
                  ⚠️ Parcelas representam {pParcelas.toFixed(1)}% da receita — avalie reduzir parcelamentos.
                </div>
              )}
              {pRec >= 40 && (
                <div className="px-3 py-2 rounded-lg text-sm border border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10">
                  ⚠️ Recorrentes representam {pRec.toFixed(1)}% da receita — revise gastos fixos.
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Tabs */}
      <div className="mt-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-2">
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`px-3 py-2 rounded-t-lg flex items-center gap-1 text-sm
            ${tab===t.key ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-darkText' : 'text-gray-600 dark:text-darkMuted'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading && <p className="text-sm text-gray-500 dark:text-darkMuted">Carregando…</p>}
        {!loading && tab==='recorrentes' && (
          <div className="overflow-x-auto">
            {!data?.itens?.recorrentes?.length ? (
              <p className="text-sm text-gray-500 dark:text-darkMuted">Nada recorrente pago neste mês.</p>
            ) : (
              <table className="min-w-[640px] w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[22%]" />
                  <col className="w-[35%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead className="text-xs text-gray-600 dark:text-darkMuted normal-case">
                  <tr className="border-b border-gray-200 dark:border-white/10">
                    <th className="text-left py-2">Categoria</th>
                    <th className="text-left py-2">Subcategoria</th>
                    <th className="text-left py-2">Observação</th>
                    <th className="text-right py-2">Valor no mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                  {data?.itens?.recorrentes?.map((r, idx)=>(
                    <tr key={idx} className="group hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                      <td className="py-2 text-left text-gray-800 dark:text-darkText">{r.categoria || 'Sem categoria'}</td>
                      <td className="py-2 text-left text-gray-700 dark:text-gray-300">{r.subcategoria || '—'}</td>
                      <td className="py-2 text-left text-gray-700 dark:text-gray-300 break-words">{r.descricao || '—'}</td>
                      <td className="py-2 text-right text-gray-800 dark:text-darkText">{fmtBRL.format(Number(r.valor||0))}</td> 
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {!loading && tab==='parcelas'    && (
          !data?.itens?.parcelas?.length ? <p className="text-sm text-gray-500 dark:text-darkMuted">Nenhuma parcela no mês.</p> :
          <div className="overflow-x-auto">
              <table className="min-w-[640px] w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[22%]" />
                <col className="w-[35%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="text-xs text-gray-600 dark:text-darkMuted normal-case">
                <tr className="border-b border-gray-200 dark:border-white/10">
                  <th className="text-left py-2">Categoria</th>
                  <th className="text-left py-2">Subcategoria</th>
                  <th className="text-left py-2">Observação</th>
                  <th className="text-right py-2">Valor no mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {data?.itens?.parcelas?.map((p,idx)=>(
                  <tr key={idx} className="group hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                   <td className="py-2 text-left text-gray-800 dark:text-darkText">{p.categoria || 'Sem categoria'}</td>
                   <td className="py-2 text-left text-gray-700 dark:text-gray-300">{p.subcategoria || '—'}</td>
                    <td className="py-2 text-left text-gray-700 dark:text-gray-300 break-words">
                      {p.descricao || '—'}
                      {(p.parcela_atual && p.parcelas_total) ? (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          ({p.parcela_atual}/{p.parcelas_total})
                        </span>
                      ) : null}
                    </td>
                   <td className="py-2 text-right text-gray-800 dark:text-darkText">{fmtBRL.format(Number(p.valor||0))}</td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
                {!loading && tab==='pontuais' && (
          <div className="overflow-x-auto">
            {!data?.itens?.pontuais?.length ? (
              <p className="text-sm text-gray-500 dark:text-darkMuted">Nenhum gasto pontual no mês.</p>
            ) : (
              <table className="min-w-[640px] w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[22%]" />
                  <col className="w-[35%]" />
                  <col className="w-[15%]" />
               </colgroup>
                <thead className="text-xs text-gray-600 dark:text-darkMuted normal-case">
                  <tr className="border-b border-gray-200 dark:border-white/10">
                    <th className="text-left py-2">Categoria</th>
                    <th className="text-left py-2">Subcategoria</th>
                    <th className="text-left py-2">Observação</th>
                    <th className="text-right py-2">Valor no mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                  {data?.itens?.pontuais?.map((p,i)=>(
                    <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                      <td className="py-2 text-left text-gray-800 dark:text-darkText">{p.categoria || 'Sem categoria'}</td>
                      <td className="py-2 text-left text-gray-700 dark:text-gray-300">{p.subcategoria || '—'}</td>
                      <td className="py-2 text-left text-gray-700 dark:text-gray-300 break-words">{p.descricao || '—'}</td>
                      <td className="py-2 text-right text-gray-800 dark:text-darkText">{fmtBRL.format(Number(p.valor||0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}