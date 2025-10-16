const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// helper simples (mesmo padrão usado nas outras rotas)
function withDb(fn) { fn(db, () => {}); }

// === CRIAR/ATUALIZAR REGRA ===
router.post('/regras', auth, (req, res) => {
  const usuarioId = req.user.id;
  const {
    padrao,
    tipo_match = 'contains',
    categoria_id,
    subcategoria_id,
    prioridade = 100,
    valor_fixo // ← NOVO
  } = req.body || {};

  if (!padrao || !categoria_id) {
    return res.status(400).json({ erro: 'padrao e categoria_id são obrigatórios' });
  }

  withDb((db, done) => {
    const norm = (s='') => String(s)
      .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ').trim().toLowerCase();
    const padraoNorm = norm(padrao);

    // Diferencia por valor_fixo (NULL vs numérico)
    const sqlSel = `
      SELECT id FROM regras_categorizacao
       WHERE usuario_id = ?
         AND LOWER(padrao) = ?
         AND ( (valor_fixo IS NULL AND ? IS NULL) OR ROUND(valor_fixo,2) = ROUND(?,2) )
    `;
    db.get(sqlSel, [usuarioId, padraoNorm, valor_fixo, valor_fixo], (errSel, row) => {
      if (errSel) { done(); return res.status(500).json({ erro: errSel.message }); }

      if (row) {
        const sqlUp = `
          UPDATE regras_categorizacao
             SET tipo_match = ?, categoria_id = ?, subcategoria_id = ?, prioridade = ?,
                 padrao = ?, valor_fixo = ?
           WHERE id = ?
        `;
        db.run(sqlUp, [tipo_match, categoria_id, subcategoria_id || null, prioridade, padraoNorm, valor_fixo ?? null, row.id], function (eUp) {
          done();
          if (eUp) return res.status(500).json({ erro: eUp.message });
          return res.json({ ok: true, id: row.id, updated: true });
        });
      } else {
        const sqlIn = `
          INSERT INTO regras_categorizacao
            (usuario_id, padrao, tipo_match, categoria_id, subcategoria_id, prioridade, valor_fixo)
          VALUES (?,?,?,?,?,?,?)
        `;
        db.run(sqlIn, [usuarioId, padraoNorm, tipo_match, categoria_id, subcategoria_id || null, prioridade, valor_fixo ?? null], function (eIn) {
          done();
          if (eIn) return res.status(500).json({ erro: eIn.message });
          return res.json({ ok: true, id: this.lastID, created: true });
        });
      }
    });
  });
});

module.exports = router;