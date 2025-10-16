const db = require('../database/db');

const JOB_NAME = 'auditoria.cleanup';

/**
 * Remove registros antigos da tabela auditoria.
 * @param {Object} opts
 * @param {boolean} opts.verbose - log no console
 * @param {number}  opts.days    - dias de retenção (fallback se não houver env)
 */
async function runCleanup({ verbose = false, days } = {}) {
  const retention = Number(process.env.AUDITORIA_RETENCAO_DIAS || days || 180);
  // Ex.: '180 days'
  const intervalStr = `${retention} days`;
  const sql = `DELETE FROM auditoria WHERE data_hora < now() - $1::interval`;
  const res = await db.query(sql, [intervalStr]);
  if (verbose) {
    console.log(`[${JOB_NAME}] removidos ${res.rowCount} registros (retencao=${retention}d)`);
  }
  return res.rowCount;
}

module.exports = { runCleanup, JOB_NAME };