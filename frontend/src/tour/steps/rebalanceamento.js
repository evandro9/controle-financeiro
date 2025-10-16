export const getRebalanceSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Rebalanceamento',
    content:
      'Um tour rápido: veja sua distribuição atual, compare com a distribuição desejada e use a tabela para ajustar a alocação por classe.',
    disableBeacon: true, // abre direto
  },
  {
    target: '[data-tour="reb-dist-atual"]',
    title: 'Distribuição Atual',
    content:
      'Mostra sua alocação atual por classe/subclasse. Use como referência do estado presente da carteira.',
  },
  {
    target: '[data-tour="reb-dist-desejada"]',
    title: 'Distribuição Desejada',
    content:
      'Defina a meta de alocação. É com base nela que surgem sugestões de rebalanceamento.',
  },
  {
    target: '[data-tour="reb-tabela-alocacao"]',
    title: 'Tabela de Alocação por Classe',
    content:
      'Resumo por classe com atual, desejado e diferença. Use como guia para decisões de aporte/venda.',
  },
];

// Aviso único no mobile (sem passo a passo)
export const getRebalanceMobileNoticeSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Melhor no computador',
    content:
      'Você está acessando esta tela pelo celular pela primeira vez. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
    disableBeacon: true,
  },
];