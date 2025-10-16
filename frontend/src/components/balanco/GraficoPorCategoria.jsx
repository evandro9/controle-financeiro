import React, { useContext, useEffect, useState } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import InfoTip from '../ui/InfoTip';

 // Tooltip customizada (padrão da tela de análises)
 const CustomTooltip = ({ active, payload, label, darkMode }) => {
   if (!active || !payload || !payload.length) return null;
   const item = payload[0];
   const color = item.color || item.fill || '#2563EB';
   const perc = Number(item.value);
   const valor = item.payload?.valor;

   return (
     <div
       className={`rounded-lg shadow-md px-3 py-2 text-sm border ${
         darkMode
           ? 'bg-darkCard border-darkBorder text-darkText'
           : 'bg-white border-gray-200 text-gray-800'
       }`}
     >
       <p className="font-medium mb-1">{label}</p>
       <div className="flex items-center gap-2">
         <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
         <span>Percentual:</span>
         <span className="font-semibold">
           {Number.isFinite(perc) ? `${perc.toFixed(0)}%` : '-'}
         </span>
       </div>
       {typeof valor === 'number' && (
         <div className="flex items-center gap-2 mt-1">
           <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, opacity: 0.4 }} />
           <span>Despesa:</span>
           <span className="font-semibold">
             {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
           </span>
         </div>
       )}
     </div>
   );
 };

function GraficoPorCategoria({ ano, mes, maxCategorias }) {
  const [dados, setDados] = useState([]);
  const [resumoMes, setResumoMes] = useState({ receita: 0, despesa: 0, carregado: false });
  const { darkMode } = useContext(ThemeContext);
  const BAR_COLOR = darkMode ? '#3B82F6' /* blue-400 */ : '#2563EB' /* blue-600 */;

  useEffect(() => {
    const token = localStorage.getItem('token');

    const fetchCategorias = fetch(
      `/api/lancamentos/despesas-por-categoria?ano=${ano}&mes=${String(mes).padStart(2, '0')}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(res => res.json());

    const fetchResumo = fetch(
      `/api/lancamentos/resumo-mensal?ano=${ano}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(res => res.json());

    Promise.all([fetchCategorias, fetchResumo])
      .then(([cats, resumo]) => {
        setDados(Array.isArray(cats) ? cats : []);
        const alvo = Array.isArray(resumo)
          ? resumo.find((r) => parseInt(r.mes, 10) === parseInt(mes, 10))
          : null;
        setResumoMes({
          receita: alvo?.receita ? Number(alvo.receita) : 0,
          despesa: alvo?.despesa ? Number(alvo.despesa) : 0,
          carregado: true,
        });
      })
      .catch(() => {
        alert('Erro ao carregar gráfico de categorias');
        setResumoMes((s) => ({ ...s, carregado: true }));
      });
  }, [ano, mes]);

  // Estados vazios
  const semReceita = resumoMes.carregado && resumoMes.receita <= 0;
  const semDespesa = resumoMes.carregado && resumoMes.despesa <= 0;
  const semDadosPeriodo = semReceita && semDespesa;

  return (
    <div className="bg-white dark:bg-darkCard rounded-xl shadow p-6 border border-gray-100 dark:border-darkBorder h-full flex flex-col">
      {/* Header com título central e “i” padronizado */}
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
        <h3 className="text-base font-semibold text-gray-700 dark:text-darkText text-center">
          % por Categoria de Gasto em relação à Receita
        </h3>

        <div className="absolute right-0">
       <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
            <ul className="list-disc pl-4 space-y-1">
              <li>Mostra o percentual de cada <b>categoria de despesa</b> em relação à <b>receita do mês</b>.</li>
              <li>Os rótulos no topo das colunas indicam o % de cada categoria.</li>
              <li>Somente categorias com <b>despesa &gt; 0</b> aparecem.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* Área do gráfico / estados vazios */}
      <div className="flex-1 min-h-0">
        {/* Mensagens de vazio */}
        {resumoMes.carregado && semDadosPeriodo && (
          <div className="h-full flex items-center justify-center">
            <p className="text-center text-sm text-gray-500 dark:text-darkMuted">
              Não há dados disponíveis neste período.
            </p>
          </div>
        )}

        {resumoMes.carregado && !semDadosPeriodo && semReceita && !semDespesa && (
          <div className="h-full flex items-center justify-center">
            <p className="text-center text-sm text-gray-500 dark:text-darkMuted">
              Não há receita registrada neste mês. Os percentuais por categoria não podem ser calculados.
            </p>
          </div>
        )}

        {resumoMes.carregado && !semDadosPeriodo && !semReceita && dados.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-center text-sm text-gray-500 dark:text-darkMuted">
              Não há despesas por categoria neste mês.
            </p>
          </div>
        )}

        {/* Gráfico */}
        {resumoMes.carregado && !semDadosPeriodo && !semReceita && dados.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={maxCategorias ? dados.slice(0, maxCategorias) : dados}
              margin={{ top: 16, right: 16, left: 0, bottom: 40 }}
            >
              <XAxis
                dataKey="categoria"
                angle={-30}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 12, fill: darkMode ? '#c9d1d9' : '#374151' }}
              />
              <YAxis
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                tick={{ fontSize: 12, fill: darkMode ? '#c9d1d9' : '#374151' }}
              />
 <Tooltip
   content={<CustomTooltip darkMode={darkMode} />}
   cursor={{ fill: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.06)' }}
 />
              <Bar
                dataKey="percentual"
                fill={BAR_COLOR}
                radius={[10, 10, 0, 0]}
                maxBarSize={40}
              >
                <LabelList
                  dataKey="percentual"
                  position="top"
                  formatter={(v) => `${Number(v).toFixed(0)}%`}
                  style={{ fill: darkMode ? '#c9d1d9' : '#111827', fontWeight: 'bold', fontSize: 12 }}
                />
                {dados.map((_, index) => (
                  <Cell key={`cell-${index}`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default GraficoPorCategoria;