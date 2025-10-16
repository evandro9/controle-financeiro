const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth');

// Listar categorias visíveis (padrão + do usuário, exceto ocultas)
router.get('/', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const query = `
      SELECT c.id, c.nome, c.usuario_id, 0 AS oculta
        FROM categorias c
       WHERE (c.usuario_id IS NULL OR c.usuario_id = $1)
         AND c.id NOT IN (
               SELECT categoria_id FROM categorias_ocultas WHERE usuario_id = $2
             )
       ORDER BY c.nome
    `;
    const { rows } = await db.query(query, [usuarioId, usuarioId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// Criar nova categoria do usuário
router.post('/', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { rows } = await db.query(
      'INSERT INTO categorias (nome, usuario_id) VALUES ($1, $2) RETURNING id, nome, usuario_id',
      [nome, usuarioId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// Editar categoria do usuário (não permite editar categorias padrão)
router.put('/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    const { nome } = req.body;
    const { rows: found } = await db.query('SELECT usuario_id FROM categorias WHERE id = $1', [id]);
    const cat = found[0];
    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
    if (cat.usuario_id !== usuarioId) return res.status(403).json({ error: 'Categoria padrão não pode ser editada' });
    const { rows } = await db.query(
      'UPDATE categorias SET nome = $1 WHERE id = $2 RETURNING id, nome',
      [nome, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// Excluir categoria do usuário
router.delete('/:id', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    const { rows: found } = await db.query('SELECT usuario_id FROM categorias WHERE id = $1', [id]);
    const cat = found[0];
    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
    if (cat.usuario_id !== usuarioId) return res.status(403).json({ error: 'Categoria padrão não pode ser excluída' });
    await db.query('DELETE FROM categorias WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir categoria' });
  }
});

// Ocultar categoria padrão
router.post('/ocultar/:id', autenticar, async (req, res) => {
  const usuarioId = req.user.id;
  const { id } = req.params;
  try {
    await db.query('BEGIN');
    await db.query(
      `INSERT INTO categorias_ocultas (usuario_id, categoria_id)
       SELECT $1, $2
        WHERE NOT EXISTS (
          SELECT 1 FROM categorias_ocultas WHERE usuario_id = $1 AND categoria_id = $2
        )`,
      [usuarioId, id]
    );
    await db.query(
      `INSERT INTO subcategorias_ocultas (usuario_id, subcategoria_id)
         SELECT $1, s.id
           FROM subcategorias s
          WHERE s.categoria_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM subcategorias_ocultas so
               WHERE so.usuario_id = $1 AND so.subcategoria_id = s.id
            )`,
      [usuarioId, id]
    );
    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao ocultar categoria' });
  }
});

// Reexibir categoria padrão
router.delete('/ocultar/:id', autenticar, async (req, res) => {
  const usuarioId = req.user.id;
  const { id } = req.params;
  try {
    await db.query('BEGIN');
    await db.query(
      'DELETE FROM categorias_ocultas WHERE usuario_id = $1 AND categoria_id = $2',
      [usuarioId, id]
    );
    await db.query(
      `DELETE FROM subcategorias_ocultas 
        WHERE usuario_id = $1 
          AND subcategoria_id IN (SELECT id FROM subcategorias WHERE categoria_id = $2)`,
      [usuarioId, id]
    );
    await db.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao reexibir categoria' });
  }
});

// Listar subcategorias visíveis de uma categoria (padrão + do usuário, exceto ocultas)
router.get('/:id/subcategorias', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const categoriaId = req.params.id;
    const sql = `
      SELECT s.id, s.nome, s.usuario_id
        FROM subcategorias s
       WHERE s.categoria_id = $1
         AND (s.usuario_id IS NULL OR s.usuario_id = $2)
         AND s.id NOT IN (
               SELECT subcategoria_id FROM subcategorias_ocultas WHERE usuario_id = $3
             )
       ORDER BY LOWER(s.nome)
    `;
    const { rows } = await db.query(sql, [categoriaId, usuarioId, usuarioId]);
    res.json({ subcategorias: rows });
  } catch (err) {
    console.error('Erro ao buscar subcategorias:', err);
    res.status(500).json({ error: 'Erro ao buscar subcategorias' });
  }
});

module.exports = router;