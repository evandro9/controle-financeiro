import React from "react";
import InfoTip from "../../ui/InfoTip";

export default function CardsProventos({ resumo, darkMode }) {
  const items = [
    {
      t: "Total Investido",
      v: resumo.totalInvestido,
      fmt: "moeda",
      tip: (
        <p>
          Soma dos <b>valores aplicados</b> em todos os ativos que <b>já receberam proventos </b>
          no período considerado.
        </p>
      ),
    },
    {
      t: "Renda Acumulada",
      v: resumo.rendaAcumulada,
      fmt: "moeda",
      tip: (
        <p>
          <b>Soma total</b> dos proventos recebidos (dividendos, JCP, etc.) no período.
        </p>
      ),
    },
    {
      t: "Média Mensal",
      v: resumo.mediaMensal,
      fmt: "moeda",
      tip: (
        <p>
          <b>Valor médio</b> de proventos recebidos por mês dentro do período selecionado.
        </p>
      ),
    },
    {
      t: "Yield on Cost",
      v: resumo.yieldOnCost,
      fmt: "pct",
      tip: (
        <div className="space-y-1">
          <p>
            Relação entre a <b>renda acumulada</b> (proventos) e o <b>valor total
            aplicado</b> na carteira.
          </p>
          <p className="text-xs">
            <b>Cálculo:</b> renda de proventos ÷ valor aplicado × 100.
          </p>
          <p className="text-xs">
            Ajuda a entender o <b>retorno sobre o capital inicial investido</b>, independente
            do valor <i>atual</i> dos ativos.
          </p>
        </div>
      ),
    },
  ];

  const formatMoeda = (n) =>
    Number(n || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  // % com 2 casas
  const formatPct = (n) =>
    `${Number(n || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`;

  // (opcional) se em algum ponto ficou "formatpct" minúsculo:
  // const formatpct = formatPct;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
{items.map((item) => (
        <div
          key={item.t}
          className="relative rounded-xl p-4 bg-white dark:bg-darkCard border border-gray-100 dark:border-darkBorder shadow"
        >
          {/* InfoTip fixo no canto */}
          <div className="absolute top-2 right-2">
            <InfoTip title={item.t} ariaLabel={`Informações sobre ${item.t}`}>
              {item.tip}
            </InfoTip>
          </div>

          {/* Título centralizado */}
          <div className="text-sm tracking-wide text-gray-500 dark:text-gray-400 text-center">
            {item.t}
          </div>
          <div className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-darkText mt-1 text-center">
            {item.fmt === "moeda" ? formatMoeda(item.v) : formatPct(item.v)}
          </div>
        </div>
      ))}
    </div>
  );
}