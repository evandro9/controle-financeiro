// routes/planosDashboardRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');        // ajuste o caminho do seu db
const auth = require('../middleware/auth');  // ajuste o caminho do seu auth

// GET /planos-dashboard/mensal?ano=2025
  router.get('/mensal', auth, (req, res) => {
    const ano = String(req.query.ano || new Date().getFullYear());
    const usuarioId = req.user.id;

    // Gera a série do ano todo (01..12) com 0 quando não houver lançamentos
    const sql = `
      WITH mov AS (
        SELECT
          substr(pm.data, 6, 2) AS mes,
          SUM(CASE WHEN lower(trim(pm.tipo)) = 'aporte'
                   THEN CAST(pm.valor AS DECIMAL)
                   ELSE 0 END) AS aporte,
          SUM(CASE WHEN lower(trim(pm.tipo)) = 'retirada'
                   THEN CAST(pm.valor AS DECIMAL)
                   ELSE 0 END) AS retirada
        FROM planos_movimentos pm
        JOIN planos p ON p.id = pm.plano_id
        WHERE pm.usuario_id = ?
          AND substr(pm.data, 1, 4) = ?
        GROUP BY mes
      )
      SELECT
        (CASE WHEN n < 10 THEN '0' || n ELSE CAST(n AS TEXT) END) AS mes,
        COALESCE(mov.aporte, 0)   AS aporte,
        COALESCE(mov.retirada, 0) AS retirada,
        (COALESCE(mov.aporte, 0) - COALESCE(mov.retirada, 0)) AS liquido
      FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12)) AS meses(n)
      LEFT JOIN mov
        ON mov.mes = (CASE WHEN n < 10 THEN '0' || n ELSE CAST(n AS TEXT) END)
      ORDER BY n;
    `;

    db.all(sql, [usuarioId, ano], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // opcional: acumulado ao longo do ano
      let acum = 0;
      const serie = rows.map(r => {
        acum += (r.liquido || 0);
        return { ...r, acumulado: acum };
      });

      res.json(serie);
    });
  });

module.exports = router;