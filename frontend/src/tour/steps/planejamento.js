// 3 passos fixos: Intro → Formulário → Tabela
export const getPlanejamentoSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Planejamento Financeiro',
    content:
      'Primeiro, uma visão geral rápida. Este é um tour rápido para te orientar na página. Você pode pular a qualquer momento.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="plan-form"]',
    title: 'Formulário de Planejamento',
    content:
      'Defina Ano/Mês, Categoria e o Modo (valor fixo ou % da receita) para cadastrar seu planejamento. Você pode replicar para todos os meses e salvar.',
  },
  {
    target: '[data-tour="plan-tab-categoria-tabela"]',
    title: 'Tabela por Categoria',
    content:
      'Mostra o planejado mês a mês por categoria e também um mapa de calor dos seus planejamentos na aba Visão Geral',
  },
];

// Aviso único para mobile (em vez do tour completo)
export const getPlanejamentoMobileNoticeSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Melhor no computador',
    content:
      'Você está acessando esta tela pelo celular pela primeira vez. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
    disableBeacon: true,
  },
];