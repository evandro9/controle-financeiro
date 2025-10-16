export const getMeusInvSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Meus Investimentos',
    content:
      'Um tour rápido: comece escolhendo se quer importar da B3 ou cadastrar manualmente. Depois use os filtros e visualize na tabela.',
    disableBeacon: true, // abre direto
  },
  {
    target: '[data-tour="mi-acoes"]',
    title: 'Importar ou Novo Cadastro',
    content:
      'Escolha se prefere importar automaticamente da B3 ou cadastrar uma nova movimentação manualmente.',
  },
  {
    target: '[data-tour="mi-filtros"]',
    title: 'Filtros',
    content:
      'Filtre por ano, mês, limite e texto (nome). Os resultados da tabela abaixo atualizam conforme você ajusta aqui.',
  },
  {
    target: '[data-tour="mi-tabela"]',
    title: 'Tabela de Movimentações',
    content:
      'Aqui você acompanha os registros filtrados, com tipo, nome, classe, subclasse, quantidade, valores e data.',
  },
];

// Aviso único no mobile (sem passo a passo)
export const getMeusInvMobileNoticeSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Melhor no computador',
    content:
      'Você está acessando esta tela pelo celular pela primeira vez. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
    disableBeacon: true,
  },
];