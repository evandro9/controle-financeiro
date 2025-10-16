require('dotenv').config();
const db = require('./db');

// Executa DDL em ordem e mostra erro claro se algo falhar
async function run(sql) {
  try {
    await db.run(sql);
  } catch (e) {
    console.error('\n[ERRO DDL]\n', sql, '\n↳', e.message);
    process.exit(1);
  }
}

(async () => {

// ------------------------------
// Básicas (categorias/usuarios)
// ------------------------------
await run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT,
    email TEXT UNIQUE,
    senha TEXT
  )
`);

// 🔽 Versões aceitas + marketing (snapshot no próprio usuário)
await run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS terms_version TEXT`);
await run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS privacy_version TEXT`);
await run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`);
await run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ`);
await run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS marketing_opt_in INTEGER DEFAULT 0`);
await run(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS marketing_opt_in_at TIMESTAMPTZ`);

// 🔽 Tabela auditável e versionada de consentimentos (LGPD)
await run(`
  CREATE TABLE IF NOT EXISTS user_consents (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    policy TEXT NOT NULL,         -- 'terms' | 'privacy' | 'marketing'
    version TEXT NOT NULL,
    accepted INTEGER NOT NULL DEFAULT 1, -- 1=true, 0=false
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip TEXT,
    user_agent TEXT,
    locale TEXT,
    UNIQUE (user_id, policy, version)
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    usuario_id INTEGER
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS subcategorias (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    usuario_id INTEGER
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS categorias_ocultas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    categoria_id INTEGER,
    UNIQUE (usuario_id, categoria_id)
  )
`);

// ------------------------------
// Subcategorias ocultas
// ------------------------------
await run(`
  CREATE TABLE IF NOT EXISTS subcategorias_ocultas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    subcategoria_id INTEGER,
    UNIQUE (usuario_id, subcategoria_id)
  )
`);

// ------------------------------
// Formas de pagamento
// ------------------------------
await run(`
  CREATE TABLE IF NOT EXISTS formas_pagamento (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    usuario_id INTEGER,
    dia_vencimento INTEGER,
    dia_fechamento INTEGER
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS formas_pagamento_antiga (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    usuario_id INTEGER NOT NULL,
    UNIQUE (nome, usuario_id)
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS formas_pagamento_ocultas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    forma_pagamento_id INTEGER NOT NULL,
    UNIQUE (usuario_id, forma_pagamento_id)
  )
`);

// ------------------------------
// Importações (presets)
// ------------------------------
await run(`
  DROP TABLE IF EXISTS import_presets CASCADE;
  CREATE TABLE import_presets (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER NOT NULL,
    nome          TEXT NOT NULL,
    mapping_json  TEXT
  )
`);

// Transações externas (CSV/OFX/Belvo/Pluggy)
await run(`
  CREATE TABLE IF NOT EXISTS transacoes_externas(
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
    grupo_recorrente_id INTEGER,
    UNIQUE (usuario_id, origem, external_id)
  )
`);

// ------------------------------
// Lançamentos & recorrência
// ------------------------------
await run(`
  CREATE TABLE IF NOT EXISTS grupos_parcelas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nome TEXT,
    total INTEGER,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS grupos_recorrentes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nome TEXT,
    periodicidade TEXT DEFAULT 'mensal',
    dia_referencia INTEGER,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

await run(`
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
  )
`);

await run(`
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
  )
`);

// ------------------------------
// Importações (OFX/CSV)
// ------------------------------
await run(`
  CREATE TABLE IF NOT EXISTS import_lotes (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    origem TEXT NOT NULL,
    nome_arquivo TEXT,
    status TEXT NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS import_itens (
    id SERIAL PRIMARY KEY,
    lote_id INTEGER NOT NULL REFERENCES import_lotes(id),
    raw TEXT NOT NULL,
    preview_json TEXT,
    validado INTEGER DEFAULT 0,
    motivo_erro TEXT
  )
`);

// ------------------------------
// Investimentos & preços atuais
// ------------------------------
await run(`
  CREATE TABLE IF NOT EXISTS investimento_classes (
    id         SERIAL PRIMARY KEY,
    usuario_id INTEGER,          -- null = padrão do sistema
    nome       TEXT NOT NULL,
    oculto     INTEGER DEFAULT 0,
    is_padrao  INTEGER DEFAULT 0,
    UNIQUE (usuario_id, nome)
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS investimento_subclasses (
    id         SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    classe_id  INTEGER NOT NULL REFERENCES investimento_classes(id),
    nome       TEXT NOT NULL,
    oculto     INTEGER DEFAULT 0,
    is_padrao  INTEGER DEFAULT 0,
    UNIQUE (usuario_id, classe_id, nome)
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS investimentos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    categoria TEXT,
    subcategoria TEXT,
    nome_investimento TEXT,
    tipo_operacao TEXT,               -- compra, venda, bonificacao etc.
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
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS valores_atuais (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    nome_investimento TEXT,
    data_referencia TEXT,
    preco_unitario NUMERIC,
    valor_total NUMERIC
  )
`);

await run(`ALTER TABLE investimento_ticker_map ADD COLUMN IF NOT EXISTS classe_id INTEGER`);
await run(`ALTER TABLE investimento_ticker_map ADD COLUMN IF NOT EXISTS subclasse_id INTEGER`);

await run(`
  DROP TABLE IF EXISTS investimento_ticker_map CASCADE;
  CREATE TABLE investimento_ticker_map (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    classe_id INTEGER NOT NULL,
    subclasse_id INTEGER,
    UNIQUE (usuario_id, ticker),
    FOREIGN KEY (classe_id) REFERENCES investimento_classes(id),
    FOREIGN KEY (subclasse_id) REFERENCES investimento_subclasses(id)
  )
`);

await run(`
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'investimento_ticker_map_usuario_id_ticker_key'
  ) THEN
    ALTER TABLE investimento_ticker_map
      ADD CONSTRAINT investimento_ticker_map_usuario_id_ticker_key
      UNIQUE (usuario_id, ticker);
  END IF;
END $$;
`);

await run(`
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_itm_classe'
      AND table_name = 'investimento_ticker_map'
  ) THEN
    ALTER TABLE investimento_ticker_map
      ADD CONSTRAINT fk_itm_classe
      FOREIGN KEY (classe_id) REFERENCES investimento_classes(id);
  END IF;
END $$;
`);

await run(`
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_itm_subclasse'
      AND table_name = 'investimento_ticker_map'
  ) THEN
    ALTER TABLE investimento_ticker_map
      ADD CONSTRAINT fk_itm_subclasse
      FOREIGN KEY (subclasse_id) REFERENCES investimento_subclasses(id);
  END IF;
END $$;
`);

// ------------------------------
// Proventos (1:1 com o SQLite)
// ------------------------------
await run(`
  DROP TABLE IF EXISTS proventos CASCADE;
  CREATE TABLE proventos (
    id           SERIAL PRIMARY KEY,
    usuario_id   INTEGER,
    ticker       TEXT,
    nome_ativo   TEXT,
    tipo         TEXT,
    data         TEXT,
    quantidade   NUMERIC,
    valor_bruto  NUMERIC,
    imposto      NUMERIC,
    observacao   TEXT,
    created_at   TEXT
  )
`);

// ------------------------------
// Distribuição / Rebalanceamento
// ------------------------------
await run(`
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
  )
`);

// ------------------------------
// Índices & FX
// ------------------------------
await run(`
  CREATE TABLE IF NOT EXISTS indices_tesouro_pu (
    data TEXT NOT NULL,
    nome TEXT NOT NULL,
    pu NUMERIC NOT NULL,
    PRIMARY KEY (data, nome)
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS indices_cdi_diaria (
    data TEXT PRIMARY KEY,
    valor NUMERIC
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS indices_ipca_mensal (
    competencia TEXT PRIMARY KEY, -- 'YYYY-MM'
    valor NUMERIC                 -- % ao mês
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS indices_selic_diaria (
    data TEXT PRIMARY KEY,
    valor NUMERIC
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS fx_cotacoes_mensais (
    par TEXT NOT NULL,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    close NUMERIC NOT NULL,
    data_ref TEXT NOT NULL,
    PRIMARY KEY (par, ano, mes)
  )
`);

// ------------------------------
// Patrimônio
// ------------------------------
await run(`
  CREATE TABLE IF NOT EXISTS patrimonio_contas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    instituicao TEXT,
    tipo TEXT,
    cor_hex TEXT,
    ativa INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS patrimonio_objetivos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    objetivo NUMERIC NOT NULL,
    base_inicial NUMERIC,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, ano)
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS patrimonio_saldos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    conta_id INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    saldo NUMERIC NOT NULL DEFAULT 0,
    aportes NUMERIC NOT NULL DEFAULT 0,
    retiradas NUMERIC NOT NULL DEFAULT 0,
    obs TEXT,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, conta_id, ano, mes)
  )
`);

// ------------------------------
// Planejamento & Catálogo/Regras
// ------------------------------
await run(`
  DROP TABLE IF EXISTS planejamentos CASCADE;
  CREATE TABLE planejamentos (
    id SERIAL PRIMARY KEY,
    ano INTEGER NOT NULL,
    mes TEXT NOT NULL,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id),
    valor_planejado NUMERIC(14,2) NOT NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    modo TEXT DEFAULT 'fixo',
    percentual NUMERIC,
    UNIQUE (categoria_id, ano, mes, usuario_id)
  )
`);

await run(`
    DROP TABLE IF EXISTS catalogo_ativos CASCADE;
    CREATE TABLE IF NOT EXISTS catalogo_ativos (
      id              SERIAL PRIMARY KEY,
      tipo            TEXT,
      nome_display    TEXT,
      codigo_externo  TEXT,
      indexador       TEXT,
      vencimento      TEXT,
      base_dias       INTEGER,
      ir_regra        TEXT,
      fonte           TEXT,
      updated_at      TEXT,
      percentual_cdi  NUMERIC
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_catalogo_tipo_nome
      ON catalogo_ativos (tipo, nome_display);
  `);

// ------------------------------
// Regras de categorização (1:1 com SQLite)
// ------------------------------
await run(`
  DROP TABLE IF EXISTS regras_categorizacao CASCADE;
  CREATE TABLE regras_categorizacao (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL,
    padrao          TEXT,
    tipo_match      TEXT,      -- ex.: 'contains', 'equals', etc. (como no SQLite)
    categoria_id    INTEGER,
    subcategoria_id INTEGER,
    prioridade      INTEGER,
    atualizado_em   TEXT,
    valor_fixo      NUMERIC
  )
`);

// ------------------------------
// Planos (metas) e movimentos de planos
// ------------------------------
await run(`
  CREATE TABLE IF NOT EXISTS planos (
    id             SERIAL PRIMARY KEY,
    usuario_id     INTEGER NOT NULL,
    nome           TEXT NOT NULL,
    inicio         TEXT NOT NULL,     -- mantido TEXT p/ compat; podemos migrar p/ DATE depois
    fim            TEXT,
    parcelas       INTEGER,
    usar_parcelas  INTEGER NOT NULL,  -- manter INTEGER (0/1) p/ não quebrar rotas
    valor_total    NUMERIC(14,2) NOT NULL,
    valor_parcela  NUMERIC(14,2),
    usar_parcela   INTEGER NOT NULL,
    arrecadado     NUMERIC(14,2) NOT NULL,
    status         TEXT NOT NULL,
    icone          TEXT NOT NULL,
    criado_em      TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em  TEXT
  )
`);

await run(`
  CREATE TABLE IF NOT EXISTS planos_movimentos (
    id            SERIAL PRIMARY KEY,
    plano_id      INTEGER NOT NULL REFERENCES planos(id),
    usuario_id    INTEGER NOT NULL,
    tipo          TEXT NOT NULL,          -- 'aporte' | 'retirada'
    valor         NUMERIC(14,2) NOT NULL,
    data          TEXT NOT NULL,          -- YYYY-MM-DD (compat)
    criado_em     TEXT DEFAULT CURRENT_TIMESTAMP,
    lancamento_id INTEGER
  )
`);

// --- Assinaturas (Hotmart) ---
await run(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('trial','active','past_due','canceled','expired');
  END IF;
END $$;
`);

await run(`
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  plan TEXT NOT NULL, -- 'mensal' | 'anual'
  status subscription_status NOT NULL,
  external_provider TEXT,
  external_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_provider)
);
`);

await run(`
CREATE TABLE IF NOT EXISTS entitlements (
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, feature_key)
);
`);

await run(`
CREATE TABLE IF NOT EXISTS subscription_events (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  external_provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_provider, external_event_id)
);
`);

await run(`
CREATE TABLE IF NOT EXISTS job_runs (
  job_name TEXT NOT NULL,
  run_date DATE NOT NULL,
  ran_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_name, run_date)
);
`);

// ------------------------------
// Índices do dump
// ------------------------------
await run(`CREATE INDEX IF NOT EXISTS idx_itm_classe    ON investimento_ticker_map(classe_id)`);
await run(`CREATE INDEX IF NOT EXISTS idx_itm_subclasse ON investimento_ticker_map(subclasse_id)`);
await run(`CREATE INDEX IF NOT EXISTS idx_trans_ext_hash ON transacoes_externas(usuario_id, hash_dedupe)`);
await run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_proventos_dedupe ON proventos (usuario_id, ticker, tipo, data, valor_bruto)`);
await run(`CREATE INDEX IF NOT EXISTS idx_cdi_data              ON indices_cdi_diaria(data)`);
await run(`CREATE INDEX IF NOT EXISTS idx_distrib_usuario       ON distribuicao_rebalanceamento(usuario_id)`);
await run(`CREATE INDEX IF NOT EXISTS idx_inv_user_ticker       ON investimentos(usuario_id, nome_investimento)`);
await run(`CREATE INDEX IF NOT EXISTS idx_lanc_usuario_grp_parc ON lancamentos(usuario_id, grupo_parcela_id)`);
await run(`CREATE INDEX IF NOT EXISTS idx_map_user_ticker       ON investimento_ticker_map(usuario_id, ticker)`);
await run(`CREATE INDEX IF NOT EXISTS idx_patr_contas_usuario   ON patrimonio_contas (usuario_id, ativa)`);
await run(`CREATE INDEX IF NOT EXISTS idx_patr_saldos_conta     ON patrimonio_saldos (conta_id, ano, mes)`);
await run(`CREATE INDEX IF NOT EXISTS idx_patr_saldos_usuario   ON patrimonio_saldos (usuario_id, ano, mes)`);
await run(`CREATE INDEX IF NOT EXISTS idx_planos_mov_lancamento ON planos_movimentos(lancamento_id)`);
await run(`CREATE INDEX IF NOT EXISTS idx_regras_usuario        ON regras_categorizacao(usuario_id, prioridade)`);
await run(`CREATE INDEX IF NOT EXISTS idx_regras_valor          ON regras_categorizacao(usuario_id, padrao, valor_fixo)`);
await run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_catalogo_tipo_nome ON catalogo_ativos (tipo, nome_display)`);
await run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_planejamentos       ON planejamentos (categoria_id, ano, mes, usuario_id)`);
await run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_proventos_dedupe ON proventos (usuario_id, ticker, tipo, data, valor_bruto)`);
await run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_status_cpe ON subscriptions (status, current_period_end)`);
await run(`CREATE INDEX IF NOT EXISTS idx_entitlements_user_id ON entitlements (user_id)`);

console.log('Tabelas/índices atualizados com sucesso!');
process.exit(0);
})();