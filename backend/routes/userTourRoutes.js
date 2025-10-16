const express = require('express');
const router = express.Router();
const db = require('../database/db');          // ✅ segue seu padrão (db.query / db.get / db.all)
const auth = require('../middleware/auth');    // precisa popular req.user.id

// GET /api/user/tours/status?keys=balanco_v1,rebalanceamento_v1
router.get('/status', auth, async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'auth' });

  const keysParam = String(req.query.keys || '').trim();
  if (!keysParam) return res.json({ status: {} });

  const keys = keysParam.split(',').map(s => s.trim()).filter(Boolean);
  const params = [userId, keys];
  try {
    const q = `
      SELECT key, completed, dont_show, updated_at
      FROM user_tours
      WHERE user_id = $1 AND key = ANY($2)
    `;
    const { rows } = await db.query(q, params);
    const map = {};
    // inicia "vazio" para todas as keys pedidas
    keys.forEach(k => map[k] = { completed: false, dont_show: false, updated_at: null });
    rows.forEach(r => {
      map[r.key] = { completed: !!r.completed, dont_show: !!r.dont_show, updated_at: r.updated_at };
    });
    res.json({ status: map });
  } catch (e) {
    console.error('[user_tours] status error', e);
    res.status(500).json({ error: 'server' });
  }
});

// POST /api/user/tours/update { key, completed?, dont_show?, platform? }
router.post('/update', auth, async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'auth' });
  const { key, completed, dont_show, platform } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key' });

  try {
    const q = `
      INSERT INTO user_tours (user_id, key, completed, dont_show, completed_platform)
      VALUES ($1, $2, COALESCE($3, FALSE), COALESCE($4, FALSE), $5)
      ON CONFLICT (user_id, key) DO UPDATE
        SET
          completed = COALESCE(EXCLUDED.completed, user_tours.completed),
          dont_show = COALESCE(EXCLUDED.dont_show, user_tours.dont_show),
          completed_platform = COALESCE(EXCLUDED.completed_platform, user_tours.completed_platform),
          updated_at = NOW()
      RETURNING key, completed, dont_show, updated_at;
    `;
    const { rows } = await db.query(q, [userId, key, completed, dont_show, platform || null]);
    res.json({ ok: true, status: rows[0] });
  } catch (e) {
    console.error('[user_tours] update error', e);
    res.status(500).json({ error: 'server' });
  }
});

module.exports = router;