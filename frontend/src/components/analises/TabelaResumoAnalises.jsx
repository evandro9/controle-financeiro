import { apiFetch } from '../../services/http';
import React, { useEffect, useState, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';
import ScrollArea from "../ui/ScrollArea";

// limite de 17 chars + reticências
const short = (s, n = 17) =>
  typeof s === 'string' && s.length > n ? s.slice(0, n) + '…' : (s ?? '');

// Renderiza label truncada e mostra tooltip estilizado SÓ se houve truncamento.
// Agora o tooltip é renderizado via PORTAL no <body> para evitar clipping/z-index.
function TruncatedLabel({ text, prefix = '', max = 17 }) {
  const isLong = typeof text === 'string' && text.length > max;
  const shown = isLong ? text.slice(0, max) + '…' : (text ?? '');
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const place = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // Posição preferida: abaixo do texto
    let top = Math.round(r.bottom + 6);
    let left = Math.round(r.left);

    // Evita estourar na direita da viewport (ajuste simples)
    const tooltipWidth = (String(prefix + text).length * 6.2) + 16; // aprox. chars * px + paddings
    const maxLeft = window.innerWidth - tooltipWidth - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);

    // Evita sair por cima da viewport se a célula está muito em cima
    if (top > window.innerHeight - 34) top = Math.max(8, Math.round(r.top - 8)); // fallback acima

    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => place();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <span
        ref={ref}
        className="block truncate"
        onMouseEnter={() => { if (isLong) { place(); setOpen(true); } }}
        onMouseLeave={() => setOpen(false)}
      >
        {prefix}{shown}
      </span>

      {open && isLong && createPortal(
        <div className="fixed z-[99999] pointer-events-none" style={{ top: pos.top, left: pos.left }}>
          <div className="rounded-md px-2 py-1 text-xs shadow-lg
                          bg-gray-900 text-white dark:bg-zinc-900 dark:text-gray-100
                          border border-white/10 whitespace-nowrap">
            {prefix}{text}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function TabelaResumoAnalises({ ano, mesInicio, mesFim }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [abertas, setAbertas] = useState([]);
  const { darkMode } = useContext(ThemeContext);
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";

  useEffect(() => {
    setLoading(true);
    const raw = (localStorage.getItem('token') || '').trim();
    const auth = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
    const url = new URL(`${apiBase}/analises/tabela-resumo`, window.location.origin);
    url.searchParams.append('ano', ano);
    url.searchParams.append('mesInicio', mesInicio);
    url.searchParams.append('mesFim', mesFim);

apiFetch(`/analises/tabela-resumo?ano=${ano}&mesInicio=${mesInicio}&mesFim=${mesFim}`)
  .then(json => setDados(Array.isArray(json) ? json : []))
  .catch(() => setDados([]))
  .finally(() => setLoading(false));
  }, [ano, mesInicio, mesFim]);

 const nomeMes = (mes) => {
   const raw = new Date(0, mes - 1).toLocaleString('pt-BR', { month: 'short' }); // ex: "jan."
   const clean = raw.replace(/\./g, '');                                         // "jan"
   return clean.charAt(0).toUpperCase() + clean.slice(1);                        // "Jan"
 };
  const meses = Array.from({ length: mesFim - mesInicio + 1 }, (_, i) => mesInicio + i);

  // 1) Normaliza: garante categoria/subcategoria e converte mes_X para Number
  const dadosNum = React.useMemo(() => {
    return (dados || []).map((linha) => {
      const out = {
        categoria: linha.categoria ?? 'Sem categoria',
        subcategoria: linha.subcategoria ?? '—',
      };
      meses.forEach((m) => {
        // PG costuma mandar numeric como string -> vira number aqui
        out[`mes_${m}`] = Number(linha[`mes_${m}`] ?? 0);
      });
      return out;
    });
  }, [dados, meses]);

  // 2) Agrupa por categoria já com números
  const agrupado = {};
  dadosNum.forEach((linha) => {
    if (!agrupado[linha.categoria]) agrupado[linha.categoria] = [];
    agrupado[linha.categoria].push(linha);
  });

  // 3) Total geral com base nas linhas normalizadas
  const totalGeral = React.useMemo(() => {
    return Object.values(agrupado).flat().reduce((acc, linha) => {
      const totalLinha = meses.reduce((soma, m) => soma + (linha[`mes_${m}`] ?? 0), 0);
      return acc + totalLinha;
    }, 0);
  }, [agrupado, meses]);

  // Formatação de moeda (padrão BRL)
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
        <div className="bg-white dark:bg-darkCard p-4 rounded shadow text-gray-800 dark:text-darkText">
      {/* header + apenas ícone de informação */}
      <div className="relative mb-2">
        {/* Info no canto superior direito */}
        <div className="absolute top-0 right-3">
          <InfoTip title="Sobre esta tabela" ariaLabel="Informações da tabela" width="w-80">
            <ul className="list-disc pl-4 space-y-1">
                <li>Mostra totais por <b>categoria</b> e <b>subcategoria</b> no período filtrado.</li>
                <li>Clique na <b>linha da categoria</b> para expandir/ocultar as subcategorias.</li>
                <li>Colunas dos meses exibem os valores do intervalo selecionado.</li>
                <li>Filtros no topo controlam o intervalo exibido.</li>
            </ul>
          </InfoTip>
        </div>
        {/* Título centralizado (sem subtítulo) */}
        <h3 className="text-lg  text-center font-semibold">Resumo por categoria e subcategoria</h3>
      </div>
 
      {/* ⏳ Carregando */}
      {loading && (
        <div className="h-[260px] flex items-center justify-center">
          <div className="flex items-center gap-3 text-sm">
            <span
              className="inline-block w-4 h-4 rounded-full border-2 border-gray-300 border-t-transparent animate-spin
                         dark:border-gray-700 dark:border-t-transparent"
              aria-label="Carregando"
            />
            <span className="text-gray-500 dark:text-gray-400">Carregando dados…</span>
          </div>
        </div>
      )}
 
      {/* 🚫 Sem dados */}
      {!loading && (!Array.isArray(dados) || dados.length === 0) && (
        <div className="h-[260px] flex items-center justify-center">
          <div className="text-center text-sm">
            <p className="text-gray-600 dark:text-gray-300 font-medium">Nenhum dado disponível</p>
            <p className="text-gray-500 dark:text-gray-400">Ajuste os filtros para ver resultados.</p>
          </div>
        </div>
      )}
 
      {!loading && Array.isArray(dados) && dados.length > 0 && (
<ScrollArea axis="x" className="relative rounded-lg">
  <table className="min-w-max text-sm border-separate border-spacing-y-2">
          <thead className="text-xs text-gray-600 dark:text-darkMuted">
            <tr>
              {/* TH fixa à esquerda */}
              <th
                className="sticky left-0 z-30 bg-white dark:bg-darkCard px-2 text-left
                           shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.08)]
                           dark:shadow-[inset_-8px_0_8px_-8px_rgba(255,255,255,0.06)]
                           w-[180px] min-w-[160px] max-w-[220px]"
              >
                Categoria / Subcategoria
              </th>
              {meses.map((m) => (
                <th key={m} className="px-2 text-right">{nomeMes(m)}</th>
              ))}
              <th className="px-2 text-right">Total</th>
              <th className="px-2 text-right">% Geral</th>
            </tr>
          </thead>

          <tbody>
            {Object.entries(agrupado).map(([categoria, linhas], idx) => {
              const aberta = abertas.includes(categoria);
              const totaisPorMes = {};
              meses.forEach((m) => {
                totaisPorMes[m] = linhas.reduce((s, l) => s + (l[`mes_${m}`] ?? 0), 0);
              });
              const totalCat = Object.values(totaisPorMes).reduce((a, b) => a + b, 0);

              return (
                <React.Fragment key={idx}>
                  {/* LINHA DE CATEGORIA */}
<tr
  className="group bg-gray-200 dark:bg-gray-700 text-left cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600"
  onClick={() => {
    setAbertas(prev => prev.includes(categoria)
      ? prev.filter(c => c !== categoria)
      : [...prev, categoria]);
  }}
>
  <td
    className="sticky left-0 z-20 px-2 py-1 font-semibold text-left text-gray-800 dark:text-gray-100
               w-[180px] min-w-[160px] max-w-[220px]
               bg-gray-200 dark:bg-gray-700
               group-hover:bg-gray-300 dark:group-hover:bg-gray-600
               border-r border-gray-300 dark:border-gray-600
               shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.08)]
               dark:shadow-[inset_-8px_0_8px_-8px_rgba(255,255,255,0.06)]
               whitespace-nowrap"
    colSpan={1}
  >
    <TruncatedLabel text={categoria} prefix={`${aberta ? '−' : '+'} `} max={17} />
  </td>
                    {meses.map((m) => (
                      <td key={m} className="px-2 text-right font-medium text-gray-700 dark:text-gray-200">
                        {fmtBRL.format(totaisPorMes[m] ?? 0)}
                      </td>
                    ))}
                    <td className="px-2 text-right font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900 rounded">
                      {fmtBRL.format(Number(totalCat || 0))}
                    </td>
                    <td className="px-2 text-right text-sm text-gray-600 dark:text-gray-300">
                      {totalGeral > 0 ? ((totalCat / totalGeral) * 100).toFixed(1) + '%' : '-'}
                    </td>
                  </tr>

                  {/* SUBLINHAS (subcategorias) */}
                  {aberta && linhas.map((linha, i) => {
                    const total = meses.reduce((sum, m) => sum + (linha[`mes_${m}`] || 0), 0);
                    return (
<tr
  key={i}
  className="group text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
>
  <td
 className="sticky left-0 z-10 px-3 py-1 text-gray-700 dark:text-gray-200
            w-[180px] min-w-[160px] max-w-[220px]
            bg-gray-50 dark:bg-gray-800
            group-hover:bg-gray-100 dark:group-hover:bg-gray-700
            border-r border-gray-200 dark:border-gray-700
            shadow-[inset_-8px_0_8px_-8px_rgba(0,0,0,0.06)]
            dark:shadow-[inset_-8px_0_8px_-8px_rgba(255,255,255,0.04)]
            whitespace-nowrap"
  >
    <TruncatedLabel text={linha.subcategoria} prefix="↳ " max={17} />
  </td>
                        {meses.map((m) => (
                          <td key={m} className="px-2 text-right text-blue-700 dark:text-blue-300">
                            {fmtBRL.format(linha[`mes_${m}`] ?? 0)}
                          </td>
                        ))}
                        <td className="px-2 text-right dark:text-gray-200">{fmtBRL.format(total)}</td>
                        <td className="px-2 text-right text-gray-500 dark:text-gray-400">
                          {totalGeral > 0 ? ((total / totalGeral) * 100).toFixed(1) + '%' : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Linha final de total geral */}
            <tr className="bg-indigo-100 dark:bg-indigo-900 font-semibold">
 <td
   className="sticky left-0 z-20 px-2 py-2 text-left text-indigo-800 dark:text-indigo-200
              w-[180px] min-w-[160px] max-w-[220px]
              bg-indigo-100 dark:bg-indigo-900
group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800
 border-r border-indigo-200/70 dark:border-indigo-800 transition-colors"
              >
                Total Geral
              </td>
              {meses.map((m) => {
                const totalMes = dadosNum.reduce((soma, linha) => soma + (linha[`mes_${m}`] ?? 0), 0);
                return (
                  <td key={m} className="px-2 text-right text-indigo-800 dark:text-indigo-200">
                    {fmtBRL.format(totalMes)}
                  </td>
                );
              })}
              <td className="px-2 text-right text-indigo-800 dark:text-indigo-200">
                {fmtBRL.format(totalGeral)}
              </td>
              <td className="px-2 text-right text-indigo-800 dark:text-indigo-200">100%</td>
            </tr>
          </tbody>
        </table>
        </ScrollArea>

       )}

      {/* CSS da barra de rolagem (escopo local) */}
      <style>{`
        .cf-scroll {
          scrollbar-width: thin;                    /* Firefox */
          scrollbar-color: var(--sb-thumb) var(--sb-track);
        }
        .cf-scroll::-webkit-scrollbar {
          height: 10px;                             /* horizontal */
        }
        .cf-scroll::-webkit-scrollbar-track {
          background: var(--sb-track);
          border-radius: 8px;
        }
        .cf-scroll::-webkit-scrollbar-thumb {
          background: var(--sb-thumb);
          border-radius: 8px;
        }
        .cf-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--sb-thumb-hover);
        }
      `}</style>
    </div>
  );
}

export default TabelaResumoAnalises;