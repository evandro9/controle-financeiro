import React, { useContext, useEffect, useState } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area
} from 'recharts';
import { Info } from 'lucide-react';
import InfoTip from '../ui/InfoTip';

// função para formatar meses no eixo X (abreviado, só com mês)
const formatarMes = (mes) => {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const numero = parseInt(mes, 10);
  return meses[numero - 1] || mes;
};

// função para formatar valores grandes no eixo Y
const formatarValorAbreviado = (valor) => {
  if (Math.abs(valor) >= 1_000_000) {
    return (valor / 1_000_000).toFixed(0) + 'M';
  } else if (Math.abs(valor) >= 1_000) {
    return (valor / 1_000).toFixed(0) + 'K';
  }
  return valor.toFixed(0);
};

// Tooltip custom no padrão das análises
const CustomTooltip = ({ active, payload, label, darkMode }) => {
  if (active && payload && payload.length) {
    const nomeDosMeses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const mesIndex = parseInt(label, 10) - 1;
    const mesNome = nomeDosMeses[mesIndex] || label;

    return (
      <div
        className={`rounded-lg shadow-md px-3 py-2 text-sm border ${
          darkMode
            ? 'bg-darkCard border-darkBorder text-darkText'
            : 'bg-white border-gray-200 text-gray-800'
        }`}
      >
        <p className="font-medium mb-1">{mesNome}</p>
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.name}:</span>
            <span className="font-semibold">
              {`R$ ${parseFloat(item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function GraficoLinhaMensal({ ano }) {
  const { darkMode } = useContext(ThemeContext);
  const [dados, setDados] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`/api/lancamentos/resumo-mensal?ano=${ano}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setDados)
      .catch(() => alert('Erro ao carregar resumo mensal'));
  }, [ano]);

  if (!dados || dados.length === 0) {
    return <p className="text-center text-gray-500 dark:text-darkMuted">Nenhum dado disponível para o ano {ano}.</p>;
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header fixo (título + i) no topo */}
     <div className="h-[36px] flex items-center justify-center mb-2 relative">
        <h3 className="text-base font-semibold text-gray-800 dark:text-darkText text-center">
          Receitas x Despesas Mensais
        </h3>

        {/* i padronizado (copiado do GraficoPizzaDistribuicao) */}
        <div className="absolute right-0">
          <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
            <ul className="list-disc pl-4 space-y-1">
              <li>Compara <b>Receitas</b> e <b>Despesas</b> ao longo do ano selecionado.</li>
              <li>O filtros do topo de ano controla o período exibido.</li>
              <li>Passe o mouse no gráfico para ver os valores detalhados.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* Gráfico ocupa todo o restante do card */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={dados}
            // espaço suficiente p/ ticks inclinados + legenda inferior
            margin={{ top: 8, right: 8, bottom: 6, left: 0 }}
          >
            <CartesianGrid stroke={darkMode ? '#30363d' : '#e5e7eb'} />

            {/* LEGENDA EMBAIXO (central) */}
 <Legend
   verticalAlign="bottom"
   align="center"
   height={24}
   wrapperStyle={{
     color: darkMode ? '#c9d1d9' : '#374151',
     fontSize: 12,
     paddingTop: 8
   }}
 />

 <XAxis
   dataKey="mes"
   tickFormatter={formatarMes}
   angle={-30}
   textAnchor="end"
   height={40}
   tickMargin={6}
   interval={0}
   tick={{ fontSize: 12, fill: darkMode ? '#c9d1d9' : '#374151' }}
 />
 <YAxis
   tickFormatter={formatarValorAbreviado /* ou a sua função atual */}
   width={40}                             // força eixo mais enxuto (ajuste fino: 36–44)
   tick={{ fontSize: 12, fill: darkMode ? '#c9d1d9' : '#374151' }}
   tickLine={false}
   axisLine={{ stroke: darkMode ? '#30363d' : '#e5e7eb' }}
 />

            <Tooltip content={<CustomTooltip darkMode={darkMode} />} />

            <Area
              type="monotone"
              dataKey="receita"
              stroke={darkMode ? '#58a6ff' : '#0072B2'}
              fill={darkMode ? '#1f6feb55' : '#b2ebf2'}
              name="Receitas"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r:1.75 }}  
            />
            <Area
              type="monotone"
              dataKey="despesa"
              stroke={darkMode ? '#f78166' : '#D55E00'}
              fill={darkMode ? '#bb444c55' : '#ffd6cc'}
              name="Despesas"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r:1.75}}  
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default GraficoLinhaMensal;