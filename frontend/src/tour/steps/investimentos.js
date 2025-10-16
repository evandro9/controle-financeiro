export const getInvestimentosSteps = () => {
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Resumo de Investimentos',
      content:
        'Um tour rápido pela aba Resumo: começamos pela escolha do tipo de análise, depois passamos pelos gráficos e tabelas principais.',
      disableBeacon: true,
    },
    {
      target: '[data-tour="inv-analises"]',
      title: 'Escolha do Tipo de Análise',
      content:
        'Selecione aqui qual tipo de análise deseja ver: Resumo, Classes de Ativos e Proventos. Este tour cobre a aba Resumo.',
    },
    {
      target: '[data-tour="inv-dist-geral"]',
      title: 'Distribuição Geral',
      content:
        'Mostra a proporção do valor atual por classe. Use a legenda para identificar cada segmento.',
    },
    {
      target: '[data-tour="inv-dist-subclasse"]',
      title: 'Distribuição por Subclasse',
      content:
        'Proporção do valor atual por subclasse. Compare lado a lado com a distribuição geral.',
    },
    {
      target: '[data-tour="inv-periodo"]',
      title: 'Período de Análise',
      content:
        'Altere o intervalo (No Ano, 12m, 24m, Do Início). Os gráficos abaixo atualizam conforme o período.',
    },
    {
      target: '[data-tour="inv-aportes"]',
      title: 'Aportes Mensais',
      content:
        'Acompanhe mês a mês seus aportes e retiradas. Ajuda a enxergar a intensidade de aportes e resgates ao longo do tempo.',
    },
    {
      target: '[data-tour="inv-historico"]',
      title: 'Histórico do Patrimônio',
      content:
        'Compara valor investido x valor atual ao longo do período para visualizar a evolução do patrimônio ou a rentabilidade diária da sua carteira.',
    },
    {
      target: '[data-tour="inv-rent-geral"]',
      title: 'Rentabilidade Geral',
      content:
        'Visão agregada da rentabilidade por classes/subclasses no período. Útil para perceber onde a performance está concentrada.',
    },
    {
      target: '[data-tour="inv-rent-mensal"]',
      title: 'Rentabilidade Mensal Geral',
      content:
        'Evolução mensal da rentabilidade consolidada. Observe tendências, picos e quedas ao longo dos meses.',
    },
    {
      target: '[data-tour="inv-rent-por-ativo"]',
      title: 'Rentabilidade por Subclasse e Ativo',
      content:
        'Detalhamento por subclasse e por ativo. Permite identificar quem puxa a rentabilidade para cima (ou para baixo).',
    },
  ];
};

// 🔸 Aviso único (MOBILE): em vez do passo a passo completo
export const getInvestimentosMobileNoticeSteps = () => {
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Melhor no computador',
      content:
        'Você está acessando a aba Resumo pelo celular pela primeira vez. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
      disableBeacon: true,
    },
  ];
};

// 🔹 Tour – Aba "Classes de Ativos" (desktop apenas)
export const getInvestimentosAtivosSteps = () => {
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Classes de Ativos',
      content:
        'Nesta aba você aprofunda a análise por classe/subclasse. Vamos passar pelos principais blocos.',
      disableBeacon: true,
    },
    {
      target: '[data-tour="inv-ativos-filtro"]',
      title: 'Classe & Período',
      content:
        'Escolha a classe que deseja analisar e o período (ano, 12m, 24m ou do início). Os gráficos abaixo seguem essa seleção.',
    },
    {
      target: '[data-tour="inv-ativos-historico"]',
      title: 'Histórico do Patrimônio por Classe',
      content:
        'Linha de evolução do valor da classe ao longo do tempo — útil para ver tendência e momentos de inflexão. Você também pode ver detalhado por ativo.',
    },
    {
      target: '[data-tour="inv-ativos-pizza"]',
      title: 'Distribuição por Ativo',
      content:
        'Mostra os ativos que formam a classe (TOP 12 + “Outros”). Ajuda a ver concentração e diversificação.',
    },
    {
      target: '[data-tour="inv-ativos-inspector"]',
      title: 'Inspector de Posição por Ativo',
      content:
        'Lista detalhada dos ativos da classe selecionada, com posição e informações para investigação rápida.',
    },
  ];
};

// 🔹 Tour – Aba "Proventos" (desktop apenas)
export const getInvestimentosProventosSteps = () => {
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Proventos',
      content:
        'Aqui você acompanha dividendos/JCP ao longo do tempo. Vamos passar pelos principais componentes.',
      disableBeacon: true,
    },
    {
      target: '[data-tour="inv-prov-periodo"]',
      title: 'Período dos Proventos',
      content:
        'Altere o intervalo (No ano, 12m, 24m, Do início). Os componentes abaixo se ajustam ao período selecionado.',
    },
    {
      target: '[data-tour="inv-prov-cards"]',
      title: 'Cards de Resumo',
      content:
        'Total investido, renda acumulada, média mensal, resultado e yield on cost.',
    },
    {
      target: '[data-tour="inv-prov-historico"]',
      title: 'Histórico de Proventos',
      content:
        'Evolução dos proventos ao longo do tempo. Útil para ver sazonalidade e tendência.',
    },
    {
      target: '[data-tour="inv-prov-distrib"]',
      title: 'Distribuição de Proventos',
      content:
        'Distribuição dos proventos por ativo/ticker no período filtrado (visível no desktop).',
    },
  ];
};