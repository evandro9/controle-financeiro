const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// 📌 GET /planos – listar planos do usuário
router.get('/', auth, (req, res) => {
  const usuarioId = req.user.id;
  console.log('🌐 [GET /planos] Iniciado. Usuario ID:', usuarioId);

  db.all(`SELECT * FROM planos WHERE usuario_id = ?`, [usuarioId], (err, rows) => {
    if (err) {
      console.error('🔥 ERRO ao buscar planos:', err);
      return res.status(500).json({ error: 'Erro ao buscar planos' });
    }

    console.log('📦 Planos retornados corretamente:', rows);
    res.json(rows);
  });
});

// 📌 POST /planos – criar novo plano
router.post('/', auth, (req, res) => {
  const usuarioId = req.user.id;
  const {
    nome, inicio, fim, parcelas, usar_parcelas,
    valor_total, valor_parcela, usar_parcela,
    arrecadado, status, icone
  } = req.body;

  const sql = `
    INSERT INTO planos (
      usuario_id, nome, inicio, fim, parcelas, usar_parcelas,
      valor_total, valor_parcela, usar_parcela,
      arrecadado, status, icone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    usuarioId, nome, inicio, fim, parcelas, usar_parcelas ? 1 : 0,
    valor_total, valor_parcela, usar_parcela ? 1 : 0,
    arrecadado, status || 'ativo', icone || 'PiggyBank'
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error('🔥 ERRO AO INSERIR PLANO:', err);
      return res.status(500).json({ error: 'Erro ao criar plano' });
    }

    const insertedId = this.lastID;
    console.log('🆕 Plano inserido com ID:', insertedId);

    db.get(`SELECT * FROM planos WHERE id = ?`, [insertedId], (err, row) => {
      if (err) {
        console.error('❌ Erro ao buscar plano recém-inserido:', err);
        return res.status(500).json({ error: 'Erro ao buscar novo plano' });
      }

      console.log('🔍 Novo plano criado:', row);
      res.json(row);
    });
  });
});

// 📌 PUT /planos/:id – atualizar plano
router.put('/:id', auth, (req, res) => {
  const usuarioId = req.user.id;
  const planoId = req.params.id;
  const {
    nome, inicio, fim, parcelas, usar_parcelas,
    valor_total, valor_parcela, usar_parcela,
    arrecadado, status, icone
  } = req.body;

  const sql = `
    UPDATE planos SET
      nome = ?, inicio = ?, fim = ?, parcelas = ?, usar_parcelas = ?,
      valor_total = ?, valor_parcela = ?, usar_parcela = ?,
      arrecadado = ?, status = ?, icone = ?, atualizado_em = CURRENT_TIMESTAMP
    WHERE id = ? AND usuario_id = ?
  `;

  const params = [
    nome, inicio, fim, parcelas, usar_parcelas ? 1 : 0,
    valor_total, valor_parcela, usar_parcela ? 1 : 0,
    arrecadado, status || 'ativo', icone || 'PiggyBank',
    planoId, usuarioId
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error('❌ Erro ao atualizar plano:', err);
      return res.status(500).json({ error: 'Erro ao atualizar plano' });
    }

    db.get(`SELECT * FROM planos WHERE id = ? AND usuario_id = ?`, [planoId, usuarioId], (err, row) => {
      if (err) {
        console.error('❌ Erro ao buscar plano atualizado:', err);
        return res.status(500).json({ error: 'Erro ao buscar plano atualizado' });
      }

      res.json(row);
    });
  });
});

// 📌 DELETE /planos/:id – excluir plano
// routes/planos.js
router.delete('/:id', auth, (req, res) => {
  const planoId = req.params.id;
  const usuarioId = req.user.id;

   db.serialize(async () => {
  try {
    db.run('BEGIN');

    // 1) Apagar lançamentos vinculados aos movimentos deste plano
    await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM lancamentos
           WHERE usuario_id = ?
             AND id IN (
               SELECT lancamento_id
                 FROM planos_movimentos
                WHERE usuario_id = ?
                  AND plano_id = ?
                  AND lancamento_id IS NOT NULL
             )`,
        [usuarioId, usuarioId, planoId],
        function (e) { return e ? reject(e) : resolve(); }
      );
    });

    // 2) Apagar movimentos do plano
    await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM planos_movimentos
           WHERE usuario_id = ? AND plano_id = ?`,
        [usuarioId, planoId],
        function (e) { return e ? reject(e) : resolve(); }
      );
    });

    // 3) Apagar o plano
    await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM planos
           WHERE usuario_id = ? AND id = ?`,
        [usuarioId, planoId],
        function (e) { return e ? reject(e) : resolve(); }
      );
    });

    db.run('COMMIT');
    res.json({ success: true });
  } catch (e) {
    db.run('ROLLBACK');
    res.status(500).json({ error: e.message });
  }
});
});

// 📌 PATCH /planos/:id/status – alternar status
router.patch('/:id/status', auth, (req, res) => {
  const usuarioId = req.user.id;
  const planoId = req.params.id;

  db.get(`SELECT * FROM planos WHERE id = ? AND usuario_id = ?`, [planoId, usuarioId], (err, plano) => {
    if (err || !plano) {
      console.error('❌ Erro ao buscar plano para alternar status:', err);
      return res.status(500).json({ error: 'Plano não encontrado ou erro ao buscar' });
    }

    const novoStatus = plano.status === 'ativo' ? 'inativo' : 'ativo';

    db.run(`
      UPDATE planos SET status = ?, atualizado_em = CURRENT_TIMESTAMP
      WHERE id = ? AND usuario_id = ?
    `, [novoStatus, planoId, usuarioId], function (err) {
      if (err) {
        console.error('❌ Erro ao atualizar status do plano:', err);
        return res.status(500).json({ error: 'Erro ao atualizar status do plano' });
      }

      db.get(`SELECT * FROM planos WHERE id = ?`, [planoId], (err, atualizado) => {
        if (err) {
          console.error('❌ Erro ao buscar plano atualizado:', err);
          return res.status(500).json({ error: 'Erro ao buscar plano atualizado' });
        }

        res.json(atualizado);
      });
    });
  });
});

module.exports = router;