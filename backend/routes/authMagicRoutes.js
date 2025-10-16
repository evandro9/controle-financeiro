const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { sendEmail } = require('../utils/mailer');

const router = express.Router();
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev';

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
function genToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// POST /api/auth/magic/start  body: { email }
router.post('/magic/start', express.json(), async (req, res) => {
  const email = (req.body?.email || '').toString().trim().toLowerCase();
  const purposeReq = (req.body?.purpose || 'magic_login').toString();
  const purpose = purposeReq === 'reset' ? 'reset_password' : 'magic_login';
  if (!email) return res.status(200).json({ ok: true }); // sempre 200 p/ não enumerar
  try {
    // Busca usuário por e-mail
    const u = await db.query('SELECT id FROM usuarios WHERE email=$1 LIMIT 1', [email]);
    if (u.rows.length === 0) {
      // Não vaza informação: responde 200 mesmo assim
      // AUDITORIA: tentativa para e-mail inexistente (não informamos ao cliente)
      req.audit({ acao: 'auth.magic_start', entidade: 'usuario', entidade_id: null, sucesso: true, motivo: 'email_not_found_squash' });
      return res.json({ ok: true });
    }
    const userId = u.rows[0].id;
    // Gera token
    const raw = genToken();
    const tokenHash = hashToken(raw);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 60min
    await db.query(
      `INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at)
       VALUES ($1,$2,$3,$4)`,
      [userId, tokenHash, purpose, expires]
    );
    // AUDITORIA: início de magic link/reset
    req.audit({ acao: 'auth.magic_start', entidade: 'usuario', entidade_id: userId, sucesso: true, detalhes: { purpose } });
    const url = `${APP_BASE_URL}/entrar/magic?token=${encodeURIComponent(raw)}`;
    await sendEmail({
      to: email,
      subject: 'Seu link de acesso',
      html: `<p>Olá!<br/>Clique para entrar: <a href="${url}">acessar agora</a>.<br/>
             Este link expira em 60 minutos.</p>`,
    });
      // Em DEV (ou sem provider) devolvemos a URL para facilitar o teste manual
    const isDev = process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY;
    return res.json({ ok: true, ...(isDev ? { devMagicUrl: url } : {}) });
  } catch (e) {
    console.error('[authMagic/start]', e);
    // Mesmo se falhar o envio, em DEV devolvemos o link para teste
    const rawFromError = req.body?.__noop; // só pra manter referência
    // tenta recompor a URL a partir do último token gerado? não temos aqui; então geramos de novo & gravamos outro token:
    try {
      const u = await db.query('SELECT id FROM usuarios WHERE email=$1 LIMIT 1', [email]);
      if (u.rows.length) {
        const userId = u.rows[0].id;
        const raw2 = genToken();
        const h2 = hashToken(raw2);
        const exp2 = new Date(Date.now() + 60 * 60 * 1000);
        await db.query(
          `INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at)
           VALUES ($1,$2,$3,$4)`,
          [userId, h2, purpose, exp2]
        );
        const testUrl = `${APP_BASE_URL}/entrar/magic?token=${encodeURIComponent(raw2)}`;
        const isDev = process.env.NODE_ENV !== 'production';
        return res.json({ ok: true, ...(isDev ? { devMagicUrl: testUrl } : {}) });
      }
    } catch {}
    // Fallback final: ainda 200 para não vazar enumeração
    return res.json({ ok: true });
  }
});

// POST /api/auth/magic/consume  body: { token }
router.post('/magic/consume', express.json(), async (req, res) => {
  const raw = (req.body?.token || '').toString();
  if (!raw) return res.status(400).json({ error: 'token_required' });
  try {
    const h = hashToken(raw);
    const r = await db.query(
      `SELECT t.id, t.user_id, t.expires_at, t.consumed_at, t.purpose, u.senha
         FROM auth_tokens t
         JOIN usuarios u ON u.id = t.user_id
        WHERE t.token_hash=$1 AND t.purpose IN ('magic_login','reset_password')
        LIMIT 1`,
      [h]
    );
    if (r.rows.length === 0) {
      req.audit({ acao: 'auth.magic_consume', entidade: 'usuario', entidade_id: null, sucesso: false, motivo: 'invalid_token' });
      return res.status(400).json({ error: 'invalid_token' });
    }
    const row = r.rows[0];
    if (row.consumed_at) {
      req.audit({ acao: 'auth.magic_consume', entidade: 'usuario', entidade_id: row.user_id, sucesso: false, motivo: 'used_token' });
      return res.status(400).json({ error: 'used_token' });
    }
    if (new Date(row.expires_at) < new Date()) {
      req.audit({ acao: 'auth.magic_consume', entidade: 'usuario', entidade_id: row.user_id, sucesso: false, motivo: 'expired_token' });
      return res.status(400).json({ error: 'expired_token' });
    }
    // Consome
    await db.query('UPDATE auth_tokens SET consumed_at=NOW() WHERE id=$1', [row.id]);
    // Emite JWT igual ao login tradicional
    const jwtToken = jwt.sign({ id: row.user_id }, JWT_SECRET, { expiresIn: '7d' });
    const needsPassword = row.purpose === 'reset_password' ? true : !row.senha;
    // AUDITORIA: consumo OK
    req.audit({ acao: 'auth.magic_consume', entidade: 'usuario', entidade_id: row.user_id, sucesso: true, detalhes: { purpose: row.purpose } });
    return res.json({ token: jwtToken, needsPassword });
  } catch (e) {
    console.error('[authMagic/consume]', e);
    return res.status(500).json({ error: 'server' });
  }
});

module.exports = router;