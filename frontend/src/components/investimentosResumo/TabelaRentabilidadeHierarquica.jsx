import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ThemeContext } from '../../context/ThemeContext';
import InfoTip from '../ui/InfoTip';

function TabelaRentabilidadeHierarquica({ ano }) {
  const [estadoExpansao, setEstadoExpansao] = useState({});
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const { darkMode } = useContext(ThemeContext);

  useEffect(() => {
    const buscar = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/investimentos/rentabilidade-hierarquica`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        setDados(json);
      } catch (err) {
        console.error('Erro ao buscar rentabilidade detalhada', err);
      } finally {
        setLoading(false);
      }
    };
    buscar();
  }, [ano]);

  const toggle = (nivel, chave) => {
    const id = nivel + '-' + chave;
    setEstadoExpansao(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatarValor = (v) => {
    const num = parseFloat(v);
    return isNaN(num) ? '-' : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarRentabilidade = (v) => {
    const num = parseFloat(v);
    return isNaN(num) ? '-' : `${num.toFixed(2)}%`;
  };

  const hasData = useMemo(() => {
    if (!Array.isArray(dados) || !dados.length) return false;
    return dados.some(c => Number(c?.investido || 0) > 0 || Number(c?.atual || 0) > 0);
  }, [dados]);

  return (
    <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder">
      <div className="h-[36px] flex items-center justify-center mb-2 relative">
  <h3 className="text-base font-semibold text-gray-800 dark:text-darkText text-center">
    Rentabilidade Geral
  </h3>

  <div className="absolute right-0">
    <InfoTip title="Rentabilidade Geral" ariaLabel="Informações da tabela">
      <ul className="list-disc pl-4 space-y-1">
        <li>Consolidado por <b>classe</b>, com expansão para <b>subclasse</b> e ativos.</li>
        <li>Mostra valores investidos, valor atual e rentabilidade percentual bruta.</li>
        <li>Clique nas setas para expandir e ver os detalhes.</li>
      </ul>
    </InfoTip>
  </div>
</div>
      <table className="w-full text-sm text-center">
        <thead className="bg-gray-50 dark:bg-darkBg">
          <tr>
            <th className="p-2 text-left pl-6 dark:text-[#d0d7de]">Nome</th>
            <th className="p-2 dark:text-[#d0d7de]">Investido</th>
            <th className="p-2 dark:text-[#d0d7de]">Atual</th>
            <th className="p-2 dark:text-[#d0d7de]">Rentabilidade</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((classe) => {
            const abertoClasse = estadoExpansao['classe-' + classe.nome];
            return (
              <React.Fragment key={`classe-${classe.nome}`}>
                <tr className="border-t font-semibold bg-gray-100 dark:bg-darkBg dark:text-[#adbac7]">
                  <td className="p-2 text-left pl-4">
                    <button onClick={() => toggle('classe', classe.nome)}>
                      {abertoClasse ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>{' '}
                    {classe.nome}
                  </td>
                  <td className="p-2">{formatarValor(classe.investido)}</td>
                  <td className="p-2">{formatarValor(classe.atual)}</td>
                  <td
                    className="p-2"
                    style={{
                      color: classe.rentabilidade >= 0
                        ? (darkMode ? '#3fb950' : 'green')
                        : (darkMode ? '#f85149' : 'red')
                    }}
                  >
                    {formatarRentabilidade(classe.rentabilidade)}
                  </td>
                </tr>
                {abertoClasse && classe.subclasses.map((sub) => {
                  const abertoSub = estadoExpansao['sub-' + classe.nome + '-' + sub.nome];
                  return (
                    <React.Fragment key={`sub-${classe.nome}-${sub.nome}`}>
                      <tr className="border-t bg-white dark:bg-darkCard dark:text-[#adbac7]">
                        <td className="p-2 text-left pl-8">
                          <button onClick={() => toggle('sub', classe.nome + '-' + sub.nome)}>
                            {abertoSub ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>{' '}
                          {sub.nome}
                        </td>
                        <td className="p-2">{formatarValor(sub.investido)}</td>
                        <td className="p-2">{formatarValor(sub.atual)}</td>
                        <td
                          className="p-2"
                          style={{
                            color: sub.rentabilidade >= 0
                              ? (darkMode ? '#3fb950' : 'green')
                              : (darkMode ? '#f85149' : 'red')
                          }}
                        >
                          {formatarRentabilidade(sub.rentabilidade)}
                        </td>
                      </tr>
                      {abertoSub && sub.ativos.map((a) => (
                        <tr key={`ativo-${classe.nome}-${sub.nome}-${a.nome}`} className="border-t bg-gray-50 dark:bg-darkBg dark:text-[#adbac7]">
                          <td className="p-2 text-left pl-12">{a.nome}</td>
                          <td className="p-2">{formatarValor(a.investido)}</td>
                          <td className="p-2">{formatarValor(a.atual)}</td>
                          <td
                            className="p-2"
                            style={{
                              color: a.rentabilidade >= 0
                                ? (darkMode ? '#3fb950' : 'green')
                                : (darkMode ? '#f85149' : 'red')
                            }}
                          >
                            {formatarRentabilidade(a.rentabilidade)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
            {/* LOADING overlay */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/30 rounded">
          <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
               style={{ borderColor: '#3B82F6', borderTopColor: 'transparent' }} />
          <div className="mt-3 text-xs font-medium text-gray-600 dark:text-darkMuted">
            Carregando dados…
          </div>
        </div>
      )}
      {/* EMPTY overlay */}
      {!loading && !hasData && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="px-3 py-2 rounded-md text-xs font-medium bg-white/80 dark:bg-black/40 text-gray-600 dark:text-darkMuted border border-gray-200 dark:border-darkBorder">
            Sem dados para este período.
          </div>
        </div>
      )}
    </div>
  );
}

export default TabelaRentabilidadeHierarquica;