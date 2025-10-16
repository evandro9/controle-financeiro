// routes/analisesRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// 1) Despesas por categoria ao longo dos meses
router.get('/despesas-por-categoria', auth, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const ano       = parseInt(req.query.ano, 10);
    const mesInicio = parseInt(req.query.mesInicio, 10);
    const mesFim    = parseInt(req.query.mesFim, 10);
    const categoria = req.query.categoria; // opcional

    if (!ano || !mesInicio || !mesFim) {
      return res.status(400).json({ error: 'Parâmetros ano, mesInicio e mesFim são obrigatórios.' });
    }

    let sql = `
      SELECT 
        TO_CHAR(l.data_lancamento::date, 'MM') AS mes,
        c.nome AS categoria,
        SUM(l.valor) AS total
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1
        AND EXTRACT(YEAR  FROM l.data_lancamento::date) = $2
        AND EXTRACT(MONTH FROM l.data_lancamento::date) BETWEEN $3 AND $4
        AND l.tipo = 'despesa'
    `;
    const params = [usuarioId, ano, mesInicio, mesFim];

    if (categoria && categoria.trim()) {
      sql += ` AND c.nome ILIKE $5`;
      params.push(`%${categoria}%`);
    }

    sql += ` GROUP BY mes, c.nome ORDER BY mes, c.nome`;

    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    console.error('[/analises/despesas-por-categoria] erro:', err);
    res.status(500).send('Erro ao buscar despesas por categoria');
  }
});

// 2) Despesas por subcategoria (com filtro opcional por categoria)
router.get('/despesas-por-subcategoria', auth, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const ano       = parseInt(req.query.ano, 10);
    const mesInicio = parseInt(req.query.mesInicio, 10);
    const mesFim    = parseInt(req.query.mesFim, 10);
    const categoria = req.query.categoria;

    if (!ano || !mesInicio || !mesFim) {
      return res.status(400).json({ error: 'Parâmetros ano, mesInicio e mesFim são obrigatórios.' });
    }

    let sql = `
      SELECT 
        s.nome AS subcategoria,
        SUM(l.valor) AS total
      FROM lancamentos l
      JOIN subcategorias s ON s.id = l.subcategoria_id
      JOIN categorias    c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1
        AND EXTRACT(YEAR  FROM l.data_lancamento::date) = $2
        AND EXTRACT(MONTH FROM l.data_lancamento::date) BETWEEN $3 AND $4
        AND l.tipo = 'despesa'
    `;
    const params = [usuarioId, ano, mesInicio, mesFim];

    if (categoria && categoria.trim()) {
      sql += ` AND c.nome ILIKE $5`;
      params.push(`%${categoria}%`);
    }

    sql += ` GROUP BY s.nome ORDER BY total DESC`;

    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    console.error('[/analises/despesas-por-subcategoria] erro:', err);
    res.status(500).send('Erro ao buscar despesas por subcategoria');
  }
});

// 3) Distribuição total por categoria (pizza/barras)
router.get('/distribuicao-total', auth, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const ano       = parseInt(req.query.ano, 10);
    const mesInicio = parseInt(req.query.mesInicio, 10);
    const mesFim    = parseInt(req.query.mesFim, 10);
    const categoria = req.query.categoria;

    if (!ano || !mesInicio || !mesFim) {
      return res.status(400).json({ error: 'Parâmetros ano, mesInicio e mesFim são obrigatórios.' });
    }

    let sql = `
      SELECT 
        c.nome AS categoria,
        SUM(l.valor) AS total
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1
        AND EXTRACT(YEAR  FROM l.data_lancamento::date) = $2
        AND EXTRACT(MONTH FROM l.data_lancamento::date) BETWEEN $3 AND $4
        AND l.tipo = 'despesa'
    `;
    const params = [usuarioId, ano, mesInicio, mesFim];

    if (categoria && categoria.trim()) {
      sql += ` AND c.nome ILIKE $5`;
      params.push(`%${categoria}%`);
    }

    sql += ` GROUP BY c.nome ORDER BY total DESC`;

    const r = await db.query(sql, params);
    res.json(r.rows);
  } catch (err) {
    console.error('[/analises/distribuicao-total] erro:', err);
    res.status(500).send('Erro ao buscar distribuicao total');
  }
});

module.exports = router;