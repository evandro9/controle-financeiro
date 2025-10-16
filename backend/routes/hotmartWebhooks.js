// backend/routes/hotmartWebhooks.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const crypto = require('crypto');
const { sendEmail } = require('../utils/mailer');
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

// helper (Postgres)
async function q(sql, params = []) {
  return db.query(sql, params);
}

// idempotência
async function claimEvent({ evtId, type, payload, userId }) {
  const r = await q(
    `insert into subscription_events (user_id, external_provider, external_event_id, event_type, payload)
     values ($1,'hotmart',$2,$3,$4)
     on conflict (external_provider, external_event_id) do nothing
     returning 1`,
    [userId, evtId, type, JSON.stringify(payload)]
  );
  return r.rowCount === 1; // true = sou o dono; false = duplicado
}

// mapeia nome de oferta/plan da Hotmart -> 'mensal' | 'anual'
function mapHotmartPlanToInternal(name) {
  const p = (name || '').toString().toLowerCase();
 if (p.includes('anual')) return 'anual';
 if (p.includes('semestr')) return 'semestral'; // semestral/6 meses
 return 'semestral'; // default de segurança
}

// aplica entitlements por plano (inclui 'premium' global)
async function applyEntitlements(userId, plan) {
  const ents = plan === 'anual'
    ? { premium: 'true', investimentos: 'true', heatmap: 'true', imports_per_month: '1000', retention_days: '365' }
    : { premium: 'true', investimentos: 'true', heatmap: 'true', imports_per_month: '500',  retention_days: '180' };

  await q('delete from entitlements where user_id=$1', [userId]);
  for (const [k, v] of Object.entries(ents)) {
    await q('insert into entitlements (user_id, feature_key, value) values ($1,$2,$3)', [userId, k, v]);
  }
}

// normaliza payload
function parseHotmartPayload(body) {
  const p = body || {};
  const evtId = String(p.id || p.transaction || p.signature || (p.subscription && p.subscription.id) || Date.now());
  const evtType = String(p.event || p.status || 'unknown');

  const buyerEmail =
    (p.buyer && p.buyer.email) ||
    p.email ||
    (p.purchaser && p.purchaser.email) ||
    null;

  const planNameHotmart =
    (p.subscription && p.subscription.plan && p.subscription.plan.name) ||
    (p.offer && p.offer.name);

  const internalPlan = mapHotmartPlanToInternal(planNameHotmart);

  let status = 'active';
  const s = String((p.subscription && p.subscription.status) || p.status || '').toLowerCase();
  if (['delayed','overdue','past_due'].some(x => s.includes(x))) status = 'past_due';
  if (['canceled','cancelled','chargeback','refunded','expired'].some(x => s.includes(x))) status = 'canceled';
  if (['trial'].some(x => s.includes(x))) status = 'trial';

  const nextDate = p.subscription && p.subscription.next_due_date ? new Date(p.subscription.next_due_date) : null;

  return { evtId, evtType, buyerEmail, internalPlan, status, nextDate, raw: p };
}

// POST /webhooks/hotmart/subscriptions
router.post('/subscriptions', async (req, res) => {
  try {
    // valida HOTTOK
    const hottok = req.header('X-HOTMART-HOTTOK');
    if (hottok !== process.env.HOTMART_HOTTOK) {
      // AUDITORIA: assinatura inválida do webhook
      req.audit({ acao: 'webhook.hotmart', entidade: 'webhook', entidade_id: null, sucesso: false, motivo: 'invalid_hottok' });
      return res.status(401).send('invalid hottok');
    }

  const { evtId, evtType, buyerEmail, internalPlan, status, nextDate, raw } = parseHotmartPayload(req.body || {});
  if (!buyerEmail) {
    req.audit({ acao: 'webhook.hotmart', entidade: 'webhook', entidade_id: null, sucesso: false, motivo: 'buyer_email_missing' });
    return res.status(400).send('buyer email missing');
  }
  if (!evtId) {
    req.audit({ acao: 'webhook.hotmart', entidade: 'webhook', entidade_id: null, sucesso: false, motivo: 'event_id_missing' });
    return res.status(400).send('event id missing');
  }

  // garante usuário (precisamos do user_id para o insert idempotente)
  const u = await q(
    'insert into usuarios (email) values ($1) on conflict (email) do update set email=excluded.email returning id',
    [buyerEmail]
  );
  const userId = u.rows[0].id;

  // tenta "claim" do evento (idempotência atômica)
  const souODono = await claimEvent({ evtId, type: evtType, payload: raw, userId });
  if (!souODono) return res.status(200).send('ok'); // duplicado/concorrente → encerra elegante

    // upsert assinatura
    await q(
      `insert into subscriptions (user_id, plan, status, external_provider, external_subscription_id, current_period_end)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (user_id, external_provider) do update
       set plan=excluded.plan, status=excluded.status, current_period_end=excluded.current_period_end, updated_at=now()`,
      [userId, internalPlan, status, 'hotmart', (raw.subscription && raw.subscription.id) || raw.transaction || evtId, nextDate]
    );

    // aplica entitlements
  if (status === 'active') {
    await applyEntitlements(userId, internalPlan);
  } else {
    // qualquer status ≠ active -> remove
    await q('delete from entitlements where user_id=$1', [userId]);
  }
    // Se ativou, dispara magic link (experiência zero atrito)
    if (status === 'active' && buyerEmail) {
      const raw = crypto.randomBytes(24).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await q(
        `insert into auth_tokens (user_id, token_hash, purpose, expires_at)
         values ($1,$2,'magic_login',$3)`,
        [userId, tokenHash, expires]
      ).catch(() => {});
      const url = `${APP_BASE_URL}/entrar/magic?token=${encodeURIComponent(raw)}`;
      await sendEmail({
        to: buyerEmail,
        subject: 'Acesso liberado — entre agora',
        html: `<p>Obrigado pela compra! Seu acesso foi liberado.<br/>
               Clique para entrar: <a href="${url}">acessar agora</a>.<br/>
               Este link expira em 60 minutos.</p>`,
      }).catch(() => {});
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEV] Magic URL para', buyerEmail, '→', url);
      }      
    }
    // AUDITORIA: processado ok
    req.audit({
      acao: 'webhook.hotmart',
      entidade: 'assinatura',
      entidade_id: u.rows[0].id,
      sucesso: true,
      detalhes: { evento: evtType, plano: internalPlan, status }
    });
    res.status(200).send('ok');
  } catch (e) {
    console.error('[hotmart webhook]', e);
    res.status(500).send('err');
  }
});

module.exports = router;