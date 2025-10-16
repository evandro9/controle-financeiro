export const getLancamentosSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Movimentações Financeiras',
    content:
      'Este é um tour rápido para te orientar nos lançamentos. Você pode pular a qualquer momento.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="mov-filtros"]',
    title: 'Filtros',
    content:
      'Selecione ano, mês, quantidade, status, forma de pagamento e ordenação. A lista e os totais abaixo se atualizam conforme sua escolha.',
  },
  {
    target: '[data-tour="mov-cards"]',
    title: 'Cards de Resumo',
    content:
      'Visão rápida: despesas do mês, a pagar no mês, vencidos e a pagar (total). Útil para acompanhar pendências e volume do período.',
  },
  {
    target: '[data-tour="mov-tabela"]',
    title: 'Tabela de Movimentações',
    content:
      'Lista de lançamentos com tipo, datas, valores, categorias e ações. Use os filtros acima para refinar a busca.',
  },
];

// Aviso único (MOBILE): em vez do passo a passo completo
export const getLancamentosMobileNoticeSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Melhor no computador',
    content:
      'Você está acessando esta tela pelo celular pela primeira vez. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
    disableBeacon: true,
  },
];