import React, { useContext, useEffect, useState } from 'react';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';

export default function GraficoFormasPgto({ ano, mes, maxItens }) {
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const { darkMode } = useContext(ThemeContext);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const apiBase = import.meta.env.VITE_API_URL ?? "/api";
    const ctrl = new AbortController();
    setLoading(true); setErro(""); setDados([]);
    fetch(`${apiBase}/lancamentos/gastos-cartoes?ano=${ano}&mes=${String(mes).padStart(2, '0')}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(res => {
        const total = res.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
        const comPercentual = res.map(item => {
          const valor = Number(item.valor) || 0;
          return {
            ...item,
            valor,
            percentual: total > 0 ? (valor / total) * 100 : 0
          };
        });
        setDados(comPercentual);
      })
      .catch(() => setErro("Falha ao carregar dados de formas de pagamento."))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [ano, mes]);

  return (
    <div className="bg-white dark:bg-darkCard rounded-xl shadow p-6 border border-gray-100 dark:border-darkBorder h-full flex flex-col">
      {/* Header: título central + i padronizado (fixo) */}
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
        <h3 className="text-base font-semibold text-gray-700 dark:text-darkText text-center">
          Despesas por Forma de Pagamento
        </h3>

        <div className="absolute right-0">
          <InfoTip title="Como ler este gráfico" ariaLabel="Informações do gráfico">
            <ul className="list-disc pl-4 space-y-1">
              <li>Cada linha mostra o <b>%</b> da despesa do mês por <b>forma de pagamento</b>.</li>
              <li>A barra azul representa a participação daquela forma no total de despesas.</li>
              <li>À direita, você vê o <b>%</b> e o <b>valor</b> gasto naquela forma.</li>
              <li>Os filtros globais de <b>ano</b> e <b>mês</b> controlam este painel.</li>
            </ul>
          </InfoTip>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1" style={{ scrollbarGutter: 'stable' }}>
        {loading && (
          <p className="text-center text-sm text-gray-500 dark:text-darkMuted">Carregando…</p>
       )}
        {!loading && erro && (
          <p className="text-center text-sm text-red-600">{erro}</p>
        )}
        {!loading && !erro && dados.length === 0 && (
          <p className="text-center text-sm text-gray-500 dark:text-darkMuted">Nenhuma despesa encontrada</p>
        )}

        {!loading && !erro && (maxItens ? dados.slice(0, maxItens) : dados).map((fp, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="text-sm font-medium w-32 truncate dark:text-darkMuted" title={fp.nome}>
              {fp.nome}
            </div>

            <div className="flex-1 rounded-full h-4 relative bg-blue-100 dark:bg-darkBorder">
              <div
                className="absolute top-0 left-0 h-4 rounded-full"
                style={{
                  width: `${Math.min(100, fp.percentual)}%`,
                  backgroundColor: darkMode ? '#3B82F6' : '#2563EB'
                }}
              />
            </div>

            <div className="w-12 text-xs text-right text-gray-600 dark:text-darkMuted">
              {Number(fp.percentual).toFixed(0)}%
            </div>

            <div className="w-20 text-sm text-right font-semibold text-gray-800 dark:text-darkText">
              {Number(fp.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}