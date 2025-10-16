const db = require('../database/db');

const TERMS_VERSION = process.env.TERMS_VERSION || '2025-10-01';
const PRIVACY_VERSION = process.env.PRIVACY_VERSION || '2025-10-01';

// Endpoints liberados mesmo quando precisa reaceitar
const ALLOW = [
  /^\/legal\/versions\b/,
  /^\/consents\/accept\b/,
  /^\/me\b/,
  // se seu fluxo chamar isso logado, mantemos liberado:
  /^\/usuarios\/definir-senha\b/,
  // ✅ Tours: permitir checar/atualizar status para NÃO iniciar tour por engano
  /^\/user-tours\/status\b/,
  /^\/user-tours\/update\b/,  
  /^\/user-preferences\/theme\b/,
];

module.exports = async function legalGate(req, res, next) {
  try {
    if (!req.user || !req.user.id) return next(); // não logado → segue o fluxo normal

    const p = req.path || '';
    if (ALLOW.some((re) => re.test(p))) return next();

    const client = await db.connect();
    try {
      const { rows } = await client.query(
        'SELECT terms_version, privacy_version FROM usuarios WHERE id = $1',
        [req.user.id]
      );
      const u = rows[0] || {};
      const needs =
        (u.terms_version || null) !== TERMS_VERSION ||
        (u.privacy_version || null) !== PRIVACY_VERSION;

      if (!needs) return next();

      res.setHeader('x-requires-consent', '1');
      return res
        .status(428) // Precondition Required
        .json({
          requiresConsent: true,
          terms: TERMS_VERSION,
          privacy: PRIVACY_VERSION,
        });
    } finally {
      client.release();
    }
  } catch (e) {
    // Falha defensiva: em caso de erro, não travar o app
    return next();
  }
};