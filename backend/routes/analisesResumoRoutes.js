// routes/analisesResumoRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

router.get('/analises/tabela-resumo', auth, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { ano, mesInicio, mesFim } = req.query;
    const inicio = parseInt(mesInicio, 10);
    const fim = parseInt(mesFim, 10);

    if (!ano || !inicio || !fim) {
      return res.status(400).json({ error: 'Parâmetros ano, mesInicio e mesFim são obrigatórios.' });
    }

    // SUM por mês (mes_1..mes_12) dinamicamente
    const colunasMeses = Array.from({ length: fim - inicio + 1 }, (_, i) => {
      const m = inicio + i;
      return `SUM(CASE WHEN EXTRACT(MONTH FROM l.data_lancamento::date) = ${m} THEN l.valor ELSE 0 END) AS mes_${m}`;
    }).join(',\n');

    const sql = `
      SELECT 
        c.nome AS categoria,
        s.nome AS subcategoria,
        ${colunasMeses}
      FROM lancamentos l
      JOIN categorias    c ON c.id = l.categoria_id
      JOIN subcategorias s ON s.id = l.subcategoria_id
      WHERE l.usuario_id = $1
        AND EXTRACT(YEAR  FROM l.data_lancamento::date) = $2
        AND EXTRACT(MONTH FROM l.data_lancamento::date) BETWEEN $3 AND $4
        AND l.tipo = 'despesa'
      GROUP BY c.nome, s.nome
      ORDER BY c.nome, s.nome
    `;

    const r = await db.query(sql, [usuarioId, parseInt(ano, 10), inicio, fim]);
    res.json(r.rows);
  } catch (err) {
    console.error('[/analises/tabela-resumo] erro:', err);
    res.status(500).json({ error: 'Erro ao buscar tabela resumo' });
  }
});

module.exports = router;