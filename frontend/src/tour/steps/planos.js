export const getPlanosSteps = () => {
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Entenda a tela Meus Planos',
      content:
        'Este é um tour rápido para te orientar na tela. Você pode pular a qualquer momento.',
      disableBeacon: true,
    },
    {
      target: '[data-tour="planos-grafico"]',
      title: 'Gráfico para acompanhamento',
      content:
        'Acompanhe Receitas, Despesas, Saldo e Aportes nos seus planos mês a mês.',
    },
    {
      target: '[data-tour="planos-cards"]',
      title: 'Cards de Resumo',
      content:
        'Mostram o total de planos, o total arrecadado e o valor restante (o que ainda falta para concluir todos os planos).',
    },
    {
      target: '[data-tour="planos-lista"]',
      title: 'Lista de Planos',
      content:
        'Aqui você encontra cada plano com progresso, parcelas restantes e ações: aportar/retirar, editar, excluir e ver evolução. Se estiver vazio, use “Novo Plano” para começar.',
    },
  ];
};

// 🔸 Aviso único (MOBILE): em vez do passo a passo completo
export const getPlanosMobileNoticeSteps = () => {
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Melhor no computador',
      content:
        'Você está acessando esta tela pela primeira vez pelo celular. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
      disableBeacon: true,
    },
  ];
};