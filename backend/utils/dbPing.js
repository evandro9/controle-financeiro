// Ping do banco compatível com Postgres (e com fallback genérico).
// Tenta db.query / db.pool.query / db.client.query. Se nada existir, "ok".
const db = require('../database/db');

module.exports = async function dbPing() {
  const started = Date.now();
  try {
    if (db && typeof db.query === 'function') {
      await db.query('SELECT 1');
    } else if (db && db.pool && typeof db.pool.query === 'function') {
      await db.pool.query('SELECT 1');
    } else if (db && db.client && typeof db.client.query === 'function') {
      await db.client.query('SELECT 1');
    } else {
      // Interface desconhecida: não falha o healthz por isso
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, err };
  }
};