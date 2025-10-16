export const getBalancoSteps = () => {
  const isDark =
    (typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')) ||
    (typeof localStorage !== 'undefined' &&
      localStorage.getItem('theme') === 'dark');

  const heatmapContent = isDark
    ? 'Cada dia do mês é um quadrado. Quanto mais claro, maior o gasto do dia. Clique em um dia para ver a lista de despesas.'
    : 'Cada dia do mês é um quadrado. Quanto mais escuro, maior o gasto do dia. Clique em um dia para ver a lista de despesas.';

  return [
    {
    target: 'body', // primeiro passo sem alvo específico
    placement: 'center',
    title: 'Conheça nossa tela de Balanços',
    content:
      'Este tour mostra os principais recursos desta tela. Você pode pular ou encerrar quando quiser.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="balanco-filtro"]',
    title: 'Filtro Global de Período',
    content:
      'Escolha o ano e o mês. Todos os gráficos atualizam com base na sua escolha.',
  },
  {
    target: '[data-tour="balanco-cards"]',
    title: 'Cards do Resumo',
    content:
      'Tenha uma visão rápida de receitas, despesas e saldo.',
  },
  {
    target: '[data-tour="balanco-grafico-linha"]',
    title: 'Receitas x Despesas',
    content:
      'Acompanhe a evolução das suas receitas e despesas mês a mês.',
  },
  {
    target: '[data-tour="balanco-grafico-planejamento"]',
    title: 'Realizado x Planejado',
    content:
      'Mostra o percentual que você já gastou de acordo com o planejado e também o quanto ainda pode gastar.',
  },
  {
    target: '[data-tour="balanco-grafico-categorias"]',
    title: '% por Categoria (sobre a Receita)',
    content:
      'Analise o percentual da categoria de despesa em relação à receita do mês. Útil para identificar o que mais pesa no orçamento.',
  }, 
  {
    target: '[data-tour="balanco-grafico-formas"]',
    title: 'Gastos por Formas de Pagamento',
    content:
      'Mostra como as despesas se distribuem entre suas formars de pagamento: cartão, débito, pix, etc.',
  },
  {
    target: '[data-tour="balanco-heatmap"]',
    title: 'Calendário de Calor de Despesas',
    content: heatmapContent,
  },
  {
    target: '[data-tour="balanco-comparador"]',
    title: 'Comparador de Períodos',
    content:
      'Ideal para você comparar o mês atual com o anterior e (se houver dados) com o mesmo mês do ano anterior.',
    },
  ];
};

// 🔸 Aviso único (MOBILE): em vez do passo a passo completo
export const getBalancoMobileNoticeSteps = () => {
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Melhor no computador',
      content:
        'Você está acessando esta tela pelo celular pela primeira vez. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
      disableBeacon: true,
    },
  ];
};