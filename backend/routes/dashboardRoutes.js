const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// Helper para usar sqlite3 com Promises
function runGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function runAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

// GET /dashboard/resumo?ano=2025&mes=7&forma_pagamento_id=ALL&limitUltimos=10
router.get('/resumo', auth, async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const ano = String(req.query.ano || new Date().getFullYear());
    const mes = String(req.query.mes || (new Date().getMonth() + 1)).padStart(2, '0');
    const formaPgtoId = req.query.forma_pagamento_id; // número ou 'ALL'/'todas'
    const limitUltimos = parseInt(req.query.limitUltimos || '10', 10);

    // WHERE base (padronizando ano/mês com strftime)
    const whereBase = [
      'l.usuario_id = ?',
      "SUBSTRING(l.data_lancamento,1,4) = ?",
      "SUBSTRING(l.data_lancamento,6,2) = ?"
    ];
    const paramsBase = [usuarioId, ano, mes];

    if (formaPgtoId && formaPgtoId !== 'ALL' && formaPgtoId !== 'todas') {
      whereBase.push('l.forma_pagamento_id = ?');
      paramsBase.push(formaPgtoId);
    }

    // 1) Totais do mês
    const receitasMesRow = await runGet(
      `SELECT COALESCE(SUM(l.valor),0) AS total
       FROM lancamentos l
       WHERE ${whereBase.join(' AND ')} AND l.tipo = 'receita'`,
      paramsBase
    );
    const despesasMesRow = await runGet(
      `SELECT COALESCE(SUM(l.valor),0) AS total
       FROM lancamentos l
       WHERE ${whereBase.join(' AND ')} AND l.tipo = 'despesa'`,
      paramsBase
    );

    const receitasMes = Number(receitasMesRow?.total || 0);
    const despesasMes = Number(despesasMesRow?.total || 0);
    const saldoMes = receitasMes - despesasMes;

    // 2) Gastos por categoria (para gráfico 3)
    const gastosPorCategoria = await runAll(
      `SELECT c.nome AS categoria, COALESCE(SUM(l.valor),0) AS total
       FROM lancamentos l
       LEFT JOIN categorias c ON c.id = l.categoria_id
       WHERE ${whereBase.join(' AND ')} AND l.tipo = 'despesa'
       GROUP BY c.nome
       ORDER BY total DESC`,
      paramsBase
    );

    // 3) Planejado x Realizado (para gráfico 2)
const planejadoVsRealizado = await runAll(
  `SELECT 
     c.nome AS categoria,
     COALESCE(MAX(p.valor_planejado), 0)      AS planejado,
     COALESCE(MAX(r.realizado), 0)            AS realizado
   FROM categorias c
   LEFT JOIN (
     SELECT categoria_id, SUM(valor) AS realizado
     FROM lancamentos l
     WHERE l.usuario_id = ?
       AND SUBSTRING(l.data_lancamento,1,4) = ?
       AND SUBSTRING(l.data_lancamento,6,2) = ?
       AND l.tipo='despesa'
     GROUP BY categoria_id
   ) r ON r.categoria_id = c.id
   LEFT JOIN planejamentos p 
     ON p.categoria_id = c.id 
    AND p.ano = ? 
    AND p.mes = ?
    AND p.usuario_id = ?
   WHERE (c.usuario_id = ? OR c.usuario_id IS NULL)
   GROUP BY c.id, c.nome
   ORDER BY COALESCE(MAX(r.realizado),0) DESC`,
  [usuarioId, ano, mes, ano, mes, usuarioId, usuarioId]
);

    // 4) Gastos por forma de pagamento (para gráfico 4)
    const gastosPorFormaPgto = await runAll(
      `SELECT fp.nome AS forma, COALESCE(SUM(l.valor),0) AS total
       FROM lancamentos l
       LEFT JOIN formas_pagamento fp ON fp.id = l.forma_pagamento_id
       WHERE ${whereBase.join(' AND ')} AND l.tipo='despesa'
       GROUP BY fp.nome
       ORDER BY total DESC`,
      paramsBase
    );

    // 5) PENDENTES do mês e VENCIDOS (status = 'pendente')
    const whereVencBase = [
      'l.usuario_id = ?',
      "SUBSTRING(l.data_vencimento,1,4) = ?",
      "SUBSTRING(l.data_vencimento,6,2) = ?",
      "l.status = 'pendente'"
    ];
    const paramsVencBase = [usuarioId, ano, mes];
    if (formaPgtoId && formaPgtoId !== 'ALL' && formaPgtoId !== 'todas') {
      whereVencBase.push('l.forma_pagamento_id = ?');
      paramsVencBase.push(formaPgtoId);
    }

    const pendentesMesRow = await runGet(
      `SELECT COALESCE(SUM(l.valor),0) AS total
       FROM lancamentos l
       WHERE ${whereVencBase.join(' AND ')}`,
      paramsVencBase
    );

    const hojeISO = new Date().toISOString().slice(0,10); // YYYY-MM-DD
    const vencidosParams = [usuarioId, hojeISO];
    let vencidosWhere = `l.usuario_id = ? AND l.status='pendente' AND l.data_vencimento < ?`;
    if (formaPgtoId && formaPgtoId !== 'ALL' && formaPgtoId !== 'todas') {
      vencidosWhere += ' AND l.forma_pagamento_id = ?';
      vencidosParams.push(formaPgtoId);
    }
    const vencidosRow = await runGet(
      `SELECT COALESCE(SUM(l.valor),0) AS total
       FROM lancamentos l
       WHERE ${vencidosWhere}`,
      vencidosParams
    );

// 6) Aportes em planos no mês
let aportesPlanosMes = 0;
const rowAportes = await runGet(
  `SELECT COALESCE(SUM(pm.valor),0) AS total
   FROM planos_movimentos pm
   WHERE pm.usuario_id = ?
     AND pm.tipo = 'aporte'
     AND SUBSTRING(pm.data,1,4) = ?
     AND SUBSTRING(pm.data,6,2) = ?`,
  [usuarioId, ano, mes] // mes já está '01'..'12'
);
aportesPlanosMes = Number(rowAportes?.total || 0);

// 7) Últimos lançamentos (compatível com seu schema)
const ultimosLancamentos = await runAll(
  `SELECT 
      l.id,
      l.tipo,
      COALESCE(l.observacao, '') AS descricao,   -- <- aqui, no lugar de l.descricao
      l.valor,
      l.data_lancamento,
      c.nome AS categoria,
      sc.nome AS subcategoria,
      fp.nome AS forma_pagamento
   FROM lancamentos l
   LEFT JOIN categorias c   ON c.id  = l.categoria_id
   LEFT JOIN subcategorias sc ON sc.id = l.subcategoria_id
   LEFT JOIN formas_pagamento fp ON fp.id = l.forma_pagamento_id
   WHERE l.usuario_id = ?
   ORDER BY l.data_lancamento DESC, l.id DESC
   LIMIT ?`,
  [usuarioId, limitUltimos]
);

    res.json({
      filtros: { ano, mes, forma_pagamento_id: formaPgtoId || 'ALL' },
      receitasMes,
      despesasMes,
      saldoMes,
      aportesPlanosMes,
      pendentesMes: Number(pendentesMesRow?.total || 0),
      vencidos: Number(vencidosRow?.total || 0),
      gastosPorCategoria,
      planejadoVsRealizado,
      gastosPorFormaPgto,
      ultimosLancamentos
    });

  } catch (err) {
    console.error('Erro /dashboard/resumo:', err);
    res.status(500).json({ error: 'Erro ao montar resumo do dashboard' });
  }
});

module.exports = router;