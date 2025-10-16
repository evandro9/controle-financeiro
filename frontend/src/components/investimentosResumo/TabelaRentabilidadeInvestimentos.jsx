import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import InfoTip from '../ui/InfoTip';
import { ThemeContext } from '../../context/ThemeContext';

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const TabelaRentabilidadeInvestimentos = ({ ano }) => {
  const [dados, setDados] = useState([]);
  const [totalGeral, setTotalGeral] = useState({});
  const [expansao, setExpansao] = useState({});
  const [loading, setLoading] = useState(false);
  const { darkMode } = useContext(ThemeContext);
  // 🔹 Ano local da tabela (independente do "Período" global)
  const anoAtual = new Date().getFullYear();
  const [anoTabela, setAnoTabela] = useState(Number(ano) || anoAtual);

  useEffect(() => {
    if (ano && Number(ano) !== anoTabela) setAnoTabela(Number(ano));
  }, [ano]);

  useEffect(() => {
    console.log(`🔍 [TabelaRentabilidadeInvestimentos] Ano recebido como prop:`, ano);

    if (!anoTabela) {
      console.warn("⚠️ Ano não definido, abortando fetch.");
      return;
    }

    const buscar = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const params = new URLSearchParams();
        params.set('metodo', 'twr'); // fixo
        params.set('debug', '0');
        const url = `/api/investimentos/rentabilidade-subclasse-ativo/${anoTabela}?${params.toString()}`;

        console.log(`🌐 Buscando dados em: ${url}`);

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          console.error(`❌ Erro HTTP: ${res.status}`);
          return;
        }

        const json = await res.json();
        console.log("📥 Dados recebidos do backend:", json);

        if (json && Array.isArray(json.dados)) {
          setDados(json.dados);
          setTotalGeral(json.totalGeral || {});
        } else {
          console.warn("⚠️ Formato inesperado de resposta:", json);
          setDados([]);
          setTotalGeral({});
        }
      } catch (err) {
        console.error('Erro ao buscar rentabilidade por ativo', err);
      } finally {
        setLoading(false);
      }
    };

    buscar();
}, [anoTabela]); // só depende do ano

  // Agrupar por subclasse e depois por ativo
  const agrupado = {};

  dados.forEach(d => {
    if (d.tipo === 'subclasse') return; // não agrupar linhas de média como ativo

    const mesNum = parseInt(d.mes);
    const sub = d.subclasse;

    if (!agrupado[sub]) agrupado[sub] = { ativos: {} };
    if (!agrupado[sub].ativos[d.ativo]) agrupado[sub].ativos[d.ativo] = {};

    agrupado[sub].ativos[d.ativo][mesNum] = d.rentabilidade_pct;

    if (!agrupado[sub].subclasse) agrupado[sub].subclasse = {};
    if (!agrupado[sub].subclasse[mesNum]) agrupado[sub].subclasse[mesNum] = [];
    agrupado[sub].subclasse[mesNum].push(d.rentabilidade_pct);
  });

  // Calcular média ponderada por subclasse localmente (com base nas linhas de tipo 'subclasse')
  dados
    .filter(d => d.tipo === 'subclasse')
    .forEach(d => {
      const mesNum = parseInt(d.mes);
      const sub = d.subclasse;
      if (!agrupado[sub]) agrupado[sub] = { ativos: {} };
      if (!agrupado[sub].subclasse) agrupado[sub].subclasse = {};
      agrupado[sub].subclasse[mesNum] = d.rentabilidade_pct;
    });

  const formatar = (v) =>
    v === null || v === undefined || isNaN(v) ? '-' : `${v.toFixed(2)}%`;

  const corCelula = (valor) => {
    if (valor === null || valor === undefined || isNaN(valor)) return '';
    return valor >= 0
      ? (darkMode ? 'text-[#3fb950]' : 'text-green-600')
      : (darkMode ? 'text-[#f85149]' : 'text-red-600');
  };

  const toggle = (subclasse) => {
    setExpansao(prev => ({ ...prev, [subclasse]: !prev[subclasse] }));
  };

  const hasData = useMemo(() => {
    const anyRow = Array.isArray(dados) && dados.some(d => Number.isFinite(Number(d?.rentabilidade_pct)));
    const anyTG  = totalGeral && Object.values(totalGeral).some(v => v != null);
    return anyRow || anyTG;
  }, [dados, totalGeral]);

  return (
    <div className="relative bg-white dark:bg-darkCard rounded-xl shadow p-4 border border-gray-100 dark:border-darkBorder">
      {/* Header da tabela com seletor de Ano + nova barrinha de método/proventos */}
<div className="h-[36px] mb-3 relative flex items-center justify-center">
  {/* Título centralizado */}
  <h3 className="text-base font-semibold text-gray-800 dark:text-darkText text-center">
    Rentabilidade por Subclasse e Ativo (Mês a Mês)
  </h3>

  {/* Seletor de ano à esquerda */}
  <div className="absolute left-0 flex items-center gap-2">
    <label className="text-sm text-gray-600 dark:text-darkMuted">Ano:</label>
    <select
      value={anoTabela}
      onChange={(e) => setAnoTabela(Number(e.target.value))}
      className="border px-2 py-1 rounded bg-white dark:bg-darkBg text-gray-800 dark:text-darkText border-gray-300 dark:border-darkBorder"
    >
      {Array.from({ length: 10 }, (_, i) => anoAtual - i).map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  </div>

  {/* InfoTip à direita */}
  <div className="absolute right-0">
    <InfoTip title="Como ler esta tabela" ariaLabel="Informações da tabela">
      <ul className="list-disc pl-4 space-y-1">
        <li>Linha da <b>subclasse</b> mostra a média mensal da subclasse.</li>
        <li>Clique para expandir e ver os <b>ativos</b> e suas rentabilidades mês a mês.</li>
        <li>Valores em <b>%</b> (TWR). Verde para positivo, vermelho para negativo.</li>
      </ul>
    </InfoTip>
  </div>
</div>

      <div className="overflow-auto">
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-darkBg font-semibold text-gray-800 dark:text-darkText border-b border-gray-200 dark:border-darkBorder">
              <th className="text-left px-3 py-2">Subclasse / Ativo</th>
              {meses.map((m, i) => (
                <th key={i} className="text-center px-3 py-2">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(agrupado)
              .filter(([subclasse, grupo]) => {
                if (!subclasse || subclasse === 'undefined') return false;
                if (subclasse !== 'Outros') return true;
                // Esconde "Outros" quando TODOS os ativos/meses estão zerados/nulos
                const isVal = (v) => v != null && !isNaN(v) && Math.abs(Number(v)) > 1e-8;
                const anyAtivoHasValue = Object.values(grupo.ativos || {}).some(mapaMes =>
                  Object.values(mapaMes || {}).some(isVal)
                );
                const anySubclasseHasValue = Object.values(grupo.subclasse || {}).some(isVal);
                return anyAtivoHasValue || anySubclasseHasValue;
              })
              .map(([subclasse, grupo]) => {
                const aberto = expansao[subclasse];
                const mediaSubclasse = grupo.subclasse || {};

                return (
                  <React.Fragment key={subclasse}>
                    <tr
                      className="bg-gray-50 dark:bg-darkBg font-semibold text-gray-800 dark:text-darkText cursor-pointer border-b border-gray-200 dark:border-darkBorder"
                      onClick={() => toggle(subclasse)}
                    >
                      <td className="px-3 py-2 text-left">
                        {aberto
                          ? <ChevronDown size={14} className="inline mr-1" />
                          : <ChevronRight size={14} className="inline mr-1" />}
                        {subclasse}
                      </td>
                      {meses.map((_, i) => (
                        <td key={i} className={`text-center ${corCelula(mediaSubclasse[i + 1])}`}>
                          {formatar(mediaSubclasse[i + 1])}
                        </td>
                      ))}
                    </tr>
                    {aberto && Object.entries(grupo.ativos).map(([ativo, rentabilidades]) => (
                      <tr key={ativo} className="dark:text-darkText hover:bg-gray-100 hover:dark:bg-darkCard border-b border-gray-100 dark:border-darkBorder">
                        <td className="px-3 py-1 text-left pl-6">{ativo}</td>
                        {meses.map((_, i) => (
                          <td key={i} className={`text-center ${corCelula(rentabilidades[i + 1])}`}>
                            {rentabilidades[i + 1] !== undefined ? formatar(rentabilidades[i + 1]) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            <tr className="bg-gray-200 dark:bg-darkBg font-semibold text-gray-900 dark:text-darkText border-t border-gray-300 dark:border-darkBorder">
              <td className="px-3 py-2 text-left">Média Geral</td>
              {meses.map((_, i) => {
                const valor = totalGeral[i + 1]; // usa somente o backend
                return (
                  <td key={i} className={`text-center ${corCelula(valor)}`}>
                    {formatar(valor)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
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
};

export default TabelaRentabilidadeInvestimentos;