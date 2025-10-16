const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth'); // <--- aqui importamos o middleware

router.get('/anos-disponiveis', autenticar, (req, res) => {
  const usuarioId = req.user.id;
  const sql = `
    SELECT DISTINCT SUBSTRING(data_lancamento,1,4) AS ano
    FROM lancamentos
    WHERE usuario_id = ?
    ORDER BY ano ASC
  `;
  db.all(sql, [usuarioId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao carregar anos' });
    const anos = rows.map(r => Number(r.ano)).filter(Boolean);
    res.json(anos);
  });
});

// GET /lancamentos/diario?ano=2025&mes=07
router.get('/diario', autenticar, (req, res) => {
  const { ano, mes } = req.query;
  if (!ano || !mes) return res.status(400).json({ error: 'Ano e mês são obrigatórios' });

  const usuarioId = req.user.id;
  const mesStr = String(mes).padStart(2, '0');

  const sql = `
    SELECT
      data_lancamento AS data,
      SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
      SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
    FROM lancamentos
    WHERE usuario_id = ?
      AND SUBSTRING(data_lancamento,1,4) = ?
      AND SUBSTRING(data_lancamento,6,2) = ?
    GROUP BY data_lancamento
    ORDER BY data ASC
  `;

  db.all(sql, [usuarioId, String(ano), mesStr], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // Preenche dias faltantes com zero
    const daysInMonth = new Date(Number(ano), Number(mes), 0).getDate();
    const map = new Map(rows.map(r => [r.data, r]));
    const list = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${ano}-${mesStr}-${String(d).padStart(2,'0')}`;
      const r = map.get(iso);
      list.push({
        data: iso,
        receitas: Number(r?.receitas || 0),
        despesas: Number(r?.despesas || 0),
      });
    }
    res.json(list);
  });
});

// GET /lancamentos/por-dia?data=YYYY-MM-DD
// (alternativamente aceita ano, mes, dia)
router.get('/por-dia', autenticar, (req, res) => {
  const usuarioId = req.user.id;
  const { data, ano, mes, dia } = req.query;

  let dataISO = data;
  if (!dataISO && ano && mes && dia) {
    dataISO = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  }
  if (!dataISO) return res.status(400).json({ error: 'Informe data=YYYY-MM-DD ou ano/mes/dia' });

  const sql = `
    SELECT 
      l.*,
      c.nome AS categoria_nome,
      s.nome AS subcategoria_nome,
      f.nome AS forma_pagamento_nome
    FROM lancamentos l
    LEFT JOIN categorias c ON l.categoria_id = c.id
    LEFT JOIN subcategorias s ON l.subcategoria_id = s.id
    LEFT JOIN formas_pagamento f ON l.forma_pagamento_id = f.id
    WHERE l.usuario_id = ?
      AND l.data_lancamento = ?
      AND l.tipo = 'despesa'
    ORDER BY l.data_lancamento ASC, l.valor DESC
  `;

  db.all(sql, [usuarioId, dataISO], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

router.post('/', autenticar, async (req, res) => {
  const usuarioId = req.user.id;
  const payload = req.body;

  // helper p/ normalizar ids opcionais
  const toNullableInt = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
  const toNumber = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

  try {
    // 🚩 CASO 1 — Parcelado (vem um array de parcelas do front)
    if (Array.isArray(payload) && payload.length > 1) {
      const parcelas = payload;

      // cria um grupo de parcelas REAL (id inteiro) — ignora qualquer uuid vindo do front
      const total = parcelas.length;
      const nomeGrupo = `Parcelado ${new Date().toISOString().slice(0,10)}`;

      await db.query('BEGIN');
      const { rows: grpRows } = await db.query(
        `INSERT INTO grupos_parcelas (usuario_id, total, nome, criado_em)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [usuarioId, total, nomeGrupo, new Date().toISOString()]
      );
      const grupoId = grpRows[0].id;

      // monta INSERT multi-linhas nas parcelas
      const cols = [
        'tipo','data_lancamento','data_vencimento','valor',
        'categoria_id','subcategoria_id','forma_pagamento_id',
        'observacao','status','parcela','total_parcelas',
        'grupo_parcela_id','usuario_id'
      ];

      const placeholders = [];
      const params = [];
      parcelas.forEach((p, i) => {
        const base = i * cols.length;
        placeholders.push(
          '(' + cols.map((_, j) => `$${base + j + 1}`).join(', ') + ')'
        );
        params.push(
          p.tipo,
          p.data_lancamento,
          p.data_vencimento,
          toNumber(p.valor),
          toNullableInt(p.categoria_id),
          toNullableInt(p.subcategoria_id),
          toNullableInt(p.forma_pagamento_id),
          p.observacao || '',
          p.status || 'pendente',
          toNullableInt(p.parcela) ?? (i + 1),
          toNullableInt(p.total_parcelas) ?? total,
          grupoId,
          usuarioId
        );
      });

      const { rows: inserted } = await db.query(
        `INSERT INTO lancamentos (${cols.join(', ')})
         VALUES ${placeholders.join(', ')}
         RETURNING id`,
        params
      );
      await db.query('COMMIT');

      return res.status(201).json({
        sucesso: true,
        grupo_parcela_id: grupoId,
        inseridos: inserted.map(r => r.id)
      });
    }

    // 🚩 CASO 2 — lançamento simples (objeto único)
    const l = payload;
    const { rows } = await db.query(
      `INSERT INTO lancamentos (
         tipo, data_lancamento, data_vencimento, valor,
         categoria_id, subcategoria_id, forma_pagamento_id,
         observacao, status, parcela, total_parcelas, grupo_parcela_id, usuario_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
       ) RETURNING id`,
      [
        l.tipo,
        l.data_lancamento,
        l.data_vencimento,
        toNumber(l.valor),
        toNullableInt(l.categoria_id),
        toNullableInt(l.subcategoria_id),
        toNullableInt(l.forma_pagamento_id),
        l.observacao || '',
        l.status || 'pendente',
        toNullableInt(l.parcela),
        toNullableInt(l.total_parcelas),
        toNullableInt(l.grupo_parcela_id), // geralmente null no simples
        usuarioId
      ]
    );
    return res.status(201).json({ id: rows[0].id });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    console.error('[/lancamentos POST] erro', err);
    return res.status(500).json({ error: 'db_error' });
  }
});

router.put('/pagar-mes', autenticar, (req, res) => {
  const { ano, mes, forma_pagamento_id } = req.body;

  if (!ano || !mes) {
    return res.status(400).json({ error: 'Ano e mês são obrigatórios' });
  }

  const usuarioId = req.user.id;
  const mesStr = String(mes).padStart(2, '0');
  const dataInicial = `${ano}-${mesStr}-01`;
  const dataFinal = `${ano}-${mesStr}-31`;

let sql = `
  UPDATE lancamentos
  SET status = 'pago'
  WHERE usuario_id = ?
    AND status = 'pendente'
    AND data_vencimento BETWEEN ? AND ?
`;

  const params = [usuarioId, dataInicial, dataFinal];

  if (forma_pagamento_id && forma_pagamento_id !== 'todas') {
    sql += ' AND forma_pagamento_id = ?';
    params.push(forma_pagamento_id);
  }

  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ atualizados: this.changes });
  });
});

function parseLocalISO(iso) {
  // "2025-09-10" -> Date local sem drift
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatYYYYMMDDLocal(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ajustarParaUltimoDiaDisponivel(ano, mesIndexZeroBase, dia) {
  // mesIndexZeroBase é 0=Jan, igual Date JS
  const dt = new Date(ano, mesIndexZeroBase, 1);
  const ultimoDia = new Date(ano, mesIndexZeroBase + 1, 0).getDate();
  dt.setDate(Math.min(dia, ultimoDia));
  return dt;
}

router.put('/:id', autenticar, (req, res) => {
  const id = req.params.id;

  // Primeiro busca o lançamento original
  db.get('SELECT * FROM lancamentos WHERE id = ? AND usuario_id = ?', [id, req.user.id], (err, lancamento) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado' });

    const {
      tipo,
      data_lancamento,
      data_vencimento,
      valor,
      categoria_id,
      subcategoria_id,
      forma_pagamento_id,
      observacao,
      status,
      grupo_parcela_id,
      editarGrupo,
    } = req.body;

    // ✅ 1. Edição de recorrentes
    if (req.body.editarTodosRecorrentes && lancamento.grupo_recorrente_id) {
const buscarSQL = `
  SELECT * FROM lancamentos
  WHERE grupo_recorrente_id = ?
    AND usuario_id = ?
    AND data_lancamento >= ?
  ORDER BY data_lancamento
`;

      db.all(buscarSQL, [lancamento.grupo_recorrente_id, req.user.id, data_lancamento], (err, recorrentes) => {
        if (err) return res.status(500).json({ error: err.message });

  const updates = recorrentes.map((recorrente, index) => {
  const baseDateLanc = parseLocalISO(data_lancamento);
  const novaDataLanc = ajustarParaUltimoDiaDisponivel(
  baseDateLanc.getFullYear(),
  baseDateLanc.getMonth() + index,
  baseDateLanc.getDate()
);

  const baseDateVenc = parseLocalISO(data_vencimento);
  const novaDataVenc = ajustarParaUltimoDiaDisponivel(
  baseDateVenc.getFullYear(),
  baseDateVenc.getMonth() + index,
  baseDateVenc.getDate()
);


  return new Promise((resolve, reject) => {
    db.run(
      `
      UPDATE lancamentos SET
        tipo = ?, data_lancamento = ?, data_vencimento = ?, valor = ?,
        categoria_id = ?, subcategoria_id = ?, forma_pagamento_id = ?,
        observacao = ?, status = ?
      WHERE id = ? AND usuario_id = ?
    `,
      [
        tipo,
        formatYYYYMMDDLocal(novaDataLanc),
        formatYYYYMMDDLocal(novaDataVenc),
        valor,
        categoria_id,
        subcategoria_id,
        forma_pagamento_id,
        observacao || '',
        status,
        recorrente.id,
        req.user.id
      ],
      function (err) {
        if (err) reject(err);
        else resolve();
      }
    );
  });
});

        Promise.all(updates)
          .then(() => res.json({ sucesso: true, alteradas: updates.length }))
          .catch((err) => res.status(500).json({ error: err.message }));
      });
      return;
    }

    // ✅ 2. Edição em grupo de parcelas
    if (editarGrupo && grupo_parcela_id) {
      const buscarSQL = `
        SELECT * FROM lancamentos
        WHERE grupo_parcela_id = ? AND usuario_id = ?
        ORDER BY parcela
      `;

      db.all(buscarSQL, [grupo_parcela_id, req.user.id], (err, parcelas) => {
        if (err) return res.status(500).json({ error: err.message });

        const updates = parcelas.map((p, i) => {
          const baseDateL = parseLocalISO(data_lancamento);
const novaDataL = ajustarParaUltimoDiaDisponivel(
  baseDateL.getFullYear(),
  baseDateL.getMonth() + i,
  baseDateL.getDate()
);
       const baseDateV = parseLocalISO(data_vencimento);
const novaDataV = ajustarParaUltimoDiaDisponivel(
  baseDateV.getFullYear(),
  baseDateV.getMonth() + i,
  baseDateV.getDate()
);

          return new Promise((resolve, reject) => {
            db.run(
              `
              UPDATE lancamentos SET
                tipo = ?, data_lancamento = ?, data_vencimento = ?, valor = ?,
                categoria_id = ?, subcategoria_id = ?, forma_pagamento_id = ?,
                observacao = ?, status = ?
              WHERE id = ? AND usuario_id = ?
            `,
              [
                tipo,
                formatYYYYMMDDLocal(novaDataL),
                formatYYYYMMDDLocal(novaDataV),
                valor,
                categoria_id,
                subcategoria_id,
                forma_pagamento_id,
                observacao || '',
                status,
                p.id,
                req.user.id
              ],
              function (err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        });

        Promise.all(updates)
          .then(() => res.json({ sucesso: true, alteradas: updates.length }))
          .catch((err) => res.status(500).json({ error: err.message }));
      });
      return;
    }

    // ✅ 3. Edição simples
    const sql = `
      UPDATE lancamentos SET
        tipo = ?, data_lancamento = ?, data_vencimento = ?, valor = ?,
        categoria_id = ?, subcategoria_id = ?, forma_pagamento_id = ?,
        observacao = ?, status = ?
      WHERE id = ? AND usuario_id = ?
    `;

    const params = [
      tipo,
      data_lancamento,
      data_vencimento,
      valor,
      categoria_id,
      subcategoria_id,
      forma_pagamento_id,
      observacao || '',
      status,
      id,
      req.user.id
    ];

    db.run(sql, params, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ sucesso: true, id });
    });
  });
});

// ROTA GET corrigida para retornar os 10 últimos lançamentos com nome da forma de pagamento
router.get('/', autenticar, (req, res) => {
  const { mes, ano, limite = 10, status, forma_pagamento_id, sort = 'data_lancamento', order = 'DESC' } = req.query;

// Campos permitidos para ordenação
const camposPermitidos = ['data_lancamento', 'data_vencimento', 'valor', 'forma_pagamento', 'categoria_nome', 'subcategoria_nome', 'status'];
const direcoesPermitidas = ['ASC', 'DESC'];

// Garantir que só ordena por campos válidos
let campoOrdenacao;
switch (sort) {
  case 'valor':
    campoOrdenacao = 'l.valor'; // garante que usa o número puro
    break;
  case 'data_lancamento':
    campoOrdenacao = 'l.data_lancamento';
    break;
  case 'data_vencimento':
    campoOrdenacao = 'l.data_vencimento';
    break;
  case 'forma_pagamento':
    campoOrdenacao = 'forma_pagamento'; // ou o nome da tabela/alias que traz forma pgto
    break;
  case 'categoria_nome':
    campoOrdenacao = 'c.nome';
    break;
  case 'subcategoria_nome':
    campoOrdenacao = 's.nome';
    break;
  case 'status':
    campoOrdenacao = 'l.status';
    break;
  default:
    campoOrdenacao = 'l.data_lancamento';
}
const direcaoOrdenacao = direcoesPermitidas.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

  if (!mes || !ano) {
    return res.status(400).json({ error: 'Informe mês e ano' });
  }

  const mesStr = String(mes).padStart(2, '0');
  const dataInicial = `${ano}-${mesStr}-01`;
  const dataFinal = `${ano}-${mesStr}-31`;
  const usuarioId = req.user.id;

  const params = [dataInicial, dataFinal, usuarioId];
  if (status) params.push(status);
  if (forma_pagamento_id && forma_pagamento_id !== 'todas') params.push(forma_pagamento_id);
  params.push(parseInt(limite));

  const sql = `
    SELECT l.*, c.nome as categoria_nome, s.nome as subcategoria_nome, f.nome as forma_pagamento
    FROM lancamentos l
    LEFT JOIN categorias c ON l.categoria_id = c.id
    LEFT JOIN subcategorias s ON l.subcategoria_id = s.id
    LEFT JOIN formas_pagamento f ON l.forma_pagamento_id = f.id
    WHERE l.data_lancamento BETWEEN ? AND ?
      AND l.usuario_id = ?
      ${status ? "AND l.status = ?" : ""}
      ${forma_pagamento_id && forma_pagamento_id !== 'todas' ? "AND l.forma_pagamento_id = ?" : ""}
    ORDER BY ${campoOrdenacao} ${direcaoOrdenacao}
    LIMIT ?
  `;

  db.all(sql, params, (err, lancamentosReais) => {
    if (err) return res.status(500).json({ error: err.message });

    // Agora buscamos os recorrentes ativos
    const recorrenteSql = `
      SELECT r.*, 
             c.nome as categoria_nome, 
             s.nome as subcategoria_nome, 
             f.nome as forma_pagamento
      FROM lancamentos_recorrentes r
      LEFT JOIN categorias c ON r.categoria_id = c.id
      LEFT JOIN subcategorias s ON r.subcategoria_id = s.id
      LEFT JOIN formas_pagamento f ON r.forma_pagamento_id = f.id
      WHERE r.usuario_id = ? AND r.ativo = 1
    `;

    db.all(recorrenteSql, [usuarioId], (err2, recorrentes) => {
      if (err2) return res.status(500).json({ error: err2.message });

      // Simula os lançamentos recorrentes do mês/ano solicitado
      const recorrentesSimulados = recorrentes
        .map(r => {
          const dataInicio = new Date(r.data_inicio);
          const dataSimulada = new Date(`${ano}-${mesStr}-01`);
          const diffMeses =
            (dataSimulada.getFullYear() - dataInicio.getFullYear()) * 12 +
            (dataSimulada.getMonth() - dataInicio.getMonth());

          if (diffMeses >= 0 && diffMeses < r.duracao_meses) {
            return {
              ...r,
              id: `recorrente-${r.id}`, // evita conflito com ID real
              data_lancamento: `${ano}-${mesStr}-01`,
              data_vencimento: `${ano}-${mesStr}-05`, // você pode ajustar como quiser
              parcela: null,
              total_parcelas: null,
              grupo_parcela_id: null,
              recorrente: true
            };
          }
          return null;
        })
        .filter(Boolean);
console.log('Recorrentes simulados:', recorrentesSimulados);

      const todos = [...lancamentosReais, ...recorrentesSimulados];

      // Ordena por data_lancamento DESC
      // Ordena de acordo com o campo e direção escolhidos
todos.sort((a, b) => {
  let valA = a[campoOrdenacao.replace('l.', '')];
  let valB = b[campoOrdenacao.replace('l.', '')];

  // Se for data, transformar em Date para comparar
  if (campoOrdenacao.includes('data')) {
    valA = new Date(valA);
    valB = new Date(valB);
  }

  // Se for valor numérico, garantir que é Number
  if (campoOrdenacao === 'l.valor') {
    valA = Number(valA);
    valB = Number(valB);
  }

  if (valA < valB) return direcaoOrdenacao === 'ASC' ? -1 : 1;
  if (valA > valB) return direcaoOrdenacao === 'ASC' ? 1 : -1;
  return 0;
});

      res.json(todos);
    });
  });
});

router.get('/pendentes-vencimento', autenticar, (req, res) => {
  const { mes, ano, forma_pagamento_id } = req.query;
  const usuarioId = req.user.id;

  let sql = `
    SELECT l.*, fp.nome AS forma_pagamento, c.nome AS categoria_nome, s.nome AS subcategoria_nome
    FROM lancamentos l
    LEFT JOIN formas_pagamento fp ON l.forma_pagamento_id = fp.id
    LEFT JOIN categorias c ON l.categoria_id = c.id
    LEFT JOIN subcategorias s ON l.subcategoria_id = s.id
    WHERE l.usuario_id = ?
      AND l.status = 'pendente'
      AND SUBSTRING(l.data_vencimento,6,2) = ?
      AND SUBSTRING(l.data_vencimento,1,4) = ?
  `;

  const params = [usuarioId, String(mes).padStart(2, '0'), String(ano)];

  if (forma_pagamento_id && forma_pagamento_id !== 'todas') {
    sql += ' AND l.forma_pagamento_id = ?';
    params.push(forma_pagamento_id);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao buscar lançamentos pendentes por vencimento' });
    }
    res.json(rows);
  });
});

router.delete('/:id', autenticar, (req, res) => {
  const id = req.params.id;

  db.get(
    'SELECT grupo_parcela_id FROM lancamentos WHERE id = ? AND usuario_id = ?',
    [id, req.user.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      let sql, params;

      if (row?.grupo_parcela_id) {
        // Excluir todas as parcelas do grupo
        sql = 'DELETE FROM lancamentos WHERE grupo_parcela_id = ? AND usuario_id = ?';
        params = [row.grupo_parcela_id, req.user.id];
      } else {
        // Excluir somente o lançamento individual
        sql = 'DELETE FROM lancamentos WHERE id = ? AND usuario_id = ?';
        params = [id, req.user.id];
      }

      db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
          sucesso: true,
          excluidas: this.changes,
          grupo: !!row?.grupo_parcela_id
        });
      });
    }
  );
});

// GET /lancamentos/meses-disponiveis?ano=2025
router.get('/meses-disponiveis', autenticar, (req, res) => {
  const { ano } = req.query;

  if (!ano) return res.status(400).json({ error: 'Ano é obrigatório' });

  const sql = `
    SELECT DISTINCT SUBSTRING(data_lancamento,6,2) AS mes
    FROM lancamentos
    WHERE SUBSTRING(data_lancamento,1,4) = ? AND usuario_id = ?
    ORDER BY mes DESC
  `;

  db.all(sql, [ano, req.user.id], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar meses disponíveis:', err.message); // para debug
      return res.status(500).json({ error: err.message });
    }

    const meses = rows.map(r => parseInt(r.mes));
    res.json(meses);
  });
});

// GET /lancamentos/despesas-por-categoria?ano=2025&mes=07
router.get('/despesas-por-categoria', autenticar, (req, res) => {
  const { ano, mes } = req.query;
  const usuarioId = req.user.id;

  if (!ano || !mes) {
    return res.status(400).json({ error: 'Informe ano e mês' });
  }

  const receitaQuery = `
    SELECT SUM(valor) AS total_receita
    FROM lancamentos
    WHERE tipo = 'receita'
      AND SUBSTRING(data_lancamento,1,4) = ?
      AND SUBSTRING(data_lancamento,6,2) = ?
      AND usuario_id = ?
  `;

  const despesasQuery = `
    SELECT c.nome AS categoria, SUM(l.valor) AS total
    FROM lancamentos l
    JOIN categorias c ON l.categoria_id = c.id
    WHERE l.tipo = 'despesa'
      AND SUBSTRING(l.data_lancamento,1,4) = ?
      AND SUBSTRING(l.data_lancamento,6,2) = ?
      AND l.usuario_id = ?
    GROUP BY c.nome
  `;

  const params = [ano, mes.padStart(2, '0'), usuarioId];

  db.get(receitaQuery, params, (err, receitaResult) => {
    if (err) return res.status(500).json({ error: err.message });

    const totalReceita = receitaResult.total_receita || 0;

    db.all(despesasQuery, params, (err, despesas) => {
      if (err) return res.status(500).json({ error: err.message });

      const resultado = despesas.map(item => ({
        categoria: item.categoria,
        total: item.total,
        percentual: totalReceita > 0 ? (item.total / totalReceita) * 100 : 0
      }));

      // ordena do maior para o menor percentual
      resultado.sort((a, b) => b.percentual - a.percentual);

      res.json(resultado);
    });
  });
});

router.get('/resumo-mensal', autenticar, (req, res) => {
  const ano = req.query.ano;

  if (!ano) return res.status(400).json({ error: 'Informe o ano' });

  const query = `
    SELECT 
      SUBSTRING(data_lancamento,6,2) AS mes,
      tipo,
      SUM(valor) AS total
    FROM lancamentos
    WHERE SUBSTRING(data_lancamento,1,4) = ?
      AND usuario_id = ?
    GROUP BY mes, tipo
    ORDER BY mes
  `;

  db.all(query, [ano, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const resultado = Array.from({ length: 12 }, (_, i) => {
      const mes = String(i + 1).padStart(2, '0');
      return {
        mes,
        receita: 0,
        despesa: 0
      };
    });

    for (const row of rows) {
      const index = parseInt(row.mes, 10) - 1;
      if (row.tipo === 'receita' || row.tipo === 'despesa') {
        resultado[index][row.tipo] = row.total;
      }
    }

    res.json(resultado);
  });
});

router.get('/gastos-cartoes', autenticar, (req, res) => {
  const usuarioId = req.user.id;
  const { ano, mes } = req.query;

  if (!ano || !mes) {
    return res.status(400).json({ erro: 'Ano e mês são obrigatórios.' });
  }

  const sql = `
    SELECT 
      f.nome AS nome,
      SUM(l.valor) AS valor
    FROM lancamentos l
    JOIN formas_pagamento f ON l.forma_pagamento_id = f.id
    WHERE 
      l.usuario_id = ?
      AND SUBSTRING(l.data_lancamento,1,4) = ?
      AND SUBSTRING(l.data_lancamento,6,2) = ?
      AND l.tipo = 'despesa'
    GROUP BY f.nome
    ORDER BY valor DESC
  `;

  db.all(sql, [usuarioId, String(ano), String(mes).padStart(2, '0')], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar gastos por forma de pagamento:', err.message);
      return res.status(500).json({ erro: 'Erro interno ao buscar dados.' });
    }

    res.json(rows);
  });
});

// Rota usada no card de pendentes da tela lançamentos
router.get('/pendentes-mes', autenticar, (req, res) => {
  const { ano, mes, forma_pagamento_id } = req.query;

  if (!ano || !mes) {
    return res.status(400).json({ error: 'Ano e mês são obrigatórios' });
  }

  const usuarioId = req.user.id;
  const mesStr = String(mes).padStart(2, '0');

  let sql = `
    SELECT SUM(valor) as total
    FROM lancamentos
    WHERE status = 'pendente'
      AND tipo = 'despesa'
      AND usuario_id = ?
      AND SUBSTRING(data_vencimento,1,4) = ?
      AND SUBSTRING(data_vencimento,6,2) = ?
  `;

  const params = [usuarioId, ano, mesStr];

  // 🔹 Se houver forma de pagamento, adiciona filtro
  if (forma_pagamento_id && forma_pagamento_id !== 'todas') {
    sql += ' AND forma_pagamento_id = ?';
    params.push(forma_pagamento_id);
  }

  db.get(sql, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ total: row.total || 0 });
  });
});

router.get('/vencidos-contagem', autenticar, (req, res) => {
  const { ano, mes } = req.query;
  if (!ano || !mes) return res.status(400).json({ error: 'Ano e mês são obrigatórios' });

  const usuarioId = req.user.id;
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0]; // exemplo: 2025-07-24

  const mesSelecionado = `${ano}-${String(mes).padStart(2, '0')}-31`;

  const sql = `
    SELECT SUM(valor) as total
    FROM lancamentos
    WHERE status = 'pendente'
      AND usuario_id = ?
      AND data_vencimento < ?
      AND data_vencimento <= ?
  `;

  db.get(sql, [usuarioId, hojeStr, mesSelecionado], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ total: row.total || 0 });
  });
});

router.get('/pendentes-todos', autenticar, (req, res) => {
  const usuarioId = req.user.id;

  const sql = `
    SELECT SUM(valor) as total
    FROM lancamentos
    WHERE status = 'pendente'
      AND tipo = 'despesa'
      AND usuario_id = ?
  `;

  db.get(sql, [usuarioId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ total: row.total || 0 });
  });
});

router.get('/total-despesas', autenticar, (req, res) => {
  const { ano, mes, forma_pagamento_id } = req.query;

  if (!ano || !mes) return res.status(400).json({ error: 'Ano e mês são obrigatórios' });

  const usuarioId = req.user.id;
  const mesStr = String(mes).padStart(2, '0');

  const baseSql = `
    SELECT SUM(valor) as total
    FROM lancamentos
    WHERE tipo = 'despesa'
      AND usuario_id = ?
      AND SUBSTRING(data_lancamento,1,4) = ?
      AND SUBSTRING(data_lancamento,6,2) = ?
  `;

  const filtroFormaPgto = forma_pagamento_id && forma_pagamento_id !== 'todas'
    ? ' AND forma_pagamento_id = ?'
    : '';

  const sql = baseSql + filtroFormaPgto;
  const params = [usuarioId, ano, mesStr];
  if (filtroFormaPgto) params.push(forma_pagamento_id);

  db.get(sql, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ total: row.total || 0 });
  });
});

// GET /lancamentos/grupo/:grupo_recorrente_id — retorna todos os lançamentos de um grupo recorrente
router.get('/grupo/:grupo_recorrente_id', autenticar, (req, res) => {
  const { grupo_recorrente_id } = req.params;

  const sql = `
    SELECT * FROM lancamentos
    WHERE grupo_recorrente_id = ?
      AND usuario_id = ?
    ORDER BY data_lancamento
  `;

  db.all(sql, [grupo_recorrente_id, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.delete('/recorrente/:id', autenticar, (req, res) => {
  const id = req.params.id;

  // Busca o lançamento atual para obter a data e grupo_recorrente_id
  db.get('SELECT * FROM lancamentos WHERE id = ? AND usuario_id = ?', [id, req.user.id], (err, lancamento) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado' });

    const { grupo_recorrente_id, data_lancamento } = lancamento;

    if (!grupo_recorrente_id) {
      return res.status(400).json({ error: 'Este lançamento não pertence a um grupo recorrente.' });
    }

    const sql = `
      DELETE FROM lancamentos
      WHERE grupo_recorrente_id = ?
        AND usuario_id = ?
        AND data_lancamento >= ?
    `;

    db.run(sql, [grupo_recorrente_id, req.user.id, data_lancamento], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        sucesso: true,
        excluidos: this.changes,
        mensagem: 'Lançamentos recorrentes a partir deste mês foram excluídos com sucesso.'
      });
    });
  });
});

router.get('/realizado-vs-planejado', autenticar, (req, res) => {
  const { ano, mes } = req.query;
  const usuarioId = req.user.id;
  const mesStr = String(mes).padStart(2, '0');

  const sql = `
    SELECT
      c.nome AS categoria,
      COALESCE(p.valor_planejado, 0) AS planejado,
      COALESCE(SUM(l.valor), 0) AS realizado
    FROM categorias c
    LEFT JOIN planejamentos p
      ON p.categoria_id = c.id
      AND p.ano = ?
      AND p.mes = ?
      AND p.usuario_id = ?
    LEFT JOIN lancamentos l
      ON l.categoria_id = c.id
      AND l.usuario_id = ?
      AND SUBSTRING(l.data_lancamento,1,4) = ?
      AND SUBSTRING(l.data_lancamento,6,2) = ?
    WHERE (c.usuario_id = ? OR c.usuario_id IS NULL)
    GROUP BY c.id
    ORDER BY c.nome
  `;

db.all(sql, [ano, mesStr, usuarioId, usuarioId, ano, mesStr, usuarioId], (err, rows) => {
  if (err) {
    console.error('❌ SQL ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }

  // ⚠️ Novo filtro aqui: só exibe se há valor planejado > 0 e ultrapassado
  const estouradas = rows.filter(row => row.planejado > 0 && row.realizado > row.planejado);

  res.json(estouradas);
});
});

router.get('/vencidos', autenticar, (req, res) => {
  const usuarioId = req.user.id;
  const hoje = new Date().toISOString().slice(0, 10); // formato YYYY-MM-DD

  const sql = `
    SELECT l.*, c.nome AS categoria, s.nome AS subcategoria
    FROM lancamentos l
    LEFT JOIN categorias c ON c.id = l.categoria_id
    LEFT JOIN subcategorias s ON s.id = l.subcategoria_id
    WHERE l.usuario_id = ?
      AND l.status = 'pendente'
      AND l.data_vencimento IS NOT NULL
      AND l.data_vencimento < ?
    ORDER BY l.data_vencimento ASC
  `;

  db.all(sql, [usuarioId, hoje], (err, rows) => {
    if (err) {
      console.error('❌ Erro ao buscar lançamentos vencidos:', err.message);
      return res.status(500).json({ error: err.message });
    }

    res.json(rows);
  });
});

module.exports = router;
