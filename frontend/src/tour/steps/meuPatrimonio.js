export const getMeuPatrimonioSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Meu Patrimônio',
    content:
      'Um tour rápido: veja o resumo em cards, acompanhe o gráfico de evolução, use a calculadora de saldo, atualize o mês e confira tudo na tabela.',
    disableBeacon: true, // abre direto
  },
  {
    target: '[data-tour="pat-cards"]',
    title: 'Cards de Resumo',
    content:
      'Patrimônio total, evolução no ano, objetivo do ano e % atingida — sempre considerando o ano selecionado.',
  },
  {
    target: '[data-tour="pat-grafico"]',
    title: 'Gráfico de Evolução do Patrimônio',
    content:
      'Evolução mensal consolidada (BRL/ USD). Use o seletor de moeda para alternar a visualização.',
  },
  {
    target: '[data-tour="pat-calc"]',
    title: 'Calculadora de Saldo',
    content:
      'Simule ajustes por conta e veja o impacto no consolidado antes de registrar.',
  },
  {
    target: '[data-tour="pat-atualiza"]',
    title: 'Atualização Mensal',
    content:
      'Informe saldo, aportes e retiradas do mês por conta. Ao salvar, os dados de cima são atualizados.',
  },
  {
    target: '[data-tour="pat-tabela"]',
    title: 'Tabela por Conta e Mês',
    content:
      'Planilha com saldos por mês em cada conta e indicadores de evolução — base para conferência e análise.',
  },
];

// Aviso único no mobile (sem passo a passo)
export const getMeuPatrimonioMobileNoticeSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Melhor no computador',
    content:
      'Você está acessando esta tela pelo celular pela primeira vez. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
    disableBeacon: true,
  },
];