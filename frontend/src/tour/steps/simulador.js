import React from 'react';

export const getSimuladorSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Simulador de Investimentos',
    content:
      'Um tour rápido: preencha os inputs, veja a evolução do patrimônio na tabela da esquerda e os detalhes comparativos na tabela da direita.',
    disableBeacon: true, // abre direto
  },
  {
    target: '[data-tour="sim-inputs"]',
    title: 'Parâmetros do Simulador',
    content:
      'Defina valor inicial, aporte, taxa/ano, período, capitalização (com ou sem juros compostos) e demais opções.',
  },
  {
    target: '[data-tour="sim-tab-left"]',
    title: 'Crescimento do Patrimônio',
    content:
      'A tabela da esquerda mostra a evolução mês a mês/ano a ano, considerando os parâmetros definidos.',
  },
  {
    target: '[data-tour="sim-tab-right"]',
    title: 'Detalhes/Comparativos',
    content:
      'A tabela da direita apresenta resumos, comparativos e métricas auxiliares para sua análise.',
  },
];

export const getSimuladorMobileNoticeSteps = () => [
  {
    target: 'body',
    placement: 'center',
    title: 'Melhor no computador',
    content:
      'Você está acessando o simulador pelo celular pela primeira vez. Recomendamos abrir no computador para ver um passo a passo detalhado.',
    disableBeacon: true,
  },
];