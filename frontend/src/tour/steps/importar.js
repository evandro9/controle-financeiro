export const getImportarSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Importar & Conciliar',
    content:
      'Um tour rápido: primeiro escolha o tipo de importação, depois a opção de aplicar suas regras automaticamente e, por fim, selecione o arquivo.',
    disableBeacon: true,
  },
  {
    target: '[data-tour="imp-tipo"]',
    title: 'Tipo de importação',
    content:
      'Escolha entre **Extrato de conta** (registros diários da conta) e **Fatura de cartão** (compras parceladas, vencimento/fechamento). O sistema consegue detectar e sugerir o tipo, se houver divergência.',
  },
  {
    target: '[data-tour="imp-regras"]',
    title: 'Aplicar minhas regras automaticamente',
    content:
      'Quando ligado, preenche **Categoria/Subcategoria** com base nas suas regras (descrições reconhecidas). Você poderá revisar e ajustar na prévia.',
  },
  {
    target: '[data-tour="imp-arquivo"]',
    title: 'Selecionar arquivo (CSV/OFX)',
    content:
      'Arraste o arquivo aqui ou clique em **Escolher arquivo**. O formato é detectado automaticamente. Após enviar, você verá a **Prévia** para revisar antes de confirmar.',
  },
];

// Aviso único (MOBILE): em vez do passo a passo completo
export const getImportarMobileNoticeSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Melhor no computador',
    content:
      'Você está acessando esta tela pelo celular pela primeira vez. Recomendamos abrir no computador para ver um passo a passo detalhado de como tudo funciona.',
    disableBeacon: true,
  },
];

// 🔹 Etapa 2 (Prévia): 2 passos no desktop — Forma de pagamento → Tabela/Categoria
export const getImportarPreviewSteps = () => [
  {
    target: '[data-tour="imp-prev-forma"]',
    title: 'Forma de pagamento do arquivo',
    content:
      'Selecione a forma de pagamento que será aplicada como padrão às linhas importadas. Ela é obrigatória para confirmar.',
  },
  {
    target: '[data-tour="imp-prev-tabela"]',
    title: 'Tabela da Prévia (Categoria/Sub)',
    content:
      'Defina Categoria e Subcategoria dos lançamentos e verifique dados como datas, valores e possíveis duplicados. Tudo ok? Aí é só confirmar a importação.',
  },
];