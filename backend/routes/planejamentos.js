const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth');

// POST /planejamentos — cadastrar ou atualizar planejamento por categoria e ano
router.post('/', autenticar, (req, res) => {
  const { categoria_id, ano, mes, valor_planejado, replicarTodosMeses, modo, percentual } = req.body;
  const usuario_id = req.user.id;

  if (!categoria_id || !ano || (!mes && !replicarTodosMeses)) {
    return res.status(400).json({ error: 'Preencha todos os campos' });
  }
  const isPercent = String(modo) === 'percentual';
  if (isPercent) {
    const p = Number(percentual);
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      return res.status(400).json({ error: 'Percentual inválido (0 a 100)' });
    }
  } else {
    if (valor_planejado === undefined || valor_planejado === null) {
      return res.status(400).json({ error: 'Informe o valor planejado' });
    }
  }

function inserirOuAtualizar(mesAlvo, callback) {
  const mesFormatado = mesAlvo.toString().padStart(2, '0');
  const isPercent = String(modo) === 'percentual';
  const val = isPercent ? 0 : Number(valor_planejado) || 0;   // 0 evita NOT NULL
  const perc = isPercent ? Number(percentual) : null;
  const md = isPercent ? 'percentual' : 'fixo';

  // 1) tenta UPDATE
  const sqlUpd = `
    UPDATE planejamentos
       SET valor_planejado = ?, modo = ?, percentual = ?
     WHERE categoria_id = ? AND ano = ? AND mes = ? AND usuario_id = ?
  `;
  db.run(sqlUpd, [val, md, perc, categoria_id, ano, mesFormatado, usuario_id], function (err) {
    if (err) return callback(err);
    if (this.changes > 0) return callback(); // já atualizou, encerra

    // 2) se não existia, faz INSERT
    const sqlIns = `
      INSERT INTO planejamentos (categoria_id, ano, mes, valor_planejado, usuario_id, modo, percentual)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sqlIns, [categoria_id, ano, mesFormatado, val, usuario_id, md, perc], callback);
  });
}

  if (replicarTodosMeses) {
    let count = 0;
    let erroEncontrado = null;
    for (let m = 1; m <= 12; m++) {
      inserirOuAtualizar(m, (err) => {
        if (err && !erroEncontrado) erroEncontrado = err;
        if (++count === 12) {
          if (erroEncontrado) return res.status(500).json({ error: erroEncontrado.message });
          return res.json({ sucesso: true });
        }
      });
    }
  } else {
    inserirOuAtualizar(mes, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ sucesso: true });
    });
  }
});

router.get('/', autenticar, (req, res) => {
  const ano = req.query.ano;
  if (!ano) return res.status(400).json({ error: 'Informe o ano' });

  // 1) receitas por mês (do usuário, no ano)
  const receitasSql = `
    SELECT SUBSTRING(data_lancamento,6,2) AS mes, COALESCE(SUM(valor),0) AS total
    FROM lancamentos
    WHERE tipo = 'receita'
      AND SUBSTRING(data_lancamento,1,4) = ?
      AND usuario_id = ?
    GROUP BY mes
  `;

  db.all(receitasSql, [ano, req.user.id], (err, receitasRows) => {
    if (err) return res.status(500).json({ error: err.message });

    const receitaMes = Array(12).fill(0);
    for (const r of receitasRows || []) {
      const idx = parseInt(r.mes, 10) - 1;
      if (idx >= 0 && idx < 12) receitaMes[idx] = Number(r.total) || 0;
    }

    // 2) planejamentos do ano
    const planSql = `
      SELECT p.*, c.nome AS categoria_nome
      FROM planejamentos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.ano = ? AND p.usuario_id = ?
    `;
    db.all(planSql, [ano, req.user.id], (err2, rows) => {
      if (err2) return res.status(500).json({ error: err2.message });

      const out = (rows || []).map(r => {
        const mIdx = (parseInt(r.mes, 10) || 1) - 1;
        if (String(r.modo) === 'percentual' && r.percentual != null) {
          const perc = Number(r.percentual) / 100;
          const base = receitaMes[mIdx] || 0;
          return { ...r, valor_planejado: +(base * perc).toFixed(2) };
        }
        return r;
      });

      res.json(out);
    });
  });
});

// GET /planejamentos/resumo?ano=2025&mes=7
// GET /planejamentos/resumo?ano=YYYY&mes=M
router.get('/resumo', autenticar, (req, res) => {
  const { ano, mes } = req.query;
  if (!ano || !mes) return res.status(400).json({ error: 'Informe o ano e o mês' });
  const mesFormatado = String(mes).padStart(2, '0');

  // 1) receita total do mês
  const sqlReceitaMes = `
    SELECT COALESCE(SUM(valor),0) AS total
    FROM lancamentos
    WHERE tipo='receita'
      AND SUBSTRING(data_lancamento,1,4)=?
      AND SUBSTRING(data_lancamento,6,2)=?
      AND usuario_id=?
  `;
  db.get(sqlReceitaMes, [ano, mesFormatado, req.user.id], (e1, r1) => {
    if (e1) return res.status(500).json({ error: e1.message });
    const receitaMes = Number(r1?.total) || 0;

    // 2) planejado + realizado por categoria (como já era), mas trazendo modo/percentual
    const sql = `
      SELECT 
        c.nome AS categoria,
        COALESCE(MAX(p.valor_planejado), 0) AS valor_planejado,
        MAX(p.modo)        AS modo,
        MAX(p.percentual)  AS percentual,
        COALESCE(SUM(l.valor), 0) AS valor_realizado
      FROM categorias c
      LEFT JOIN planejamentos p 
        ON p.categoria_id = c.id AND p.ano = ? AND p.mes = ? AND p.usuario_id = ?
      LEFT JOIN lancamentos l 
        ON l.categoria_id = c.id 
        AND l.tipo = 'despesa'
        AND SUBSTRING(l.data_lancamento,1,4) = ?
        AND SUBSTRING(l.data_lancamento,6,2) = ?
        AND l.usuario_id = ?
      GROUP BY c.id, c.nome
      ORDER BY c.nome
    `;
    const params = [ano, mesFormatado, req.user.id, ano, mesFormatado, req.user.id];

    db.all(sql, params, (e2, rows) => {
      if (e2) return res.status(500).json({ error: e2.message });

      const out = (rows || []).map(r => {
        if (String(r.modo) === 'percentual' && r.percentual != null) {
          const v = +(receitaMes * (Number(r.percentual) / 100)).toFixed(2);
          return { ...r, valor_planejado: v };
        }
        return r;
      });

      res.json(out);
    });
  });
});

router.get('/receitas-ano', autenticar, (req, res) => {
  const ano = req.query.ano;
  if (!ano) return res.status(400).json({ error: 'Informe o ano' });

  const sql = `
    SELECT SUBSTRING(data_lancamento,6,2) AS mes, COALESCE(SUM(valor),0) AS total
    FROM lancamentos
    WHERE tipo = 'receita'
      AND SUBSTRING(data_lancamento,1,4) = ?
      AND usuario_id = ?
    GROUP BY mes
  `;
  db.all(sql, [ano, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const arr = Array(12).fill(0);
    for (const r of rows || []) {
      const i = parseInt(r.mes, 10) - 1;
      if (i >= 0 && i < 12) arr[i] = Number(r.total) || 0;
    }
    res.json({ receitas: arr });
  });
});

module.exports = router;
