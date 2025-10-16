const express = require('express');
const router = express.Router();
const db = require('../database/db'); // deve ser um Pool do pg
const auth = require('../middleware/auth');

// -----------------------------
// Helpers
// -----------------------------
const parseBRLtoNumber = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return 0;
  return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
};

const withTx = async (fn) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
};

const columnExists = async (client, table, column) => {
  const q = `
    SELECT 1
      FROM information_schema.columns
     WHERE table_name = $1
       AND column_name = $2
     LIMIT 1
  `;
  const r = await client.query(q, [table, column]);
  return r.rowCount > 0;
};

// Cria (se não existir) categoria/subcategorias/formapagto globais (usuario_id IS NULL)
const ensurePadroesPlanos = async (client, usuarioId) => {
  // Categoria "Planos"
  let cat = await client.query(
    `SELECT id FROM categorias WHERE usuario_id IS NULL AND LOWER(BTRIM(nome)) = LOWER(BTRIM($1)) LIMIT 1`,
    ['Planos']
  );
  let categoriaId;
  if (cat.rowCount === 0) {
    const ins = await client.query(
      `INSERT INTO categorias (usuario_id, nome) VALUES (NULL, $1) RETURNING id`,
      ['Planos']
    );
    categoriaId = ins.rows[0].id;
  } else {
    categoriaId = cat.rows[0].id;
  }

  // Sub "Aportes"
  let subA = await client.query(
    `SELECT id FROM subcategorias
      WHERE usuario_id IS NULL AND categoria_id = $1 AND LOWER(BTRIM(nome)) = LOWER(BTRIM($2)) LIMIT 1`,
    [categoriaId, 'Aportes']
  );
  let subAporteId;
  if (subA.rowCount === 0) {
    const ins = await client.query(
      `INSERT INTO subcategorias (usuario_id, categoria_id, nome) VALUES (NULL, $1, $2) RETURNING id`,
      [categoriaId, 'Aportes']
    );
    subAporteId = ins.rows[0].id;
  } else {
    subAporteId = subA.rows[0].id;
  }

  // Sub "Retiradas"
  let subR = await client.query(
    `SELECT id FROM subcategorias
      WHERE usuario_id IS NULL AND categoria_id = $1 AND LOWER(BTRIM(nome)) = LOWER(BTRIM($2)) LIMIT 1`,
    [categoriaId, 'Retiradas']
  );
  let subRetiradaId;
  if (subR.rowCount === 0) {
    const ins = await client.query(
      `INSERT INTO subcategorias (usuario_id, categoria_id, nome) VALUES (NULL, $1, $2) RETURNING id`,
      [categoriaId, 'Retiradas']
    );
    subRetiradaId = ins.rows[0].id;
  } else {
    subRetiradaId = subR.rows[0].id;
  }

  // Forma de pagamento "Aportes de Plano"
  let fp = await client.query(
    `SELECT id FROM formas_pagamento WHERE usuario_id IS NULL AND LOWER(BTRIM(nome)) = LOWER(BTRIM($1)) LIMIT 1`,
    ['Aportes de Plano']
  );
  let formaPagamentoId;
  if (fp.rowCount === 0) {
    const ins = await client.query(
      `INSERT INTO formas_pagamento (usuario_id, nome) VALUES (NULL, $1) RETURNING id`,
      ['Aportes de Plano']
    );
    formaPagamentoId = ins.rows[0].id;
  } else {
    formaPagamentoId = fp.rows[0].id;
  }

  return { categoriaId, subAporteId, subRetiradaId, formaPagamentoId };
};

// 📌 POST /planos-movimentos – criar novo movimento (aporte/retirada) + lançamento vinculado
router.post('/', auth, async (req, res) => {
  const usuarioId = req.user.id;
  const { planoId, tipo, valor, data } = req.body;
  const tipoNorm = String(tipo || '').trim().toLowerCase();
  const v = parseBRLtoNumber(valor);
  const dataISO = String(data || '').trim(); // YYYY-MM-DD
  if (!planoId || !['aporte','retirada'].includes(tipoNorm) || !dataISO || !(v > 0)) {
    return res.status(400).json({ error: 'Payload inválido' });
  }

  try {
    const out = await withTx(async (client) => {
      // padrões globais
      const { categoriaId, subAporteId, subRetiradaId, formaPagamentoId } = await ensurePadroesPlanos(client, usuarioId);
      const isAporte = (tipoNorm === 'aporte');
      const lancTipo = isAporte ? 'despesa' : 'receita';
      const subId    = isAporte ? subAporteId : subRetiradaId;

      const plano = await client.query(`SELECT nome FROM planos WHERE id=$1 AND usuario_id=$2`, [planoId, usuarioId]);
      const planoNome = (plano.rows[0]?.nome) || 'Plano';
      const observacao = `${planoNome} - ${isAporte ? 'Aporte' : 'Retirada'}`;

      // detecta coluna forma_pagamento_id
      const hasFpid = await columnExists(client, 'lancamentos', 'forma_pagamento_id');
      let lancId;
      if (hasFpid) {
        const ins = await client.query(
          `INSERT INTO lancamentos
             (tipo, data_lancamento, data_vencimento, valor, categoria_id, subcategoria_id, observacao, usuario_id, forma_pagamento_id, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pago')
           RETURNING id`,
          [lancTipo, dataISO, dataISO, v, categoriaId, subId, observacao, usuarioId, formaPagamentoId]
        );
        lancId = ins.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO lancamentos
             (tipo, data_lancamento, data_vencimento, valor, categoria_id, subcategoria_id, observacao, usuario_id, status, forma_pagamento)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pago',$9)
           RETURNING id`,
          [lancTipo, dataISO, dataISO, v, categoriaId, subId, observacao, usuarioId, 'Aportes de Plano']
        );
        lancId = ins.rows[0].id;
      }

      await client.query(
        `INSERT INTO planos_movimentos (plano_id, usuario_id, tipo, valor, data, lancamento_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [planoId, usuarioId, tipoNorm, v, dataISO, lancId]
      );

      const recalc = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN tipo='aporte' THEN valor ELSE -valor END),0) AS arrec
           FROM planos_movimentos
          WHERE plano_id=$1 AND usuario_id=$2`,
        [planoId, usuarioId]
      );
      const novoArrecadado = Number(recalc.rows[0].arrec || 0);

      await client.query(
        `UPDATE planos
            SET arrecadado=$1, atualizado_em=NOW()
          WHERE id=$2 AND usuario_id=$3`,
        [novoArrecadado, planoId, usuarioId]
      );

      return { lancamento_id: lancId, novoArrecadado };
    });

    res.json({ success: true, ...out });
  } catch (e) {
    console.error('❌ POST /planos-movimentos falhou:', e);
    res.status(500).json({ error: e.message || 'Erro ao salvar movimento', code: e.code });
  }
});

router.get('/evolucao/:id', auth, async (req, res) => {
  const usuarioId = req.user.id;
  const planoId = parseInt(req.params.id, 10);
  try {
    const r = await db.query(
      `SELECT substr(data,1,7) AS mes,
              SUM(CASE WHEN tipo='aporte' THEN valor ELSE -valor END) AS total_mes
         FROM planos_movimentos
        WHERE usuario_id=$1 AND plano_id=$2
        GROUP BY mes
        ORDER BY mes`,
      [usuarioId, planoId]
    );
    let acum = 0;
    const dados = r.rows.map(row => {
      const totalMes = Number(row.total_mes || 0);
      acum += totalMes;
      return { mes: row.mes, arrecadado: Number(acum.toFixed(2)) };
    });
    res.json(dados);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao gerar dados de evolução' });
  }
});

// 📌 DELETE /planos-movimentos/:id – excluir um movimento (aporte ou retirada)
router.delete('/:id', auth, async (req, res) => {
  const usuarioId = req.user.id;
  const movimentoId = parseInt(req.params.id, 10);
  try {
    const out = await withTx(async (client) => {
      const sel = await client.query(
        `SELECT plano_id, lancamento_id
           FROM planos_movimentos
          WHERE id=$1 AND usuario_id=$2`,
        [movimentoId, usuarioId]
      );
      if (sel.rowCount === 0) throw new Error('Movimento não encontrado');
      const { plano_id: planoId, lancamento_id } = sel.rows[0];

      await client.query(`DELETE FROM planos_movimentos WHERE id=$1 AND usuario_id=$2`, [movimentoId, usuarioId]);
      if (lancamento_id) {
        await client.query(`DELETE FROM lancamentos WHERE id=$1 AND usuario_id=$2`, [lancamento_id, usuarioId]);
      }

      const recalc = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN tipo='aporte' THEN valor ELSE -valor END),0) AS arrec
           FROM planos_movimentos
          WHERE plano_id=$1 AND usuario_id=$2`,
        [planoId, usuarioId]
      );
      const novoArrecadado = Number(recalc.rows[0].arrec || 0);
      await client.query(
        `UPDATE planos SET arrecadado=$1 WHERE id=$2 AND usuario_id=$3`,
        [novoArrecadado, planoId, usuarioId]
      );
      return { novoArrecadado };
    });
    res.json({ success: true, ...out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// edita movimento
router.put('/:id', auth, async (req, res) => {
  const usuarioId = req.user.id;
  const movimentoId = parseInt(req.params.id, 10);
  const { tipo, valor, data } = req.body;
  const tipoNorm = String(tipo || '').trim().toLowerCase();
  const v = parseBRLtoNumber(valor);
  const dataISO = String(data || '').trim();
  if (!['aporte','retirada'].includes(tipoNorm) || !(v >= 0) || !dataISO) {
    return res.status(400).json({ error: 'Payload inválido' });
  }

  try {
    const out = await withTx(async (client) => {
      const sel = await client.query(
        `SELECT lancamento_id, plano_id FROM planos_movimentos WHERE id=$1 AND usuario_id=$2`,
        [movimentoId, usuarioId]
      );
      if (sel.rowCount === 0) throw new Error('Movimento não encontrado');
      const { lancamento_id, plano_id } = sel.rows[0];

      await client.query(
        `UPDATE planos_movimentos SET tipo=$1, valor=$2, data=$3 WHERE id=$4 AND usuario_id=$5`,
        [tipoNorm, v, dataISO, movimentoId, usuarioId]
      );

      if (lancamento_id) {
        const { categoriaId, subAporteId, subRetiradaId, formaPagamentoId } = await ensurePadroesPlanos(client, usuarioId);
        const isAporte = (tipoNorm === 'aporte');
        const lancTipo = isAporte ? 'despesa' : 'receita';
        const subId    = isAporte ? subAporteId : subRetiradaId;
        const p = await client.query(`SELECT nome FROM planos WHERE id=$1 AND usuario_id=$2`, [plano_id, usuarioId]);
        const observacao = `${p.rows[0]?.nome || 'Plano'} - ${isAporte ? 'Aporte' : 'Retirada'}`;

        const hasFpid = await columnExists(client, 'lancamentos', 'forma_pagamento_id');
        if (hasFpid) {
          await client.query(
            `UPDATE lancamentos
                SET tipo=$1, data_lancamento=$2, data_vencimento=$2, valor=$3,
                    categoria_id=$4, subcategoria_id=$5, observacao=$6, forma_pagamento_id=$7, status='pago'
              WHERE id=$8 AND usuario_id=$9`,
            [lancTipo, dataISO, v, categoriaId, subId, observacao, formaPagamentoId, lancamento_id, usuarioId]
          );
        } else {
          await client.query(
            `UPDATE lancamentos
                SET tipo=$1, data_lancamento=$2, data_vencimento=$2, valor=$3,
                    categoria_id=$4, subcategoria_id=$5, observacao=$6, status='pago', forma_pagamento=$7
              WHERE id=$8 AND usuario_id=$9`,
            [lancTipo, dataISO, v, categoriaId, subId, observacao, 'Aportes de Plano', lancamento_id, usuarioId]
          );
        }
      }

      const recalc = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN tipo='aporte' THEN valor ELSE -valor END),0) AS arrec
           FROM planos_movimentos
          WHERE plano_id=$1 AND usuario_id=$2`,
        [plano_id, usuarioId]
      );
      const novoArrecadado = Number(recalc.rows[0].arrec || 0);
      await client.query(
        `UPDATE planos SET arrecadado=$1, atualizado_em=NOW() WHERE id=$2 AND usuario_id=$3`,
        [novoArrecadado, plano_id, usuarioId]
      );
      return { novoArrecadado };
    });
    res.json({ success: true, ...out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /planos-movimentos/:planoId – buscar movimentos
router.get('/:planoId', auth, async (req, res) => {
  const usuarioId = req.user.id;
  const planoId = parseInt(req.params.planoId, 10);
  try {
   const r = await db.query(
      `SELECT id,
              tipo,
              (valor)::numeric            AS valor,
              (data)::text                AS data
         FROM planos_movimentos
        WHERE plano_id=$1 AND usuario_id=$2
        ORDER BY data DESC
        LIMIT 10`,
      [planoId, usuarioId]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('❌ GET /planos-movimentos/:planoId falhou:', e);
    res.status(500).json({ error: e.message || 'Erro ao buscar movimentos', code: e.code });
  }
});

module.exports = router;