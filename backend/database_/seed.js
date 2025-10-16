const db = require('./db');

const categorias = [
  {
    nome: 'Receitas Fixas',
    subcategorias: [
      'Fonte de Renda 1 (Líquido) (Salário)',
      'Fonte de Renda 2 (Líquido) (Distribuição)',
      'Reembolsos / Outros'
    ]
  },
  {
    nome: 'Receitas Variáveis',
    subcategorias: [
      '13o salário líquido',
      'Férias',
      'Bônus e extras'
    ]
  },
  {
    nome: 'Habitação',
    subcategorias: [
      'Aluguel / Prestação',
      'Condomínio',
      'IPTU + Taxas Municipais',
      'Conta de energia',
      'Conta de água',
      'Conta de gás',
      'Telefone fixo',
      'Telefones celulares',
      'Internet',
      'Streaming',
      'Supermercado',
      'Feira',
      'Padaria',
      'Empregados',
      'Assinaturas',
      'Outros Habitação'
    ]
  },
  {
    nome: 'Saúde',
    subcategorias: [
      'Plano de Saúde',
      'Suplemento',
      'Dentista',
      'Medicamentos',
      'Personal',
      'Outros Saúde'
    ]
  },
  {
    nome: 'Transporte',
    subcategorias: [
      'Prestação',
      'IPVA + Seguro Obrigatório',
      'Seguro',
      'Combustível',
      'Estacionamentos',
      'Lavagens',
      'Mecânico',
      'Multas',
      'Pedágio',
      'Aluguel Carro',
      'Trem',
      'Táxi/Uber',
      'Outros Transporte'
    ]
  },
  {
    nome: 'Despesas Pessoais',
    subcategorias: [
      'Higiene Pessoal (unha, depilação etc.)',
      'Cosméticos',
      'Cabeleireiro',
      'Vestuário',
      'Academia',
      'Esportes',
      'Cartões de Crédito (Anuidade)',
      'Mesadas',
      'Outros Despesas Pessoais'
    ]
  },
  {
    nome: 'Educação',
    subcategorias: [
      'Escola / Faculdade',
      'Curso Inglês',
      'ONM',
      'Material escolar',
      'Uniformes',
      'Outros Educação'
    ]
  },
  {
    nome: 'Lazer',
    subcategorias: [
      'Restaurantes',
      'Cafés, bares e boates',
      'Dólar',
      'Games',
      'Midias e acessórios',
      'Passagens',
      'Hospedagens',
      'Passeios',
      'Outros Lazer'
    ]
  },
  {
    nome: 'Despesas Temporárias e Variáveis',
    subcategorias: [
      'Cursos',
      'Manutenção e reparos',
      'Médicos e terapeutas esporádicos',
      'Long Mormaii',
      'Fundo para Viagens / Gastos de férias',
      'Correio',
      'Presentes do Mês',
      'Utilidades domésticas e decoração',
      'Manutenção Veículo',
      'Prestações'
    ]
  },
  {
    nome: 'Outros',
    subcategorias: [
      'Tarifas Bancárias',
      'Compra Setor 1',
      'Intercâmbio',
      'Outros',
      'Investimentos',
      'Não Identificado'
    ]
  }
];

// Insere categorias e subcategorias
categorias.forEach(categoria => {
  db.run(`INSERT INTO categorias (nome) VALUES (?)`, [categoria.nome], function (err) {
    if (err) {
      console.error('Erro ao inserir categoria:', categoria.nome, err.message);
    } else {
      const categoriaId = this.lastID;
      categoria.subcategorias.forEach(sub => {
        db.run(`INSERT INTO subcategorias (nome, categoria_id) VALUES (?, ?)`, [sub, categoriaId], (subErr) => {
          if (subErr) {
            console.error(`Erro ao inserir subcategoria "${sub}" da categoria "${categoria.nome}":`, subErr.message);
          }
        });
      });
    }
  });
});

console.log('Categorias e subcategorias personalizadas inseridas!');