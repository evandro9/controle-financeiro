const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

function withDb(fn) { fn(db, () => {}); }
const norm = (s='') => String(s)
  .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .replace(/\s+/g,' ').trim().toLowerCase();

// === MATCH por observação (LANÇAMENTOS) ===
router.get('/match', auth, (req, res) => {
  const usuarioId = req.user.id;
  const obsRaw = req.query.obs || '';
  const obsNorm = norm(obsRaw);
  if (!obsNorm) return res.json({ ok: true, sugestao: null });

  withDb((db, done) => {
    const sql = `
      SELECT categoria_id, subcategoria_id, tipo_match, prioridade
        FROM regras_categorizacao_lancamentos
       WHERE usuario_id = ?
         AND (
              (tipo_match = 'equals'   AND padrao = ?)
           OR (tipo_match = 'contains' AND strpos(?, padrao) > 0)
         )
       ORDER BY
         CASE tipo_match WHEN 'equals' THEN 0 WHEN 'contains' THEN 1 ELSE 9 END ASC,
         COALESCE(prioridade, 100) ASC
       LIMIT 1
    `;
    const params = [usuarioId, obsNorm, obsNorm];
    db.get(sql, params, (err, row) => {
      done();
      if (err) return res.status(500).json({ erro: err.message });
      if (!row) return res.json({ ok: true, sugestao: null });
      return res.json({
        ok: true,
        sugestao: {
          categoria_id: row.categoria_id || null,
          subcategoria_id: row.subcategoria_id || null,
          tipo_match: row.tipo_match || null
        }
      });
    });
  });
});

// === Criar/Atualizar regra (LANÇAMENTOS) ===
router.post('/', auth, (req, res) => {
  const usuarioId = req.user.id;
  const {
    padrao,
    tipo_match = 'contains',
    categoria_id,
    subcategoria_id,
    prioridade = 100
  } = req.body || {};

  if (!padrao || !categoria_id) {
    return res.status(400).json({ erro: 'padrao e categoria_id são obrigatórios' });
  }

  withDb((db, done) => {
    const padraoNorm = norm(padrao);
    const sqlSel = `
      SELECT id FROM regras_categorizacao_lancamentos
       WHERE usuario_id = ?
         AND LOWER(padrao) = ?
    `;
    db.get(sqlSel, [usuarioId, padraoNorm], (errSel, row) => {
      if (errSel) { done(); return res.status(500).json({ erro: errSel.message }); }

      if (row) {
        const sqlUp = `
          UPDATE regras_categorizacao_lancamentos
             SET tipo_match = ?, categoria_id = ?, subcategoria_id = ?, prioridade = ?,
                 padrao = ?
           WHERE id = ?
        `;
        db.run(sqlUp, [tipo_match, categoria_id, subcategoria_id || null, prioridade, padraoNorm, row.id], function (eUp) {
          done();
          if (eUp) return res.status(500).json({ erro: eUp.message });
          return res.json({ ok: true, id: row.id, updated: true });
        });
      } else {
        const sqlIn = `
          INSERT INTO regras_categorizacao_lancamentos
            (usuario_id, padrao, tipo_match, categoria_id, subcategoria_id, prioridade)
          VALUES (?,?,?,?,?,?)
        `;
        db.run(sqlIn, [usuarioId, padraoNorm, tipo_match, categoria_id, subcategoria_id || null, prioridade], function (eIn) {
          done();
          if (eIn) return res.status(500).json({ erro: eIn.message });
          return res.json({ ok: true, id: this.lastID, created: true });
        });
      }
    });
  });
});

module.exports = router;