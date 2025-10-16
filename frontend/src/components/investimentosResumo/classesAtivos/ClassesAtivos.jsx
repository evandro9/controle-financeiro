import React, { useMemo, useState } from "react";
import useClassesInvestimento from "../../../hooks/useClassesInvestimento";
import InspectorPosicaoAtivo from "../../../components/investimentosResumo/InspectorPosicaoAtivo"; // já existente
import FiltroClassesPeriodoInline from "../../../components/investimentosResumo/classesAtivos/FiltroClassesPeriodoInline";
import GraficoPatrimonioPorClasse from "../../../components/investimentosResumo/classesAtivos/GraficoPatrimonioPorClasse";
import GraficoPizzaClasse from "../classesAtivos/GraficoPizzaClasse";

export default function AbaClassesDeAtivos() {
  // período controlado (ano/mes) – mantém padrão do teu FiltroPeriodo
  const hoje = new Date();
  const [periodo, setPeriodo] = useState('ano'); // 'ano' | '12m' | '24m' | 'inicio'

  // busca classes dinâmicas
  const { options: classesOptions, loading: loadingClasses, error: erroClasses } = useClassesInvestimento();

  // seleciona a primeira classe como padrão (quando carregar)
  const defaultClasse = useMemo(() => (classesOptions[0]?.key ?? null), [classesOptions]);
  const [classe, setClasse] = useState(null);
  React.useEffect(() => {
    if (classe == null && defaultClasse != null) setClasse(defaultClasse);
  }, [defaultClasse, classe]);

  // Converte o key selecionado para o label da opção (que é o "nome" da hierarquia)
  const classeNome = useMemo(() => {
    const opt = classesOptions.find(o => o.key === classe);
    return opt?.label || null;
  }, [classesOptions, classe]);

  const [pizzaDados, setPizzaDados] = React.useState([]);
  const [loadingPizza, setLoadingPizza] = React.useState(false);
  const [erroPizza, setErroPizza] = React.useState("");

React.useEffect(() => {
  if (!classe) return;
  (async () => {
    try {
      setErroPizza("");
      setLoadingPizza(true);
      const apiBase = import.meta.env.VITE_API_URL ?? "/api";
      const token = localStorage.getItem("token");
      const url = `${apiBase}/investimentos/posicao-mensal-por-ativo?periodo=${encodeURIComponent(periodo)}&classe_id=${encodeURIComponent(classe)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const rows = r.ok ? await r.json() : [];
      if (!Array.isArray(rows) || !rows.length) { setPizzaDados([]); return; }

      // pega último mês disponível
      const meses = Array.from(new Set(rows.map(i => String(i.mes)))).sort();
      const ultimo = meses[meses.length - 1];
      const doUltimo = rows.filter(i => String(i.mes) === ultimo);

      // soma por ativo
      const soma = doUltimo.reduce((map, it) => {
        const k = String(it.ativo || it.ticker || it.nome || "—");
        const v = Number(it.atual || it.valor_atual || 0);
        map.set(k, (map.get(k) || 0) + v);
        return map;
      }, new Map());

      const ordenado = Array.from(soma.entries()).sort((a,b)=>b[1]-a[1]);
      const TOP = 12;
      const top = ordenado.slice(0, TOP).map(([name, value]) => ({ name, value }));
      const outrosVal = ordenado.slice(TOP).reduce((s, [,v]) => s+v, 0);
      setPizzaDados(outrosVal > 0 ? [...top, { name: "Outros", value: outrosVal }] : top);
    } catch (err) {
      console.error("Erro ao carregar pizza:", err);
      setPizzaDados([]);
    } finally {
      setLoadingPizza(false);
    }
  })();
}, [classe, periodo]);

  return (
    <div className="space-y-4">
     {/* Filtro: Classe & Período */}
     <div data-tour="inv-ativos-filtro">
       <FiltroClassesPeriodoInline
       title="Classe & Período"
       classesOptions={classesOptions}
       classeValue={classe}
       onClasseChange={setClasse}
       periodoValue={periodo}
       onPeriodoChange={setPeriodo}
       />
     </div>

      {erroClasses && (
        <div className="text-sm text-red-500">{erroClasses}</div>
      )}

     {/* Histórico do Patrimônio por Classe */}
     <div data-tour="inv-ativos-historico">
       <GraficoPatrimonioPorClasse
         classeId={classe}
         periodo={periodo}
         title="Histórico do Patrimônio por Classe"
       />
     </div>

     {/* Distribuição por Ativo (pizza) */}
     <div data-tour="inv-ativos-pizza">
       <GraficoPizzaClasse
         titulo={`Distribuição por Ativo`}
         dados={pizzaDados}
         carregando={loadingPizza}
       />
     </div>

      {/* Inspector / Detalhe de Posição por Ativo */}
      <div data-tour="inv-ativos-inspector">
        <InspectorPosicaoAtivo classeSelecionada={classeNome} />
      </div>
      
    </div>
  );
}