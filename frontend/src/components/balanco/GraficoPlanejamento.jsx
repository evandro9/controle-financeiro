import React, { useContext, useEffect, useState } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import InfoTip from '../ui/InfoTip';

const GraficoPlanejamento = ({ ano, mes }) => {
  const [dados, setDados] = useState([]);
  const [totalPlanejado, setTotalPlanejado] = useState(0);
  const [totalRealizado, setTotalRealizado] = useState(0);
  const { darkMode } = useContext(ThemeContext);
  const apiBase = import.meta.env.VITE_API_URL ?? "/api";

  // Cores do donut (azul), variando levemente no dark
  const PIE_REALIZADO = darkMode ? '#3B82F6' /* blue-400 */ : '#2563EB' /* blue-600 */;
  const PIE_RESTANTE  = darkMode ? 'rgba(147,197,253,0.35)' /* blue-300 c/ alpha */ : '#DBEAFE' /* blue-100 */;

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${apiBase}/planejamentos/resumo?ano=${ano}&mes=${String(mes).padStart(2, '0')}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        // pg -> numeric vem como string; força número:
        const norm = arr.map(it => ({
          ...it,
          valor_planejado: Number(it.valor_planejado) || 0,
          valor_realizado: Number(it.valor_realizado) || 0
        }));
        const sorted = [...norm].sort((a, b) => {
          const restanteA = Math.max((a.valor_planejado || 0) - (a.valor_realizado || 0), 0);
          const restanteB = Math.max((b.valor_planejado || 0) - (b.valor_realizado || 0), 0);
          return restanteB - restanteA;
        });

        setDados(sorted);

          const { totalP, totalR } = norm.reduce((acc, it) => {
          acc.totalP += it.valor_planejado;
          acc.totalR += it.valor_realizado;
          return acc;
        }, { totalP: 0, totalR: 0 });

        setTotalPlanejado(totalP);
        setTotalRealizado(totalR);
      })
      .catch(() => alert('Erro ao carregar gráfico'));
  }, [ano, mes]);

  const percentualGasto = totalPlanejado > 0 ? (totalRealizado / totalPlanejado) * 100 : 0;

  // 🔎 Preferência: exibir apenas categorias com despesa no mês
  const [somenteComDespesa, setSomenteComDespesa] = useState(() => {
    return localStorage.getItem('planej_somenteComDespesa') !== 'false';
  });
  useEffect(() => {
    localStorage.setItem('planej_somenteComDespesa', String(somenteComDespesa));
  }, [somenteComDespesa]);

  // Oculta categorias sem planejado e sem despesa.
  const baseCategorias = dados.filter((i) =>
    (i.valor_planejado || 0) > 0 || (i.valor_realizado || 0) > 0
  );
  const listaRender = somenteComDespesa
    ? baseCategorias.filter((i) => (i.valor_realizado || 0) > 0)
    : baseCategorias;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header fixo (alinhado com o gráfico da esquerda) */}
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
        <h3 className="text-base font-semibold text-gray-800 dark:text-darkText text-center">
          Despesas: Realizado x Planejado
        </h3>

        {/* Ícone de informação padronizado e estático */}
        <div className="absolute right-0">
          <InfoTip title="Como ler este painel" ariaLabel="Informações do gráfico">
            <ul className="list-disc pl-4 space-y-1">
                <li><b>Lista à esquerda:</b> cada categoria mostra o % <b>realizado</b> sobre o <b>planejado</b> do mês selecionado.</li>
                <li><b>Valor à direita:</b> quanto <b>ainda falta</b> para atingir o planejado (em R$).</li>
                <li><b>Gráfico de rosca:</b> resumo geral do mês = realizado ÷ planejado de todas as categorias; o anel claro representa o que falta.</li>
                <li><b>Somente com despesas:</b> mostra apenas categorias com gasto &gt; 0.</li>
                <li><b>Sem valor planejado:</b> a categoria só aparece se houver despesa no mês.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* Corpo: lista à esquerda (centralizável) + donut à direita */}
      <div className="flex-1 min-h-0 grid grid-cols-[1fr_12rem] gap-6 items-stretch">
        {/* Coluna esquerda */}
        <div className="min-w-0 h-full flex">
          {/* 
            Wrapper que ocupa 100% da altura da coluna e 
            centraliza verticalmente o bloco "header + lista" 
            quando a lista é pequena. 
          */}
          <div className="flex-1 min-h-0 flex flex-col justify-center">
            {/* Contador + toggle */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs text-gray-500 dark:text-darkMuted">
                {listaRender.length} {listaRender.length === 1 ? 'categoria' : 'categorias'}
              </span>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-darkText">
                <input
                  type="checkbox"
                  checked={somenteComDespesa}
                  onChange={(e) => setSomenteComDespesa(e.target.checked)}
                />
                Somente com despesas
              </label>
            </div>

            {/* 
              Lista rolável com largura estável; 
              quando a lista é menor que a altura disponível, 
              fica centralizada (via justify-center do wrapper acima).
            */}
            <div
              className="flex-1 min-h-0 overflow-y-auto pr-1"
              style={{ scrollbarGutter: 'stable' }}
            >
              <div className="min-h-full flex flex-col justify-center space-y-2">
                {listaRender.length === 0 ? (
                  <div className="text-xs text-gray-500 dark:text-darkMuted px-1 py-2">
                    Nenhuma categoria com despesas neste mês.
                  </div>
                ) : (
                  listaRender.map((item, i) => {
                    const planejado = item.valor_planejado || 0;
                    const realizado = item.valor_realizado || 0;
                    const percentual = planejado > 0 ? (realizado / planejado) * 100 : 0;
                    const restante = Math.max(planejado - realizado, 0);
                    const textoBarra = percentual > 100 ? 'Limite estourado' : `${percentual.toFixed(0)}%`;

                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-1/3 truncate text-gray-700 dark:text-darkMuted"
                          title={item.categoria}
                        >
                          {item.categoria}
                        </div>

                        <div
                          className={`flex-1 rounded-full h-5 relative overflow-hidden ${
                            darkMode ? 'bg-darkBorder' : 'bg-blue-100'
                          }`}
                        >
                          <div
                            className={`h-5 rounded-full flex items-center px-2 text-[10px] font-semibold whitespace-nowrap ${
                              darkMode ? 'text-black' : 'text-white'
                            }`}
                            style={{
                              width: `${Math.min(percentual, 100)}%`,
                              backgroundColor: darkMode ? '#3B82F6' : '#2563EB'
                            }}
                          >
                            {textoBarra}
                          </div>
                        </div>

                        <div className="w-[70px] text-right text-blue-600 dark:text-blue-400 font-medium text-xs">
                          {restante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita (donut) */}
        <div className="flex flex-col items-center justify-center relative">
          <div className="w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Realizado', value: Math.min(totalRealizado, totalPlanejado) },
                    { name: 'Restante', value: Math.max(totalPlanejado - totalRealizado, 0) }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  stroke="transparent"
                  strokeWidth={0}
                  shapeRendering="geometricPrecision"
                >
                  <Cell fill={PIE_REALIZADO} />
                  <Cell fill={PIE_RESTANTE} />
                </Pie>

                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xl font-bold"
                  fill={darkMode ? '#c9d1d9' : '#000'}
                >
                  {`${percentualGasto.toFixed(0)}%`}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Aviso dentro do card (não vaza) */}
          {percentualGasto > 100 && (
            <div className="mt-2 px-3 py-1 text-sm bg-red-100 text-red-600 font-semibold rounded">
              Orçamento estourado
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GraficoPlanejamento;