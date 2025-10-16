CREATE OR REPLACE FUNCTION purge_user_data(p_user_id integer, p_keep_user boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM import_itens ii USING import_lotes il WHERE ii.lote_id = il.id AND il.usuario_id = p_user_id;
  DELETE FROM planos_movimentos                 WHERE usuario_id = p_user_id;
  DELETE FROM lancamentos                      WHERE usuario_id = p_user_id;
  DELETE FROM transacoes_externas              WHERE usuario_id = p_user_id;
  DELETE FROM investimentos                    WHERE usuario_id = p_user_id;
  DELETE FROM proventos                        WHERE usuario_id = p_user_id;
  DELETE FROM valores_atuais                   WHERE usuario_id = p_user_id;
  DELETE FROM patrimonio_saldos                WHERE usuario_id = p_user_id;
  DELETE FROM lancamentos_recorrentes          WHERE usuario_id = p_user_id;
  DELETE FROM regras_categorizacao_lancamentos WHERE usuario_id = p_user_id;
  DELETE FROM regras_categorizacao             WHERE usuario_id = p_user_id;
  DELETE FROM import_lotes                     WHERE usuario_id = p_user_id;
  DELETE FROM planejamentos                    WHERE usuario_id = p_user_id;
  DELETE FROM formas_pagamento_ocultas         WHERE usuario_id = p_user_id;
  DELETE FROM categorias_ocultas               WHERE usuario_id = p_user_id;
  DELETE FROM subcategorias_ocultas            WHERE usuario_id = p_user_id;
  DELETE FROM distribuicao_rebalanceamento     WHERE usuario_id = p_user_id;
  DELETE FROM planos                           WHERE usuario_id = p_user_id;
  DELETE FROM patrimonio_contas                WHERE usuario_id = p_user_id;
  DELETE FROM grupos_parcelas                  WHERE usuario_id = p_user_id;
  DELETE FROM grupos_recorrentes               WHERE usuario_id = p_user_id;
  DELETE FROM investimento_ticker_map          WHERE usuario_id = p_user_id;
  DELETE FROM investimento_subclasses          WHERE usuario_id = p_user_id;
  DELETE FROM investimento_classes             WHERE usuario_id = p_user_id;
  DELETE FROM subcategorias                    WHERE usuario_id = p_user_id;
  DELETE FROM categorias                       WHERE usuario_id = p_user_id;
  DELETE FROM formas_pagamento_antiga          WHERE usuario_id = p_user_id;
  DELETE FROM formas_pagamento                 WHERE usuario_id = p_user_id;
  DELETE FROM import_presets                   WHERE usuario_id = p_user_id;
  DELETE FROM patrimonio_objetivos             WHERE usuario_id = p_user_id;

  IF NOT p_keep_user THEN
    DELETE FROM usuarios WHERE id = p_user_id;
  END IF;
END
$$;

-- Limpa o usuário 0 e mantém o usuário
SELECT purge_user_data(0, true);

-- 1) Usuário de testes (id=0)
INSERT INTO usuarios (id, nome, email, senha)
VALUES (0, 'Usuário Demo', 'demo@site.com', '$2b$10$iFxsjQPVWyQ21Nv/TNEy3.NDeY4VLHEfHKlL3tp4iZ1U09sXT43YG')
ON CONFLICT (id) DO UPDATE
SET nome='Usuário Demo', email='demo@site.com';

-- Helpers de data
WITH ctx AS (
  SELECT CURRENT_DATE::date AS today,
         EXTRACT(YEAR FROM CURRENT_DATE)::int AS y,
         TO_CHAR(CURRENT_DATE, 'MM') AS m2d,
         TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM') AS ym_prev1,
         TO_CHAR(CURRENT_DATE - INTERVAL '2 month', 'YYYY-MM') AS ym_prev2,
         TO_CHAR(CURRENT_DATE + INTERVAL '1 month', 'YYYY-MM') AS ym_next1,
         TO_CHAR(CURRENT_DATE + INTERVAL '2 month', 'YYYY-MM') AS ym_next2
)

-- 2) Categorias
, cat AS (
  INSERT INTO categorias (nome, usuario_id)
  VALUES
   ('Receitas Fixas', 0),
   ('Habitação',      0),
   ('Lazer',          0),
   ('Alimentação',    0),
   ('Transporte',     0),
   ('Saúde',          0),
   ('Educação',       0),
   ('Receitas Variáveis', 0),
   ('Despesas Pessoais',  0),
   ('Despesas Temporárias e Variáveis', 0),
   ('Outros', 0)
  RETURNING id, nome
)

-- 3) Subcategorias
, sub AS (
  INSERT INTO subcategorias (nome, categoria_id, usuario_id)
  SELECT s.nome,
         c.id,
         0
  FROM (VALUES
    ('Salário',                    'Receitas Fixas'),
    ('Freelance',                  'Receitas Fixas'),
    ('Aluguel',                    'Habitação'),
    ('Energia',                    'Habitação'),
    ('Água',                       'Habitação'),
    ('Restaurantes',               'Lazer'),
    ('Cinema/Shows',               'Lazer'),
    ('Mercado',                    'Alimentação'),
    ('Delivery',                   'Alimentação'),
    ('Combustível',                'Transporte'),
    ('App de Mobilidade',          'Transporte'),
    ('Farmácia',                   'Saúde'),
    ('Cursos',                     'Educação')
  ) AS s(nome, categoria)
  JOIN cat c ON c.nome = s.categoria
  RETURNING id, nome, categoria_id
)

-- 4) Formas de pagamento
, fp AS (
  INSERT INTO formas_pagamento (nome, usuario_id, dia_vencimento, dia_fechamento)
  VALUES
    ('Cartão Visa', 0, 10, 2),
    ('Conta Corrente', 0, NULL, NULL),
    ('Cartão Master', 0, 15, 7)
  RETURNING id, nome
)

-- 5) Planejamentos (mês atual)
INSERT INTO planejamentos (ano, mes, categoria_id, valor_planejado, usuario_id, modo)
SELECT ctx.y, ctx.m2d, (SELECT id FROM cat WHERE nome='Habitação'),   2500.00, 0, 'fixo' FROM ctx
UNION ALL
SELECT ctx.y, ctx.m2d, (SELECT id FROM cat WHERE nome='Alimentação'), 1800.00, 0, 'fixo' FROM ctx
UNION ALL
SELECT ctx.y, ctx.m2d, (SELECT id FROM cat WHERE nome='Lazer'),        600.00, 0, 'fixo' FROM ctx
ON CONFLICT DO NOTHING;

-- 6) Grupos (parcelas e recorrentes)
WITH g AS (
  INSERT INTO grupos_parcelas (usuario_id, nome, total, criado_em)
  SELECT 0, 'Notebook', 3, TO_CHAR(ctx.today, 'YYYY-MM-DD') FROM ctx
  RETURNING id, nome
), r AS (
  INSERT INTO grupos_recorrentes (usuario_id, nome, periodicidade, dia_referencia, criado_em)
  SELECT 0, 'Academia', 'mensal', 5, TO_CHAR(ctx.today, 'YYYY-MM-DD') FROM ctx
  RETURNING id, nome
)
INSERT INTO lancamentos_recorrentes
(usuario_id, tipo, data_inicio, data_vencimento, valor, categoria_id, subcategoria_id, forma_pagamento_id, observacao, status, duracao_meses, ativo)
SELECT 0, 'despesa',
       (SELECT (ctx.today - INTERVAL '2 month')::date)::text,
       (SELECT (ctx.today - INTERVAL '2 month')::date)::text,
       99.90,
       (SELECT id FROM cat WHERE nome='Lazer'),
       (SELECT id FROM sub WHERE nome='Cinema/Shows'),
       (SELECT id FROM fp  WHERE nome='Conta Corrente'),
       'Mensalidade academia', 'pendente', 12, 1
FROM ctx
ON CONFLICT DO NOTHING;

-- 7) Lançamentos (receitas/despesas/parcelado/recorrente gerado)
WITH ids AS (
  SELECT
    (SELECT id FROM cat WHERE nome='Receitas Fixas')    AS cat_receitas,
    (SELECT id FROM sub WHERE nome='Salário')           AS sub_salario,
    (SELECT id FROM sub WHERE nome='Freelance')         AS sub_freela,
    (SELECT id FROM cat WHERE nome='Habitação')         AS cat_hab,
    (SELECT id FROM sub WHERE nome='Aluguel')           AS sub_aluguel,
    (SELECT id FROM sub WHERE nome='Energia')           AS sub_energia,
    (SELECT id FROM cat WHERE nome='Alimentação')       AS cat_alim,
    (SELECT id FROM sub WHERE nome='Mercado')           AS sub_mercado,
    (SELECT id FROM sub WHERE nome='Delivery')          AS sub_delivery,
    (SELECT id FROM cat WHERE nome='Lazer')             AS cat_lazer,
    (SELECT id FROM sub WHERE nome='Restaurantes')      AS sub_rest,
    (SELECT id FROM cat WHERE nome='Transporte')        AS cat_transp,
    (SELECT id FROM sub WHERE nome='Combustível')       AS sub_comb,
    (SELECT id FROM sub WHERE nome='App de Mobilidade') AS sub_app,
    (SELECT id FROM grupos_parcelas WHERE usuario_id=0 AND nome='Notebook') AS grp_parc,
    (SELECT id FROM grupos_recorrentes WHERE usuario_id=0 AND nome='Academia') AS grp_rec,
    (SELECT id FROM formas_pagamento WHERE usuario_id=0 AND nome='Cartão Visa') AS visa,
    (SELECT id FROM formas_pagamento WHERE usuario_id=0 AND nome='Conta Corrente') AS conta
)
INSERT INTO lancamentos
(tipo, data_lancamento, data_vencimento, valor, categoria_id, subcategoria_id, observacao, status, usuario_id, forma_pagamento_id, parcela, total_parcelas, grupo_parcela_id, grupo_recorrente_id)
SELECT 'receita', TO_CHAR(ctx.today, 'YYYY-MM')||'-05', NULL, 8000.00,
       ids.cat_receitas, ids.sub_salario, 'Salário do mês', 'pago', 0, ids.conta, NULL, NULL, NULL, NULL
FROM ctx, ids
UNION ALL
SELECT 'receita', TO_CHAR(ctx.today - INTERVAL '15 day', 'YYYY-MM-DD'), NULL, 1200.00,
       ids.cat_receitas, ids.sub_freela, 'Freela site', 'pago', 0, ids.conta, NULL, NULL, NULL, NULL
FROM ctx, ids
UNION ALL
SELECT 'despesa', TO_CHAR(ctx.today, 'YYYY-MM')||'-08', TO_CHAR(ctx.today, 'YYYY-MM')||'-10', 2200.00,
       ids.cat_hab, ids.sub_aluguel, 'Aluguel', 'pago', 0, ids.conta, NULL, NULL, NULL, NULL
FROM ctx, ids
UNION ALL
SELECT 'despesa', TO_CHAR(ctx.today, 'YYYY-MM')||'-12', TO_CHAR(ctx.today, 'YYYY-MM')||'-15', 350.00,
       ids.cat_hab, ids.sub_energia, 'Conta de energia', 'pendente', 0, ids.conta, NULL, NULL, NULL, NULL
FROM ctx, ids
UNION ALL
SELECT 'despesa', TO_CHAR(ctx.today - INTERVAL '25 day','YYYY-MM-DD'),
       TO_CHAR(ctx.today - INTERVAL '20 day','YYYY-MM-DD'), 95.00,
       ids.cat_alim, ids.sub_delivery, 'Delivery atrasado', 'pendente', 0, ids.visa, NULL, NULL, NULL, NULL
FROM ctx, ids
UNION ALL
SELECT 'despesa', TO_CHAR(ctx.today - INTERVAL '10 day','YYYY-MM-DD'),
       TO_CHAR(ctx.today, 'YYYY-MM')||'-10', 1800.00,
       ids.cat_alim, ids.sub_mercado, 'Notebook (1/3)', 'pendente', 0, ids.visa, 1, 3, ids.grp_parc, NULL
FROM ctx, ids
UNION ALL
SELECT 'despesa', TO_CHAR((date_trunc('month', ctx.today) + INTERVAL '1 month')::date + INTERVAL '15 day','YYYY-MM-DD'),
       TO_CHAR((date_trunc('month', ctx.today) + INTERVAL '1 month')::date + INTERVAL '10 day','YYYY-MM-DD'), 1800.00,
       ids.cat_alim, ids.sub_mercado, 'Notebook (2/3)', 'pendente', 0, ids.visa, 2, 3, ids.grp_parc, NULL
FROM ctx, ids
UNION ALL
SELECT 'despesa', TO_CHAR((date_trunc('month', ctx.today) + INTERVAL '2 month')::date + INTERVAL '15 day','YYYY-MM-DD'),
       TO_CHAR((date_trunc('month', ctx.today) + INTERVAL '2 month')::date + INTERVAL '10 day','YYYY-MM-DD'), 1800.00,
       ids.cat_alim, ids.sub_mercado, 'Notebook (3/3)', 'pendente', 0, ids.visa, 3, 3, ids.grp_parc, NULL
FROM ctx, ids
UNION ALL
SELECT 'despesa', TO_CHAR(ctx.today, 'YYYY-MM')||'-18', TO_CHAR(ctx.today, 'YYYY-MM')||'-10', 120.00,
       ids.cat_lazer, ids.sub_rest, 'Restaurante', 'pendente', 0, ids.visa, NULL, NULL, NULL, NULL
FROM ctx, ids
UNION ALL
SELECT 'despesa', TO_CHAR(ctx.today - INTERVAL '5 day', 'YYYY-MM-DD'), NULL, 250.00,
       ids.cat_transp, ids.sub_comb, 'Combustível', 'pago', 0, ids.conta, NULL, NULL, NULL, NULL
FROM ctx, ids
UNION ALL
SELECT 'despesa', TO_CHAR(ctx.today, 'YYYY-MM')||'-05', TO_CHAR(ctx.today, 'YYYY-MM')||'-05', 99.90,
       ids.cat_lazer, (SELECT id FROM sub WHERE nome='Cinema/Shows'), 'Mensalidade academia', 'pago', 0, ids.conta, NULL, NULL, NULL, (SELECT id FROM grupos_recorrentes WHERE usuario_id=0 AND nome='Academia')
FROM ctx, ids
;

-- 8) Investimentos (classes, subclasses, map, operações)
WITH ic AS (
  INSERT INTO investimento_classes (usuario_id, nome, oculto, is_padrao)
  VALUES (0,'Ação',0,1),(0,'FII',0,1),(0,'ETF',0,1),(0,'Renda Fixa',0,1)
  RETURNING id, nome
), isc AS (
  INSERT INTO investimento_subclasses (usuario_id, classe_id, nome, oculto, is_padrao)
  SELECT 0, (SELECT id FROM ic WHERE nome='Ação'), 'Ação BR', 0, 1
  UNION ALL
  SELECT 0, (SELECT id FROM ic WHERE nome='Ação'), 'Ação EUA', 0, 1
  UNION ALL
  SELECT 0, (SELECT id FROM ic WHERE nome='FII'), 'Tijolo', 0, 1
  UNION ALL
  SELECT 0, (SELECT id FROM ic WHERE nome='ETF'), 'ETF BR', 0, 1
  UNION ALL
  SELECT 0, (SELECT id FROM ic WHERE nome='Renda Fixa'), 'Tesouro Direto', 0, 1
  RETURNING id, nome, classe_id
)
INSERT INTO investimento_ticker_map (usuario_id, ticker, classe_id, subclasse_id)
VALUES
  (0, 'VALE3', (SELECT id FROM ic WHERE nome='Ação'), (SELECT id FROM isc WHERE nome='Ação BR')),
  (0, 'MXRF11', (SELECT id FROM ic WHERE nome='FII'),  (SELECT id FROM isc WHERE nome='Tijolo')),
  (0, 'IVVB11', (SELECT id FROM ic WHERE nome='ETF'),  (SELECT id FROM isc WHERE nome='ETF BR'))
ON CONFLICT DO NOTHING;

INSERT INTO investimentos (usuario_id, nome_investimento, tipo_operacao, quantidade, valor_unitario, valor_total, data_operacao, classe_id, subclasse_id)
SELECT 0,'VALE3','compra',10,60.00,600.00, TO_CHAR(CURRENT_DATE - INTERVAL '2 month','YYYY-MM')||'-02',
       (SELECT id FROM investimento_classes WHERE usuario_id=0 AND nome='Ação'),
       (SELECT id FROM investimento_subclasses WHERE usuario_id=0 AND nome='Ação BR')
UNION ALL
SELECT 0,'VALE3','compra',5,62.00,310.00, TO_CHAR(CURRENT_DATE - INTERVAL '1 month','YYYY-MM')||'-10',
       (SELECT id FROM investimento_classes WHERE usuario_id=0 AND nome='Ação'),
       (SELECT id FROM investimento_subclasses WHERE usuario_id=0 AND nome='Ação BR')
UNION ALL
SELECT 0,'VALE3','venda',3,65.00,195.00, TO_CHAR(CURRENT_DATE - INTERVAL '10 day','YYYY-MM-DD'),
       (SELECT id FROM investimento_classes WHERE usuario_id=0 AND nome='Ação'),
       (SELECT id FROM investimento_subclasses WHERE usuario_id=0 AND nome='Ação BR')
UNION ALL
SELECT 0,'MXRF11','compra',100,10.00,1000.00, TO_CHAR(CURRENT_DATE - INTERVAL '1 month','YYYY-MM')||'-03',
       (SELECT id FROM investimento_classes WHERE usuario_id=0 AND nome='FII'),
       (SELECT id FROM investimento_subclasses WHERE usuario_id=0 AND nome='Tijolo')
UNION ALL
SELECT 0,'IVVB11','compra',20,300.00,6000.00, TO_CHAR(CURRENT_DATE - INTERVAL '20 day','YYYY-MM-DD'),
       (SELECT id FROM investimento_classes WHERE usuario_id=0 AND nome='ETF'),
       (SELECT id FROM investimento_subclasses WHERE usuario_id=0 AND nome='ETF BR')
;

INSERT INTO proventos (usuario_id, ticker, nome_ativo, tipo, data, quantidade, valor_bruto, imposto, observacao)
VALUES
(0,'MXRF11','MXRF11','Rendimento', TO_CHAR(CURRENT_DATE - INTERVAL '1 month','YYYY-MM')||'-14',100,10.00,0,NULL),
(0,'MXRF11','MXRF11','Rendimento', TO_CHAR(CURRENT_DATE,'YYYY-MM')||'-14',100,11.50,0,NULL);

-- 9) Benchmarks / índices
INSERT INTO indices_cdi_diaria (data, valor) VALUES
  (TO_CHAR(CURRENT_DATE - INTERVAL '7 day','YYYY-MM-DD'), 0.04),
  (TO_CHAR(CURRENT_DATE - INTERVAL '6 day','YYYY-MM-DD'), 0.04),
  (TO_CHAR(CURRENT_DATE - INTERVAL '5 day','YYYY-MM-DD'), 0.04),
  (TO_CHAR(CURRENT_DATE - INTERVAL '4 day','YYYY-MM-DD'), 0.04),
  (TO_CHAR(CURRENT_DATE - INTERVAL '3 day','YYYY-MM-DD'), 0.04),
  (TO_CHAR(CURRENT_DATE - INTERVAL '2 day','YYYY-MM-DD'), 0.04),
  (TO_CHAR(CURRENT_DATE - INTERVAL '1 day','YYYY-MM-DD'), 0.04)
ON CONFLICT DO NOTHING;

INSERT INTO indices_selic_diaria (data, valor) VALUES
  (TO_CHAR(CURRENT_DATE - INTERVAL '7 day','YYYY-MM-DD'), 0.04),
  (TO_CHAR(CURRENT_DATE - INTERVAL '6 day','YYYY-MM-DD'), 0.04),
  (TO_CHAR(CURRENT_DATE - INTERVAL '5 day','YYYY-MM-DD'), 0.04)
ON CONFLICT DO NOTHING;

INSERT INTO indices_ipca_mensal (competencia, valor) VALUES
  (TO_CHAR(CURRENT_DATE - INTERVAL '2 month','YYYY-MM'), 0.30),
  (TO_CHAR(CURRENT_DATE - INTERVAL '1 month','YYYY-MM'), 0.18),
  (TO_CHAR(CURRENT_DATE,'YYYY-MM'), 0.22)
ON CONFLICT DO NOTHING;

INSERT INTO indices_tesouro_pu (data, nome, pu, pu_compra) VALUES
  (TO_CHAR(date_trunc('month', CURRENT_DATE) - INTERVAL '2 month','YYYY-MM')||'-01', 'Tesouro Renda+ 2065', 10000.00, 9950.00),
  (TO_CHAR(date_trunc('month', CURRENT_DATE) - INTERVAL '1 month','YYYY-MM')||'-01', 'Tesouro Renda+ 2065', 10120.00, 10060.00),
  (TO_CHAR(date_trunc('month', CURRENT_DATE),'YYYY-MM')||'-01',                           'Tesouro Renda+ 2065', 10210.00, 10150.00)
ON CONFLICT DO NOTHING;

INSERT INTO fx_cotacoes_mensais (par, ano, mes, close, data_ref) VALUES
  ('USD/BRL', EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '2 month')::int, EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '2 month')::int, 5.10, TO_CHAR(date_trunc('month', CURRENT_DATE) - INTERVAL '2 month','YYYY-MM')||'-01'),
  ('USD/BRL', EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')::int, EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')::int, 5.22, TO_CHAR(date_trunc('month', CURRENT_DATE) - INTERVAL '1 month','YYYY-MM')||'-01'),
  ('USD/BRL', EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, 5.17, TO_CHAR(date_trunc('month', CURRENT_DATE),'YYYY-MM')||'-01')
ON CONFLICT DO NOTHING;

-- 10) Patrimônio (contas e últimos 6 meses)
WITH acc AS (
  INSERT INTO patrimonio_contas (usuario_id, nome, instituicao, tipo, cor_hex, ativa)
  VALUES (0,'Conta Corrente','Nubank','Conta','#7C3AED',1),
         (0,'Poupança','Inter','Caixa','#10B981',1)
  RETURNING id, nome
),
series AS (
  SELECT gs AS n,
         EXTRACT(YEAR FROM (date_trunc('month', CURRENT_DATE) - (gs || ' month')::interval))::int AS ano,
         EXTRACT(MONTH FROM (date_trunc('month', CURRENT_DATE) - (gs || ' month')::interval))::int AS mes
  FROM generate_series(5,0,-1) gs
)
INSERT INTO patrimonio_saldos (usuario_id, conta_id, ano, mes, saldo, aportes, retiradas)
SELECT 0, (SELECT id FROM acc WHERE nome='Conta Corrente'),
       s.ano, s.mes,
       3000 + (5 - s.n) * 400, 1000 - (s.n*50), 200
FROM series s
UNION ALL
SELECT 0, (SELECT id FROM acc WHERE nome='Poupança'),
       s.ano, s.mes,
       2000 + (5 - s.n) * 200,  500 - (s.n*40), CASE WHEN s.n IN (3,2,1,0) THEN 100 ELSE 0 END
FROM series s
;

INSERT INTO patrimonio_objetivos (usuario_id, ano, objetivo, base_inicial)
VALUES (0, EXTRACT(YEAR FROM CURRENT_DATE)::int, 10000, 5000)
ON CONFLICT DO NOTHING;

-- 11) Planos
WITH p AS (
  INSERT INTO planos (usuario_id, nome, inicio, fim, parcelas, usar_parcelas, valor_total, valor_parcela, usar_parcela, arrecadado, status, icone, criado_em)
  VALUES (0,'Viagem Férias',
          TO_CHAR(date_trunc('month', CURRENT_DATE) - INTERVAL '2 month','YYYY-MM')||'-01', NULL,
          10, 1, 5000.00, 500.00, 0, 1200.00, 'andamento', 'plane',
          TO_CHAR(date_trunc('month', CURRENT_DATE) - INTERVAL '2 month','YYYY-MM')||'-01')
  RETURNING id
)
INSERT INTO planos_movimentos (plano_id, usuario_id, tipo, valor, data)
SELECT id, 0, 'aporte', 400.00, TO_CHAR(date_trunc('month', CURRENT_DATE) - INTERVAL '2 month','YYYY-MM')||'-15' FROM p
UNION ALL
SELECT id, 0, 'aporte', 400.00, TO_CHAR(date_trunc('month', CURRENT_DATE) - INTERVAL '1 month','YYYY-MM')||'-15' FROM p
UNION ALL
SELECT id, 0, 'aporte', 400.00, TO_CHAR(date_trunc('month', CURRENT_DATE),'YYYY-MM')||'-15' FROM p
;

-- 12) Distribuição/Rebalanceamento
INSERT INTO distribuicao_rebalanceamento (usuario_id, classe, percentual_classe, subclasse, percentual_subclasse, percentual_subclasse_interna, ativo, percentual_ativo)
VALUES
 (0,'Ação',50,'Ação BR',100,NULL,'VALE3',100),
 (0,'FII',30,'Tijolo',100,NULL,'MXRF11',100),
 (0,'ETF',20,'ETF BR',100,NULL,'IVVB11',100)
ON CONFLICT DO NOTHING;

-- 13) Regras e importações
INSERT INTO regras_categorizacao (usuario_id, padrao, tipo_match, categoria_id, subcategoria_id, prioridade, atualizado_em)
VALUES (0, 'IFood', 'contém',
        (SELECT id FROM cat WHERE nome='Alimentação'),
        (SELECT id FROM sub WHERE nome='Delivery'),
        50, TO_CHAR(CURRENT_DATE,'YYYY-MM-DD'))
ON CONFLICT DO NOTHING;

INSERT INTO import_lotes (usuario_id, origem, nome_arquivo, status, criado_em)
VALUES (0,'CSV Nubank','nubank_set.csv','processado', TO_CHAR(CURRENT_DATE,'YYYY-MM-DD'))
RETURNING id \gset

INSERT INTO import_itens (lote_id, raw, preview_json, validado)
VALUES (:id, TO_CHAR(CURRENT_DATE,'YYYY-MM')||'-01; DÉBITO; IFood; -95,00',
        '{ "data":"'||TO_CHAR(CURRENT_DATE,'YYYY-MM')||'-01", "desc":"IFood", "valor": -95.00 }', 1);

INSERT INTO transacoes_externas (usuario_id, origem, external_id, conta_id, data_lancamento, data_vencimento, valor, descricao, tipo, categoria_id, subcategoria_id, forma_pagamento_id, conciliado)
VALUES
(0,'openfinance','ext-123',
 (SELECT id FROM patrimonio_contas WHERE usuario_id=0 AND nome='Conta Corrente'),
 TO_CHAR(CURRENT_DATE - INTERVAL '3 day','YYYY-MM-DD'), NULL, 35.90, 'Uber corrida', 'despesa',
 (SELECT id FROM cat WHERE nome='Transporte'),
 (SELECT id FROM sub WHERE nome='App de Mobilidade'),
 (SELECT id FROM formas_pagamento WHERE usuario_id=0 AND nome='Conta Corrente'),
 0);

-- 14) Catálogo + valores atuais
INSERT INTO catalogo_ativos (tipo, nome_display, codigo_externo, indexador, vencimento, base_dias, ir_regra, fonte, updated_at, percentual_cdi)
VALUES ('Tesouro', 'Tesouro Renda+ 2065', 'Renda+ 2065', 'IPCA', '2065-01-01', 252, 'regra_padrao', 'Tesouro',
        TO_CHAR(CURRENT_DATE,'YYYY-MM-DD'), 0.0)
ON CONFLICT DO NOTHING;

INSERT INTO valores_atuais (usuario_id, nome_investimento, data_referencia, preco_unitario, valor_total)
VALUES (0, 'VALE3', TO_CHAR(date_trunc('month', CURRENT_DATE),'YYYY-MM')||'-01', 62.50, 937.50)
ON CONFLICT DO NOTHING;