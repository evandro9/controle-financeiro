function agruparInvestimentos(dados) {
  const mapa = {};

  dados.forEach((inv) => {
    const classe = inv.categoria || 'Outros';
    const subclasse = inv.subcategoria || 'Outros';
    const ativo = inv.nome_investimento || 'Desconhecido';
    const valor_investido = inv.valor_total || 0;

    if (!mapa[classe]) {
      mapa[classe] = { investido: 0, atual: 0, subclasses: {} };
    }
    if (!mapa[classe].subclasses[subclasse]) {
      mapa[classe].subclasses[subclasse] = { investido: 0, atual: 0, ativos: {} };
    }
    if (!mapa[classe].subclasses[subclasse].ativos[ativo]) {
      mapa[classe].subclasses[subclasse].ativos[ativo] = { investido: 0, atual: 0 };
    }

    // Simulação de valor atual com variação aleatória
    const fator = 1 + Math.random() * 0.3;
    const valor_atual = valor_investido * fator;

    mapa[classe].investido += valor_investido;
    mapa[classe].atual += valor_atual;

    mapa[classe].subclasses[subclasse].investido += valor_investido;
    mapa[classe].subclasses[subclasse].atual += valor_atual;

    mapa[classe].subclasses[subclasse].ativos[ativo].investido += valor_investido;
    mapa[classe].subclasses[subclasse].ativos[ativo].atual += valor_atual;
  });

  const resultado = Object.entries(mapa).map(([classeNome, classeDados]) => {
    const subclasses = Object.entries(classeDados.subclasses).map(([subNome, subDados]) => {
      const ativos = Object.entries(subDados.ativos).map(([ativoNome, ativoDados]) => ({
        nome: ativoNome,
        investido: ativoDados.investido,
        atual: ativoDados.atual,
        rentabilidade: ((ativoDados.atual - ativoDados.investido) / ativoDados.investido) * 100
      }));

      return {
        nome: subNome,
        investido: subDados.investido,
        atual: subDados.atual,
        rentabilidade: ((subDados.atual - subDados.investido) / subDados.investido) * 100,
        ativos
      };
    });

    return {
      nome: classeNome,
      investido: classeDados.investido,
      atual: classeDados.atual,
      rentabilidade: ((classeDados.atual - classeDados.investido) / classeDados.investido) * 100,
      subclasses
    };
  });

  return resultado;
}