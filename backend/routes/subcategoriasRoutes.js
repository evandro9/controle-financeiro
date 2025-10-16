const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth');

// Criar nova subcategoria do usuário
router.post('/', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { nome, categoria_id } = req.body;
    if (!nome || !categoria_id) {
      return res.status(400).json({ error: 'Nome e categoria_id são obrigatórios' });
    }
    const { rows } = await db.query(
      'INSERT INTO subcategorias (nome, categoria_id, usuario_id) VALUES ($1, $2, $3) RETURNING id, nome, categoria_id, usuario_id',
      [nome, categoria_id, usuarioId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar subcategoria' });
  }
});

// Editar subcategoria do usuário
router.put('/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = Number(req.user.id);
    const { id } = req.params;
    const { nome, categoria_id } = req.body;

    const { rows: found } = await db.query('SELECT usuario_id FROM subcategorias WHERE id = $1', [id]);
    const sub = found[0];
    if (!sub) return res.status(404).json({ error: 'Subcategoria não encontrada' });
    if (sub.usuario_id === null || Number(sub.usuario_id) !== usuarioId) {
      return res.status(403).json({ error: 'Subcategoria padrão não pode ser editada' });
    }

    const { rows } = await db.query(
      'UPDATE subcategorias SET nome = $1, categoria_id = $2 WHERE id = $3 RETURNING id, nome, categoria_id',
      [nome, categoria_id, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar subcategoria' });
  }
});

// Excluir subcategoria do usuário
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = Number(req.user.id);
    const { id } = req.params;

    const { rows: found } = await db.query('SELECT usuario_id FROM subcategorias WHERE id = $1', [id]);
    const sub = found[0];
    if (!sub) return res.status(404).json({ error: 'Subcategoria não encontrada' });
    if (sub.usuario_id === null || Number(sub.usuario_id) !== usuarioId) {
      return res.status(403).json({ error: 'Subcategoria padrão não pode ser excluída' });
    }

    await db.query('DELETE FROM subcategorias WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir subcategoria' });
  }
});

// Ocultar subcategoria padrão
router.post('/ocultar/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    await db.query(
      `INSERT INTO subcategorias_ocultas (usuario_id, subcategoria_id)
         SELECT $1, $2
          WHERE NOT EXISTS (
            SELECT 1 FROM subcategorias_ocultas WHERE usuario_id = $1 AND subcategoria_id = $2
          )`,
      [usuarioId, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ocultar subcategoria' });
  }
});

// Reexibir subcategoria padrão
router.delete('/ocultar/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    await db.query(
      'DELETE FROM subcategorias_ocultas WHERE usuario_id = $1 AND subcategoria_id = $2',
      [usuarioId, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao reexibir subcategoria' });
  }
});

module.exports = router;