const { newDb, DataType } = require('pg-mem');

// Mantém um banco efêmero por "userKey" (ex.: id/email do demo)
const registry = new Map();

function bootstrapSql() {
  // Esquema alinhado ao seu Postgres, focando nas telas do sistema
  return `
  -- === Núcleo de usuários e taxonomias ===
  CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT,
    email TEXT UNIQUE,
    senha TEXT
  );

  CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    usuario_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS subcategorias (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    usuario_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS categorias_ocultas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    categoria_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS subcategorias_ocultas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    subcategoria_id INTEGER
  );

  -- === Formas de pagamento ===
  CREATE TABLE IF NOT EXISTS formas_pagamento (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    usuario_id INTEGER,
    dia_vencimento INTEGER,
    dia_fechamento INTEGER
  );

  CREATE TABLE IF NOT EXISTS formas_pagamento_ocultas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    forma_pagamento_id INTEGER NOT NULL
  );

  -- === Lançamentos/Parcelas/Recorrentes ===
  CREATE TABLE IF NOT EXISTS grupos_parcelas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nome TEXT,
    total INTEGER,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS grupos_recorrentes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nome TEXT,
    periodicidade TEXT DEFAULT 'mensal',
    dia_referencia INTEGER,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS lancamentos (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL,
    data_lancamento TEXT NOT NULL,
    data_vencimento TEXT,
    valor NUMERIC(14,2) NOT NULL,
    categoria_id INTEGER REFERENCES categorias(id),
    subcategoria_id INTEGER REFERENCES subcategorias(id),
    observacao TEXT,
    status TEXT,
    usuario_id INTEGER,
    forma_pagamento_id INTEGER REFERENCES formas_pagamento(id),
    parcela INTEGER,
    total_parcelas INTEGER,
    grupo_parcela_id INTEGER REFERENCES grupos_parcelas(id),
    grupo_recorrente_id INTEGER REFERENCES grupos_recorrentes(id)
  );

  CREATE TABLE IF NOT EXISTS lancamentos_recorrentes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    tipo TEXT,
    data_inicio TEXT,
    data_vencimento TEXT,
    valor NUMERIC(14,2),
    categoria_id INTEGER,
    subcategoria_id INTEGER,
    forma_pagamento_id INTEGER,
    observacao TEXT,
    status TEXT,
    duracao_meses INTEGER,
    ativo INTEGER
  );

  CREATE TABLE IF NOT EXISTS planejamentos (
    id SERIAL PRIMARY KEY,
    ano INTEGER NOT NULL,
    mes TEXT NOT NULL,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    valor_planejado NUMERIC(14,2) NOT NULL,
    usuario_id INTEGER NOT NULL,
    modo TEXT DEFAULT 'fixo',
    percentual NUMERIC
  );

  -- === Investimentos e proventos ===
  CREATE TABLE IF NOT EXISTS investimento_classes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    nome TEXT NOT NULL,
    oculto INTEGER DEFAULT 0,
    is_padrao INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS investimento_subclasses (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    classe_id INTEGER NOT NULL REFERENCES investimento_classes(id),
    nome TEXT NOT NULL,
    oculto INTEGER DEFAULT 0,
    is_padrao INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS investimento_ticker_map (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    classe_id INTEGER NOT NULL REFERENCES investimento_classes(id),
    subclasse_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS investimentos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    categoria TEXT,
    subcategoria TEXT,
    nome_investimento TEXT,
    tipo_operacao TEXT,
    quantidade NUMERIC,
    valor_unitario NUMERIC,
    valor_total NUMERIC,
    data_operacao TEXT,
    observacao TEXT,
    classe_id INTEGER,
    subclasse_id INTEGER,
    metodo_valorizacao TEXT,
    indexador TEXT,
    taxa_anual NUMERIC,
    percentual_cdi NUMERIC,
    data_inicio TEXT,
    vencimento TEXT,
    base_dias INTEGER,
    come_cotas INTEGER,
    aliquota_comecotas NUMERIC,
    valor_unitario_usd NUMERIC,
    cotacao_usd_brl NUMERIC
  );

  CREATE TABLE IF NOT EXISTS proventos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    ticker TEXT,
    nome_ativo TEXT,
    tipo TEXT,
    data TEXT,
    quantidade NUMERIC,
    valor_bruto NUMERIC,
    imposto NUMERIC,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- === Benchmarks / índices ===
  CREATE TABLE IF NOT EXISTS indices_cdi_diaria (
    data TEXT PRIMARY KEY,
    valor NUMERIC
  );
  CREATE TABLE IF NOT EXISTS indices_selic_diaria (
    data TEXT PRIMARY KEY,
    valor NUMERIC
  );
  CREATE TABLE IF NOT EXISTS indices_ipca_mensal (
    competencia TEXT PRIMARY KEY,
    valor NUMERIC
  );
  CREATE TABLE IF NOT EXISTS indices_tesouro_pu (
    data TEXT,
    nome TEXT,
    pu NUMERIC,
    pu_compra NUMERIC,
    PRIMARY KEY (data, nome)
  );
  CREATE TABLE IF NOT EXISTS fx_cotacoes_mensais (
    par TEXT,
    ano INTEGER,
    mes INTEGER,
    close NUMERIC,
    data_ref TEXT,
    PRIMARY KEY (par, ano, mes)
  );

  -- === Distribuição de rebalanceamento (para a tela de alvos) ===
  CREATE TABLE IF NOT EXISTS distribuicao_rebalanceamento (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    classe TEXT,
    percentual_classe NUMERIC,
    subclasse TEXT,
    percentual_subclasse NUMERIC,
    percentual_subclasse_interna NUMERIC,
    ativo TEXT,
    percentual_ativo NUMERIC
  );

  -- === Patrimônio ===
  CREATE TABLE IF NOT EXISTS patrimonio_contas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    instituicao TEXT,
    tipo TEXT,
    cor_hex TEXT,
    ativa INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS patrimonio_saldos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    conta_id INTEGER NOT NULL REFERENCES patrimonio_contas(id),
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    saldo NUMERIC NOT NULL DEFAULT 0,
    aportes NUMERIC NOT NULL DEFAULT 0,
    retiradas NUMERIC NOT NULL DEFAULT 0,
    obs TEXT,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS patrimonio_objetivos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    objetivo NUMERIC NOT NULL,
    base_inicial NUMERIC,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP)
  );

  -- === Planos & Metas ===
  CREATE TABLE IF NOT EXISTS planos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    inicio TEXT NOT NULL,
    fim TEXT,
    parcelas INTEGER,
    usar_parcelas INTEGER NOT NULL,
    valor_total NUMERIC(14,2) NOT NULL,
    valor_parcela NUMERIC(14,2),
    usar_parcela INTEGER NOT NULL,
    arrecadado NUMERIC(14,2) NOT NULL,
    status TEXT NOT NULL,
    icone TEXT NOT NULL,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP),
    atualizado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS planos_movimentos (
    id SERIAL PRIMARY KEY,
    plano_id INTEGER NOT NULL REFERENCES planos(id),
    usuario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    valor NUMERIC(14,2) NOT NULL,
    data TEXT NOT NULL,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP),
    lancamento_id INTEGER
  );

  -- === Regras e importações ===
  CREATE TABLE IF NOT EXISTS regras_categorizacao (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    padrao TEXT,
    tipo_match TEXT,
    categoria_id INTEGER,
    subcategoria_id INTEGER,
    prioridade INTEGER,
    atualizado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS regras_categorizacao_lancamentos (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    padrao TEXT NOT NULL,
    tipo_match TEXT NOT NULL,
    categoria_id INTEGER,
    subcategoria_id INTEGER,
    prioridade INTEGER DEFAULT 100,
    atualizado_em TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS import_lotes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    origem TEXT NOT NULL,
    nome_arquivo TEXT,
    status TEXT NOT NULL,
    criado_em TEXT DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS import_itens (
    id SERIAL PRIMARY KEY,
    lote_id INTEGER NOT NULL REFERENCES import_lotes(id),
    raw TEXT NOT NULL,
    preview_json TEXT,
    validado INTEGER DEFAULT 0,
    motivo_erro TEXT
  );

  CREATE TABLE IF NOT EXISTS import_presets (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    mapping_json TEXT
  );

  -- === Transações externas (Open Finance / CSV) ===
  CREATE TABLE IF NOT EXISTS transacoes_externas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    origem TEXT NOT NULL,
    external_id TEXT,
    conta_id INTEGER,
    data_lancamento TEXT NOT NULL,
    data_vencimento TEXT,
    valor NUMERIC NOT NULL,
    descricao TEXT NOT NULL,
    tipo TEXT,
    categoria_id INTEGER,
    subcategoria_id INTEGER,
    forma_pagamento_id INTEGER,
    conciliado INTEGER DEFAULT 0,
    lancamento_id INTEGER,
    hash_dedupe TEXT,
    grupo_parcela_id INTEGER,
    parcela_atual INTEGER,
    parcela_total INTEGER,
    grupo_recorrente_id INTEGER
  );

  -- === Catálogo de ativos / valores atuais (opcional) ===
  CREATE TABLE IF NOT EXISTS catalogo_ativos (
    id SERIAL PRIMARY KEY,
    tipo TEXT,
    nome_display TEXT,
    codigo_externo TEXT,
    indexador TEXT,
    vencimento TEXT,
    base_dias INTEGER,
    ir_regra TEXT,
    fonte TEXT,
    updated_at TEXT,
    percentual_cdi NUMERIC
  );

  CREATE TABLE IF NOT EXISTS valores_atuais (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    nome_investimento TEXT,
    data_referencia TEXT,
    preco_unitario NUMERIC,
    valor_total NUMERIC
  );
`;
}

function seedSql() {
  // Todas as datas são pré-formatadas em JS para evitar casts/TO_CHAR no pg-mem
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const fmtYM  = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  const addMonths = (date, m) => {
    const d = new Date(date.getTime());
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + m);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return d;
  };
  const addDays = (date, days) => {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  };

  const now        = new Date();
  const ymNow      = fmtYM(now);
  const ymPrev1    = fmtYM(addMonths(now, -1));
  const ymPrev2    = fmtYM(addMonths(now, -2));
  const ymNext1    = fmtYM(addMonths(now, +1));
  const ymNext2    = fmtYM(addMonths(now, +2));
  const yNow       = now.getFullYear();
  const mNow2d     = pad2(now.getMonth() + 1);

  const dToday     = fmtYMD(now);
  const dMinus5    = fmtYMD(addDays(now, -5));
  const dMinus10   = fmtYMD(addDays(now, -10));
  const dMinus15   = fmtYMD(addDays(now, -15));
  const dMinus20   = fmtYMD(addDays(now, -20));
  const dMinus25   = fmtYMD(addDays(now, -25));
  const dMinus7    = fmtYMD(addDays(now, -7));
  const dMinus6    = fmtYMD(addDays(now, -6));
  const dMinus4    = fmtYMD(addDays(now, -4));
  const dMinus3    = fmtYMD(addDays(now, -3));
  const dMinus2    = fmtYMD(addDays(now, -2));
  const dMinus1    = fmtYMD(addDays(now, -1));

  // Helpers para dias fixos no mês (ex.: '-05', '-10', '-15', '-01', '-02', '-03', '-18')
  const dayInYM = (ym, day) => `${ym}-${pad2(day)}`;
  const DEMO_UID = 0;  // <--- usuário demo padrão (combina com WHERE ... usuario_id = '0')

  return `
  -- Usuário demo
  INSERT INTO usuarios (id, nome, email, senha) VALUES (${DEMO_UID}, 'Usuário Demo', 'demo@site.com', NULL)
  ON CONFLICT DO NOTHING;

  -- Categorias e subcategorias
  INSERT INTO categorias (id, nome, usuario_id) VALUES
    (1, 'Receitas Fixas', ${DEMO_UID}),
    (2, 'Habitação', ${DEMO_UID}),
    (3, 'Lazer', ${DEMO_UID}),
    (4, 'Alimentação', ${DEMO_UID}),
    (5, 'Transporte', ${DEMO_UID}),
    (6, 'Saúde', ${DEMO_UID}),
    (7, 'Educação', ${DEMO_UID})
  ON CONFLICT DO NOTHING;

  INSERT INTO subcategorias (id, nome, categoria_id, usuario_id) VALUES
    (10, 'Salário', 1, ${DEMO_UID}),
    (11, 'Freelance', 1, ${DEMO_UID}),
    (20, 'Aluguel', 2, ${DEMO_UID}),
    (21, 'Energia', 2, ${DEMO_UID}),
    (22, 'Água', 2, ${DEMO_UID}),
    (30, 'Restaurantes', 3, ${DEMO_UID}),
    (31, 'Cinema/Shows', 3, ${DEMO_UID}),
    (40, 'Mercado', 4, ${DEMO_UID}),
    (41, 'Delivery', 4, ${DEMO_UID}),
    (50, 'Combustível', 5, ${DEMO_UID}),
    (51, 'App de Mobilidade', 5, ${DEMO_UID}),
    (60, 'Farmácia', 6, ${DEMO_UID}),
    (70, 'Cursos', 7, ${DEMO_UID})
  ON CONFLICT DO NOTHING;

  -- Formas de pagamento
  INSERT INTO formas_pagamento (id, nome, usuario_id, dia_vencimento, dia_fechamento) VALUES
    (1, 'Cartão Visa', ${DEMO_UID}, 10, 2),
    (2, 'Conta Corrente', ${DEMO_UID}, NULL, NULL),
    (3, 'Cartão Master', ${DEMO_UID}, 15, 7)
  ON CONFLICT DO NOTHING;

  -- Planejamento (mês atual)
  INSERT INTO planejamentos (ano, mes, categoria_id, valor_planejado, usuario_id, modo)
    VALUES (${yNow}, '${mNow2d}', 2, 2500.00, ${DEMO_UID}, 'fixo'),
           (${yNow}, '${mNow2d}', 4, 1800.00, ${DEMO_UID}, 'fixo'),
           (${yNow}, '${mNow2d}', 3, 600.00,  ${DEMO_UID}, 'fixo')
  ON CONFLICT DO NOTHING;

  -- Grupos de parcelas e recorrentes
  INSERT INTO grupos_parcelas (id, usuario_id, nome, total, criado_em) VALUES
    (1, ${DEMO_UID}, 'Notebook', 3, '${dToday}')
  ON CONFLICT DO NOTHING;

  INSERT INTO grupos_recorrentes (id, usuario_id, nome, periodicidade, dia_referencia, criado_em) VALUES
    (1, ${DEMO_UID}, 'Academia', 'mensal', 5, '${dToday}')
  ON CONFLICT DO NOTHING;

  INSERT INTO lancamentos_recorrentes (id, usuario_id, tipo, data_inicio, data_vencimento, valor, categoria_id, subcategoria_id, forma_pagamento_id, observacao, status, duracao_meses, ativo)
    VALUES (1, ${DEMO_UID}, 'despesa',
            '${dayInYM(ymPrev2, 5)}',
            '${dayInYM(ymPrev2, 5)}',
            99.90, 3, 31, 2, 'Mensalidade academia', 'pendente', 12, 1)
  ON CONFLICT DO NOTHING;

  -- Lançamentos (receitas, despesas, pendentes, vencidos, parcelados, recorrentes gerados)
  INSERT INTO lancamentos (tipo, data_lancamento, data_vencimento, valor, categoria_id, subcategoria_id, observacao, status, usuario_id, forma_pagamento_id, parcela, total_parcelas, grupo_parcela_id, grupo_recorrente_id)
    VALUES
    -- Receitas
    ('receita', '${dayInYM(ymNow, 5)}', NULL, 8000.00, 1, 10, 'Salário do mês', 'pago', ${DEMO_UID}, 2, NULL, NULL, NULL, NULL),
    ('receita', '${dMinus15}', NULL, 1200.00, 1, 11, 'Freela site', 'pago', ${DEMO_UID}, 2, NULL, NULL, NULL, NULL),
    -- Despesas fixas pagas/pendentes
    ('despesa', '${dayInYM(ymNow, 8)}',  '${dayInYM(ymNow, 10)}', 2200.00, 2, 20, 'Aluguel', 'pago', ${DEMO_UID}, 2, NULL, NULL, NULL, NULL),
    ('despesa', '${dayInYM(ymNow, 12)}', '${dayInYM(ymNow, 15)}',  350.00, 2, 21, 'Conta de energia', 'pendente', ${DEMO_UID}, 2, NULL, NULL, NULL, NULL),
    ('despesa', '${dMinus25}', '${dMinus20}', 95.00, 4, 41, 'Delivery atrasado', 'pendente', ${DEMO_UID}, 1, NULL, NULL, NULL, NULL),
    ('despesa', '${dMinus10}', '${dayInYM(ymNow, 10)}', 1800.00, 4, 40, 'Notebook (1/3)', 'pendente', ${DEMO_UID}, 1, 1, 3, 1, NULL),
    ('despesa', '${dayInYM(ymNext1, 15)}', '${dayInYM(ymNext1, 10)}', 1800.00, 4, 40, 'Notebook (2/3)', 'pendente', ${DEMO_UID}, 1, 2, 3, 1, NULL),
    ('despesa', '${dayInYM(ymNext2, 15)}', '${dayInYM(ymNext2, 10)}', 1800.00, 4, 40, 'Notebook (3/3)', 'pendente', ${DEMO_UID}, 1, 3, 3, 1, NULL),
    ('despesa', '${dayInYM(ymNow, 18)}', '${dayInYM(ymNow, 10)}', 120.00, 3, 30, 'Restaurante', 'pendente', ${DEMO_UID}, 1, NULL, NULL, NULL, NULL),
    ('despesa', '${dMinus5}', NULL, 250.00, 5, 50, 'Combustível', 'pago', ${DEMO_UID}, 2, NULL, NULL, NULL, NULL),
    ('despesa', '${dayInYM(ymNow, 5)}', '${dayInYM(ymNow, 5)}', 99.90, 3, 31, 'Mensalidade academia', 'pago', ${DEMO_UID}, 2, NULL, NULL, NULL, 1);

  -- Investimentos: classes/subclasses/mapa e trades
  INSERT INTO investimento_classes (id, usuario_id, nome, oculto, is_padrao) VALUES
    (1, ${DEMO_UID}, 'Ação', 0, 1),
    (2, ${DEMO_UID}, 'FII', 0, 1),
    (3, ${DEMO_UID}, 'ETF', 0, 1),
    (4, ${DEMO_UID}, 'Renda Fixa', 0, 1)
  ON CONFLICT DO NOTHING;

  INSERT INTO investimento_subclasses (id, usuario_id, classe_id, nome, oculto, is_padrao) VALUES
    (11, 1, 1, 'Ação BR', 0, 1),
    (12, 1, 1, 'Ação EUA', 0, 1),
    (21, 1, 2, 'Tijolo', 0, 1),
    (31, 1, 3, 'ETF BR', 0, 1),
    (41, 1, 4, 'Tesouro Direto', 0, 1)
  ON CONFLICT DO NOTHING;

  INSERT INTO investimento_ticker_map (usuario_id, ticker, classe_id, subclasse_id) VALUES
    (${DEMO_UID}, 'VALE3', 1, 11),
    (${DEMO_UID}, 'MXRF11', 2, 21),
    (${DEMO_UID}, 'IVVB11', 3, 31)
  ON CONFLICT DO NOTHING;

  INSERT INTO investimentos (usuario_id, nome_investimento, tipo_operacao, quantidade, valor_unitario, valor_total, data_operacao, classe_id, subclasse_id)
    VALUES
    (${DEMO_UID}, 'VALE3', 'compra', 10, 60.00, 600.00, '${dayInYM(ymPrev2, 2)}', 1, 11),
    (${DEMO_UID}, 'VALE3', 'compra', 5,  62.00, 310.00, '${dayInYM(ymPrev1, 10)}', 1, 11),
    (${DEMO_UID}, 'VALE3', 'venda',  3,  65.00, 195.00, '${dMinus10}', 1, 11),
    (${DEMO_UID}, 'MXRF11','compra', 100, 10.00, 1000.00, '${dayInYM(ymPrev1, 3)}', 2, 21),
    (${DEMO_UID}, 'IVVB11','compra', 20,  300.00, 6000.00, '${dMinus20}', 3, 31);

  INSERT INTO proventos (usuario_id, ticker, nome_ativo, tipo, data, quantidade, valor_bruto, imposto, observacao)
    VALUES
    (${DEMO_UID}, 'MXRF11', 'MXRF11', 'Rendimento', '${dayInYM(ymPrev1, 14)}', 100, 10.00, 0, NULL),
    (${DEMO_UID}, 'MXRF11', 'MXRF11', 'Rendimento', '${dayInYM(ymNow, 14)}', 100, 11.50, 0, NULL);

  -- Benchmarks/índices: CDI/SELIC diários (amostra), IPCA mensal, Tesouro PU e FX
  INSERT INTO indices_cdi_diaria (data, valor) VALUES
    ('${dMinus7}', 0.04),
    ('${dMinus6}', 0.04),
    ('${dMinus5}', 0.04),
    ('${dMinus4}', 0.04),
    ('${dMinus3}', 0.04),
    ('${dMinus2}', 0.04),
    ('${dMinus1}', 0.04)
  ON CONFLICT DO NOTHING;

  INSERT INTO indices_selic_diaria (data, valor) VALUES
    ('${dMinus7}', 0.04),
    ('${dMinus6}', 0.04),
    ('${dMinus5}', 0.04)
  ON CONFLICT DO NOTHING;

  INSERT INTO indices_ipca_mensal (competencia, valor) VALUES
    ('${ymPrev2}', 0.30),
    ('${ymPrev1}', 0.18),
    ('${ymNow}',   0.22)
  ON CONFLICT DO NOTHING;

  INSERT INTO indices_tesouro_pu (data, nome, pu, pu_compra) VALUES
    ('${dayInYM(ymPrev2, 1)}', 'Tesouro Renda+ 2065',  10000.00, 9950.00),
    ('${dayInYM(ymPrev1, 1)}', 'Tesouro Renda+ 2065',  10120.00, 10060.00),
    ('${dayInYM(ymNow,   1)}', 'Tesouro Renda+ 2065',  10210.00, 10150.00)
  ON CONFLICT DO NOTHING;

  INSERT INTO fx_cotacoes_mensais (par, ano, mes, close, data_ref) VALUES
    ('USD/BRL', ${new Date(addMonths(now,-2)).getFullYear()}, ${new Date(addMonths(now,-2)).getMonth()+1}, 5.10, '${dayInYM(ymPrev2, 1)}'),
    ('USD/BRL', ${new Date(addMonths(now,-1)).getFullYear()}, ${new Date(addMonths(now,-1)).getMonth()+1}, 5.22, '${dayInYM(ymPrev1, 1)}'),
    ('USD/BRL', ${yNow}, ${now.getMonth()+1}, 5.17, '${dayInYM(ymNow, 1)}')
  ON CONFLICT DO NOTHING;

  -- Patrimônio (contas e saldos últimos 6 meses)
  INSERT INTO patrimonio_contas (id, usuario_id, nome, instituicao, tipo, cor_hex, ativa)
    VALUES (1, ${DEMO_UID}, 'Conta Corrente', 'Nubank', 'Conta', '#7C3AED', 1),
           (2, ${DEMO_UID}, 'Poupança', 'Inter', 'Caixa', '#10B981', 1)
  ON CONFLICT DO NOTHING;

  INSERT INTO patrimonio_saldos (usuario_id, conta_id, ano, mes, saldo, aportes, retiradas)
    VALUES
    (1, 1, ${new Date(addMonths(now,-5)).getFullYear()}, ${new Date(addMonths(now,-5)).getMonth()+1}, 3000, 1000, 200),
    (1, 1, ${new Date(addMonths(now,-4)).getFullYear()}, ${new Date(addMonths(now,-4)).getMonth()+1}, 3600, 800,  200),
    (1, 1, ${new Date(addMonths(now,-3)).getFullYear()}, ${new Date(addMonths(now,-3)).getMonth()+1}, 4200, 800,  200),
    (1, 1, ${new Date(addMonths(now,-2)).getFullYear()}, ${new Date(addMonths(now,-2)).getMonth()+1}, 4700, 700,  200),
    (1, 1, ${new Date(addMonths(now,-1)).getFullYear()}, ${new Date(addMonths(now,-1)).getMonth()+1}, 5200, 700,  200),
    (1, 1, ${yNow}, ${now.getMonth()+1}, 5600, 600,  200),
    (1, 2, ${new Date(addMonths(now,-5)).getFullYear()}, ${new Date(addMonths(now,-5)).getMonth()+1}, 2000, 500,  0),
    (1, 2, ${new Date(addMonths(now,-4)).getFullYear()}, ${new Date(addMonths(now,-4)).getMonth()+1}, 2300, 300,  0),
    (1, 2, ${new Date(addMonths(now,-3)).getFullYear()}, ${new Date(addMonths(now,-3)).getMonth()+1}, 2500, 300,  100),
    (1, 2, ${new Date(addMonths(now,-2)).getFullYear()}, ${new Date(addMonths(now,-2)).getMonth()+1}, 2700, 300,  100),
    (1, 2, ${new Date(addMonths(now,-1)).getFullYear()}, ${new Date(addMonths(now,-1)).getMonth()+1}, 3000, 400,  100),
   (1, 2, ${yNow}, ${now.getMonth()+1}, 3200, 300,  100);

  INSERT INTO patrimonio_objetivos (usuario_id, ano, objetivo, base_inicial)
    VALUES (${DEMO_UID}, ${yNow}, 10000, 5000)
  ON CONFLICT DO NOTHING;

  -- Planos e movimentos
  INSERT INTO planos (id, usuario_id, nome, inicio, fim, parcelas, usar_parcelas, valor_total, valor_parcela, usar_parcela, arrecadado, status, icone, criado_em)
    VALUES (1, ${DEMO_UID}, 'Viagem Férias',
            '${dayInYM(ymPrev2, 1)}', NULL,
            10, 1, 5000.00, 500.00, 0, 1200.00, 'andamento', 'plane',
            '${dayInYM(ymPrev2, 1)}')
  ON CONFLICT DO NOTHING;

  INSERT INTO planos_movimentos (plano_id, usuario_id, tipo, valor, data)
    VALUES
    (1, ${DEMO_UID}, 'aporte', 400.00, '${dayInYM(ymPrev2, 15)}'),
    (1, ${DEMO_UID}, 'aporte', 400.00, '${dayInYM(ymPrev1, 15)}'),
    (1, ${DEMO_UID}, 'aporte', 400.00, '${dayInYM(ymNow, 15)}');

  -- Distribuição/Rebalanceamento desejada (para tela de rebalanceamento)
  INSERT INTO distribuicao_rebalanceamento (id, usuario_id, classe, percentual_classe, subclasse, percentual_subclasse, percentual_subclasse_interna, ativo, percentual_ativo)
    VALUES
    (1, ${DEMO_UID}, 'Ação', 50, 'Ação BR', 100, NULL, 'VALE3', 100),
    (2, ${DEMO_UID}, 'FII',  30, 'Tijolo',  100, NULL, 'MXRF11', 100),
    (3, ${DEMO_UID}, 'ETF',  20, 'ETF BR',  100, NULL, 'IVVB11', 100)
  ON CONFLICT DO NOTHING;

  -- Regras de categorização (exemplo simples)
  INSERT INTO regras_categorizacao (usuario_id, padrao, tipo_match, categoria_id, subcategoria_id, prioridade, atualizado_em)
    VALUES (${DEMO_UID}, 'IFood', 'contém', 4, 41, 50, '${dToday}')
  ON CONFLICT DO NOTHING;

  -- Importações (lote + item)
  INSERT INTO import_lotes (id, usuario_id, origem, nome_arquivo, status, criado_em)
    VALUES (1, ${DEMO_UID}, 'CSV Nubank', 'nubank_set.csv', 'processado', '${dToday}')
  ON CONFLICT DO NOTHING;

  INSERT INTO import_itens (lote_id, raw, preview_json, validado)
    VALUES (1, '${dayInYM(ymNow, 1)}; DÉBITO; IFood; -95,00', '{ "data":"${dayInYM(ymNow, 1)}", "desc":"IFood", "valor": -95.00 }', 1);

  -- Transações externas (não conciliadas)
  INSERT INTO transacoes_externas (usuario_id, origem, external_id, conta_id, data_lancamento, data_vencimento, valor, descricao, tipo, categoria_id, subcategoria_id, forma_pagamento_id, conciliado)
    VALUES (${DEMO_UID}, 'openfinance', 'ext-123', 1, '${dMinus3}', NULL, 35.90, 'Uber corrida', 'despesa', 5, 51, 2, 0);

  -- Catálogo de ativos e valores atuais (apoio para telas de RF/Tesouro)
  INSERT INTO catalogo_ativos (id, tipo, nome_display, codigo_externo, indexador, vencimento, base_dias, ir_regra, fonte, updated_at, percentual_cdi)
    VALUES (1, 'Tesouro', 'Tesouro Renda+ 2065', 'Renda+ 2065', 'IPCA', '2065-01-01', 252, 'regra_padrao', 'Tesouro', '${dToday}', 0.0)
  ON CONFLICT DO NOTHING;

  INSERT INTO valores_atuais (usuario_id, nome_investimento, data_referencia, preco_unitario, valor_total)
    VALUES (${DEMO_UID}, 'VALE3', '${dayInYM(ymNow, 1)}', 62.50, 937.50);
`;
}

function getOrCreateDemoDb(userKey = 'demo') {
  if (registry.has(userKey)) return registry.get(userKey);

  const mem = newDb({ autoCreateForeignKeyIndices: true });

    // ---- Shim: to_char(date/timestamp, '...') para pg-mem ----
  const fmt = (d, f) => {
    if (!d) return null;
    const dt = (d instanceof Date) ? d : new Date(d);
    const y = String(dt.getFullYear());
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    switch (f) {
      case 'MM': return m;
      case 'YYYY': return y;
      case 'YYYY-MM': return `${y}-${m}`;
      case 'YYYY-MM-DD': return `${y}-${m}-${day}`;
      default: return `${y}-${m}-${day}`;
    }
  };
  // date
  mem.public.registerFunction({
    name: 'to_char',
    args: [DataType.date, DataType.text],
    returns: DataType.text,
    implementation: fmt,
  });
  // timestamp (sem timezone)
  mem.public.registerFunction({
    name: 'to_char',
    args: [DataType.timestamp, DataType.text],
    returns: DataType.text,
    implementation: fmt,
  });
  // timestamptz
  mem.public.registerFunction({
    name: 'to_char',
    args: [DataType.timestamptz, DataType.text],
    returns: DataType.text,
    implementation: fmt,
  });

  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();

  const ready = pool.connect().then(async (client) => {
    try {
      await client.query('BEGIN');
      await client.query(bootstrapSql());
      await client.query(seedSql());
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw e;
    } finally {
      client.release();
    }
  });

  const ctx = { pool, ready };
  registry.set(userKey, ctx);
  return ctx;
}

function resetDemoPool(userKey = 'demo') {
  if (registry.has(userKey)) registry.delete(userKey);
  return getOrCreateDemoDb(userKey);
}

module.exports = {
  getOrCreateDemoDb,
  resetDemoPool,
};