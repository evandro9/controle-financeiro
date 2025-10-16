// backend/routes/meRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const TERMS_VERSION = process.env.TERMS_VERSION || '2025-10-01';
const PRIVACY_VERSION = process.env.PRIVACY_VERSION || '2025-10-01';
const autenticar = require('../middleware/auth'); // ✅ exige token

async function q(sql, params = []) {
  return db.query(sql, params);
}

// GET /me -> dados do usuário + sinalização do gate de reaceite
router.get('/', autenticar, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (userId == null) return res.status(401).json({ error: 'unauthorized' });
    const r = await q(
      `SELECT id, nome, email,
              terms_version, privacy_version, marketing_opt_in
         FROM usuarios
        WHERE id = $1`,
      [userId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
    const u = r.rows[0];
    const requiresConsent =
      (u.terms_version || null) !== TERMS_VERSION ||
      (u.privacy_version || null) !== PRIVACY_VERSION;
    return res.json({
      id: u.id,
      nome: u.nome,
      email: u.email,
      terms_version: u.terms_version,
      privacy_version: u.privacy_version,
      marketing_opt_in: !!u.marketing_opt_in,
      requiresConsent,
      nextLegalVersions: { terms: TERMS_VERSION, privacy: PRIVACY_VERSION },
    });
  } catch (e) {
    console.error('[me] err', e);
    return res.status(500).json({ error: 'Erro' });
  }
});

// GET /me/subscription -> { plan, status, current_period_end }
router.get('/subscription', autenticar, async (req, res) => {
  try {
  const userId = req.user && req.user.id;
  if (userId == null) return res.json({ plan: null, status: 'expired', current_period_end: null });

    const r = await q(
      'select plan, status, current_period_end from subscriptions where user_id=$1',
      [userId]
    );

    if (r.rowCount === 0) {
      return res.json({ plan: null, status: 'expired', current_period_end: null });
    }

    // Se houver múltiplas linhas por algum motivo, retorna a mais recente
    const row = r.rows[0];
    return res.json({
      plan: row.plan || null,
      status: row.status || 'expired',
      current_period_end: row.current_period_end,
    });
  } catch (e) {
    console.error('[me/subscription] err', e);
    res.status(500).json({ error: 'Erro' });
  }
});

// GET /me/entitlements -> { feature_key: value, ... }
router.get('/entitlements', autenticar, async (req, res) => {
  try {
  const userId = req.user && req.user.id;
  if (userId == null) return res.json({});

    const r = await q(
      'select feature_key, value from entitlements where user_id=$1',
      [userId]
    );

    const out = {};
    for (const row of r.rows) out[row.feature_key] = row.value;
    res.json(out);
  } catch (e) {
    console.error('[me/entitlements] err', e);
    res.status(500).json({ error: 'Erro' });
  }
});

module.exports = router;