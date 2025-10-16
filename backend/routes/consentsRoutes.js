const express = require('express');
const router = express.Router();
const db = require('../database/db');

const TERMS_VERSION = process.env.TERMS_VERSION || '2025-10-01';
const PRIVACY_VERSION = process.env.PRIVACY_VERSION || '2025-10-01';

// ➤ GET /legal/versions
router.get('/legal/versions', (req, res) => {
  return res.json({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION });
});

// Utilidade interna de auditoria (compatível com seu middleware que injeta req.audit)
function audit(req, evt) {
  try {
    if (typeof req.audit === 'function') {
      req.audit(evt);
    }
  } catch {}
}

// ➤ POST /consents/accept  { terms: true, privacy: true, marketingOptIn?: boolean }
router.post('/consents/accept', express.json(), async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { terms, privacy, marketingOptIn } = req.body || {};
    if (!terms || !privacy) return res.status(400).json({ error: 'terms_and_privacy_required' });

    const ip =
      (req.headers['x-forwarded-for'] || '')
        .toString()
        .split(',')[0]
        .trim() ||
      req.ip ||
      null;
    const ua = req.headers['user-agent'] || null;

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // terms
      await client.query(
        `INSERT INTO user_consents (user_id, policy, version, accepted, accepted_at, ip, user_agent)
         VALUES ($1,'terms',$2,1,now(),$3,$4)
         ON CONFLICT (user_id, policy, version)
         DO UPDATE SET accepted=EXCLUDED.accepted, accepted_at=EXCLUDED.accepted_at, ip=EXCLUDED.ip, user_agent=EXCLUDED.user_agent`,
        [userId, TERMS_VERSION, ip, ua]
      );
      // privacy
      await client.query(
        `INSERT INTO user_consents (user_id, policy, version, accepted, accepted_at, ip, user_agent)
         VALUES ($1,'privacy',$2,1,now(),$3,$4)
         ON CONFLICT (user_id, policy, version)
         DO UPDATE SET accepted=EXCLUDED.accepted, accepted_at=EXCLUDED.accepted_at, ip=EXCLUDED.ip, user_agent=EXCLUDED.user_agent`,
        [userId, PRIVACY_VERSION, ip, ua]
      );
      // marketing (opcional)
      if (marketingOptIn === true) {
        await client.query(
          `INSERT INTO user_consents (user_id, policy, version, accepted, accepted_at, ip, user_agent)
           VALUES ($1,'marketing',$2,1,now(),$3,$4)
           ON CONFLICT (user_id, policy, version)
           DO UPDATE SET accepted=EXCLUDED.accepted, accepted_at=EXCLUDED.accepted_at, ip=EXCLUDED.ip, user_agent=EXCLUDED.user_agent`,
          [userId, PRIVACY_VERSION, ip, ua]
        );
      }

      // snapshot no usuário
      await client.query(
        `UPDATE usuarios
           SET terms_version=$1,
               privacy_version=$2,
               terms_accepted_at=COALESCE(terms_accepted_at, now()),
               privacy_accepted_at=COALESCE(privacy_accepted_at, now()),
               marketing_opt_in = CASE WHEN $3 THEN 1 ELSE marketing_opt_in END,
               marketing_opt_in_at = CASE WHEN $3 THEN COALESCE(marketing_opt_in_at, now()) ELSE marketing_opt_in_at END
         WHERE id=$4`,
        [TERMS_VERSION, PRIVACY_VERSION, marketingOptIn === true, userId]
      );

      await client.query('COMMIT');

      audit(req, {
        acao: 'legal.accept',
        entidade: 'user_consents',
        entidade_id: userId,
        sucesso: true,
        detalhes: { terms: TERMS_VERSION, privacy: PRIVACY_VERSION, marketingOptIn: !!marketingOptIn }
      });

      return res.json({ ok: true });
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('[consents/accept] err', e);
    return res.status(500).json({ error: 'server' });
  }
});

module.exports = router;