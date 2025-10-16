// backend/middleware/subscriptionGuard.js
const db = require('../database/db');

async function isActive(userId) {
  const r = await db.query(
    `select 1 from subscriptions
     where user_id=$1 and status='active'`,
    [userId]
  );
  return r.rowCount > 0;
}

// Bloqueia métodos de escrita se a assinatura não estiver 'active'
async function requireActiveForWrites(req, res, next) {
  // Métodos que alteram o sistema
  const isWrite = /^(POST|PUT|PATCH|DELETE)$/i.test(req.method);

  if (!isWrite) return next(); // leitura liberada (ver opção 4 abaixo)

  const userId = req.user && req.user.id;
  if (userId == null) return res.status(401).json({ error: 'unauthorized' });

  try {
    const ok = await isActive(userId);
    if (!ok) {
      return res.status(402).json({
        error: 'inactive_subscription',
        message: 'Assinatura inativa. Ative seu plano para continuar.'
      });
    }
    next();
  } catch (e) {
    console.error('[requireActiveForWrites]', e);
    res.status(500).json({ error: 'Erro de verificação de assinatura' });
  }
}

module.exports = { requireActiveForWrites };