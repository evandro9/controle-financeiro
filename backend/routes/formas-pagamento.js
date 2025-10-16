const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth');

// Listar todas (padrão + do usuário), incluindo status de ocultação
router.get('/', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const query = `
      SELECT f.id, f.nome, f.usuario_id, f.dia_vencimento, f.dia_fechamento,
             CASE WHEN o.forma_pagamento_id IS NOT NULL THEN 1 ELSE 0 END AS oculta
        FROM formas_pagamento f
        LEFT JOIN formas_pagamento_ocultas o
          ON o.forma_pagamento_id = f.id AND o.usuario_id = $1
       WHERE f.usuario_id = $2 OR f.usuario_id IS NULL
       ORDER BY f.nome
    `;
    const { rows } = await db.query(query, [usuarioId, usuarioId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar nova forma de pagamento
router.post('/', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { nome, dia_vencimento, dia_fechamento } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    // normaliza/valida o dia (1..31 ou null)
    const diaV = (dia_vencimento === '' || dia_vencimento == null) ? null : Number(dia_vencimento);
    if (diaV !== null && !(diaV >= 1 && diaV <= 31)) {
      return res.status(400).json({ error: 'dia_vencimento deve ser 1..31 ou nulo' });
    }
    const diaF = (dia_fechamento === '' || dia_fechamento == null) ? null : Number(dia_fechamento);
    if (diaF !== null && !(diaF >= 1 && diaF <= 31)) {
      return res.status(400).json({ error: 'dia_fechamento deve ser 1..31 ou nulo' });
    }

    const { rows } = await db.query(
      `INSERT INTO formas_pagamento (nome, usuario_id, dia_vencimento, dia_fechamento)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, usuario_id, dia_vencimento, dia_fechamento`,
      [nome, usuarioId, diaV, diaF]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar forma de pagamento
router.put('/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    const { nome, dia_vencimento, dia_fechamento } = req.body;

    const { rows: found } = await db.query('SELECT usuario_id FROM formas_pagamento WHERE id = $1', [id]);
    const forma = found[0];
    if (!forma) return res.status(404).json({ error: 'Forma não encontrada' });
    if (forma.usuario_id === null || Number(forma.usuario_id) !== Number(usuarioId)) {
      return res.status(403).json({ error: 'Você não pode editar esta forma' });
    }

    const diaV = (dia_vencimento === '' || dia_vencimento == null) ? null : Number(dia_vencimento);
    if (diaV !== null && !(diaV >= 1 && diaV <= 31)) {
      return res.status(400).json({ error: 'dia_vencimento deve ser 1..31 ou nulo' });
    }
    const diaF = (dia_fechamento === '' || dia_fechamento == null) ? null : Number(dia_fechamento);
    if (diaF !== null && !(diaF >= 1 && diaF <= 31)) {
      return res.status(400).json({ error: 'dia_fechamento deve ser 1..31 ou nulo' });
    }

    const { rows } = await db.query(
      `UPDATE formas_pagamento
          SET nome = $1, dia_vencimento = $2, dia_fechamento = $3
        WHERE id = $4
      RETURNING id, nome, dia_vencimento, dia_fechamento`,
      [nome, diaV, diaF, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir forma de pagamento
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;

    const { rows: found } = await db.query('SELECT usuario_id FROM formas_pagamento WHERE id = $1', [id]);
    const forma = found[0];
    if (!forma) return res.status(404).json({ error: 'Forma não encontrada' });
    if (forma.usuario_id === null || Number(forma.usuario_id) !== Number(usuarioId)) {
      return res.status(403).json({ error: 'Você não pode excluir esta forma' });
    }

    await db.query('DELETE FROM formas_pagamento WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ocultar forma padrão
router.post('/ocultar/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    await db.query(
      `INSERT INTO formas_pagamento_ocultas (usuario_id, forma_pagamento_id)
         SELECT $1, $2
          WHERE NOT EXISTS (
            SELECT 1 FROM formas_pagamento_ocultas
             WHERE usuario_id = $1 AND forma_pagamento_id = $2
          )`,
      [usuarioId, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reexibir forma padrão
router.delete('/ocultar/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    await db.query(
      'DELETE FROM formas_pagamento_ocultas WHERE usuario_id = $1 AND forma_pagamento_id = $2',
      [usuarioId, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;