'use strict';
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// Precisa estar logado
router.use(auth);

// GET /assinatura/status
router.get('/status', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ erro: 'unauthorized', mensagem: 'Usuário não autenticado' });
    }

    const q = `
      SELECT id, user_id, plan, status, current_period_end, cancel_at,
             (NOW() AT TIME ZONE 'America/Sao_Paulo')              AS now_sp,
             (current_period_end AT TIME ZONE 'America/Sao_Paulo') AS current_period_end_sp
        FROM subscriptions
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1
    `;
    const { rows } = await db.query(q, [userId]);
    const sub = rows?.[0];

    if (!sub) {
      return res.json({
        ativo: false,
        status: 'none',
        plan: null,
        current_period_end: null,
        cancel_at: null
      });
    }

    const now   = new Date(sub.now_sp || Date.now());
    const end   = sub.current_period_end_sp ? new Date(sub.current_period_end_sp) : null;
    const st    = String(sub.status || '').toLowerCase();
    let   ativo = st === 'active';
    if (end && end < now) ativo = false;
    if (sub.cancel_at) {
      const cancel = new Date(sub.cancel_at);
      if (!isNaN(cancel) && cancel <= now) ativo = false;
    }

    return res.json({
      ativo,
      status: sub.status,
      plan: sub.plan,
      current_period_end: sub.current_period_end,
      cancel_at: sub.cancel_at
    });
  } catch (e) {
    console.error('[assinaturaRoutes][status] erro:', e);
    return res.status(500).json({ erro: 'falha_ao_verificar_assinatura' });
  }
});

module.exports = router;