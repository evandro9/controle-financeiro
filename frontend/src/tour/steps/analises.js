export const getAnalisesSteps = () => {
  // Desktop: tour completo
  return [
    {
      target: 'body',
      placement: 'center',
      title: 'Análises de Despesas',
      content:
        'Um tour rápido pelos filtros, gráficos comparativos e a tabela-resumo para investigar seus gastos.',
      disableBeacon: true,
    },
    {
      target: '[data-tour="analises-filtros"]',
      title: 'Filtros',
      content:
        'Escolha o ano e o intervalo de meses. Você pode filtrar ainda por categoria se preferir',
    },
    {
      target: '[data-tour="analises-linha-categorias"]',
      title: 'Evolução de gastos por Categoria',
      content:
        'Acompanha a evolução mensal das categorias; útil para detectar tendências.',
    },
    {
      target: '[data-tour="analises-barras-subcategorias"]',
      title: 'Comparativo por Subcategorias',
      content:
        'Mostra as subcategorias que mais pesam no período. Ideal para saber onde controlar melhor os gastos.',
    },
    {
      target: '[data-tour="analises-pizza-distribuicao"]',
      title: 'Distribuição de gastos no Período',
      content:
        'Veja o percentual de gasto de cada categoria no período filtrado. Se preferir outra vizualização, clique em "Barras" para alterar o gráfico',
    },
    {
      target: '[data-tour="analises-barras-recdesp"]',
      title: 'Receitas x Despesas',
      content:
        'Acompanhe receitas e despesas mês a mês de acordo com o intervalo selecionado ou, se preferir, escolha Anual para ver o montante total.',
    },
    {
      target: '[data-tour="analises-tabela-resumo"]',
      title: 'Tabela Resumo Comparativa',
      content:
        'Resumo por mês e por categoria para uma visão em tabela que facilita a análise.',
    },
    {
      target: '[data-tour="analises-radar-habitos"]',
      title: 'Radar de Hábitos de Gasto',
      content:
        'Normaliza categorias para comparar hábitos relativos. Útil para ver desequilíbrios.',
    },
    {
      target: '[data-tour="analises-recorrencia"]',
      title: 'Análise de Despesas Recorrentes',
      content:
        'Avalia padrões de recorrência (mensalidades, assinaturas) para identificar oportunidades de ajuste.',
    },
  ];
};

// 🔸 Aviso único (MOBILE): em vez do passo a passo completo
export const getAnalisesMobileNoticeSteps = () => {
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