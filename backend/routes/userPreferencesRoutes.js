const express = require('express');
const router = express.Router();
const db = require('../database/db');           // mesmo padrão: db.query
const autenticar = require('../middleware/auth'); // mesmo middleware das outras rotas

// GET /user-preferences/theme  → { theme: 'light' | 'dark' }
router.get('/theme', autenticar, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'auth' });
    const { rows } = await db.query('SELECT tema FROM usuarios WHERE id = $1', [userId]);
    const theme = rows && rows[0] && rows[0].tema ? rows[0].tema : 'light';
    res.json({ theme });
  } catch (e) {
    console.error('[prefs] GET theme error', e);
    res.status(500).json({ error: 'server' });
  }
});

// POST /user-preferences/theme  body: { theme: 'light' | 'dark' }
router.post('/theme', autenticar, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'auth' });
    const theme = (req.body && req.body.theme) || '';
    if (theme !== 'light' && theme !== 'dark') {
      return res.status(400).json({ error: 'invalid_theme' });
    }
    const { rows } = await db.query(
      'UPDATE usuarios SET tema = $1 WHERE id = $2 RETURNING tema',
      [theme, userId]
    );
    res.json({ theme: rows[0].tema });
  } catch (e) {
    console.error('[prefs] POST theme error', e);
    res.status(500).json({ error: 'server' });
  }
});

module.exports = router;