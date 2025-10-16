const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth');

// Retorna categorias com suas subcategorias visíveis (considerando categorias padrão + do usuário)
router.get('/', autenticar, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const query = `
      SELECT
        c.id   AS categoria_id,
        c.nome AS categoria_nome,
        c.usuario_id AS categoria_usuario_id,
        CASE WHEN co.categoria_id IS NOT NULL THEN 1 ELSE 0 END AS categoria_oculta,
        s.id   AS subcategoria_id,
        s.nome AS subcategoria_nome,
        s.usuario_id AS subcategoria_usuario_id,
        CASE WHEN so.subcategoria_id IS NOT NULL THEN 1 ELSE 0 END AS subcategoria_oculta
      FROM categorias c
      LEFT JOIN categorias_ocultas co
        ON co.categoria_id = c.id AND co.usuario_id = $1
      LEFT JOIN subcategorias s
        ON s.categoria_id = c.id
      LEFT JOIN subcategorias_ocultas so
        ON so.subcategoria_id = s.id AND so.usuario_id = $2
      WHERE c.usuario_id IS NULL OR c.usuario_id = $3
      ORDER BY c.nome, s.nome
    `;
    const { rows } = await db.query(query, [usuarioId, usuarioId, usuarioId]);

    const categoriasMap = {};
    rows.forEach(row => {
      const catId = row.categoria_id;
      if (!categoriasMap[catId]) {
        categoriasMap[catId] = {
          id: catId,
          nome: row.categoria_nome,
          usuario_id: row.categoria_usuario_id,
          oculta: !!row.categoria_oculta,
          subcategorias: []
        };
      }
      if (row.subcategoria_id) {
        categoriasMap[catId].subcategorias.push({
          id: row.subcategoria_id,
          nome: row.subcategoria_nome,
          usuario_id: row.subcategoria_usuario_id,
          oculta: !!row.subcategoria_oculta
        });
      }
    });
    res.json(Object.values(categoriasMap));
  } catch (err) {
    console.error('❌ ERRO NO SQL de categoriasComSub:', err.message);
    res.status(500).json({ error: 'Erro ao buscar categorias e subcategorias' });
  }
});

module.exports = router;