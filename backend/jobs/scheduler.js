// backend/jobs/scheduler.js
const { runReconcile, alreadyRanToday, LOCAL_TZ, JOB_NAME } = require('./reconcileSubscriptions');
const db = require('../database/db');
const { runCleanup } = require('./cleanupAuditoria');
const { ping } = require('../utils/heartbeat');

// Roda quando hora local >= 03:00 e ainda não rodou no dia
const TARGET_HOUR = 3;       // 03h local
const CHECK_EVERY_MS = 15 * 60 * 1000; // checar a cada 15min
const CLEANUP_HOUR = 3;      // também às 03h
const HEARTBEAT_URL = process.env.HEARTBEAT_URL; // ex.: https://hc-ping.com/<uuid>

async function localHourNow() {
  // pega hora local via Postgres para padronizar com o restante da checagem
  const r = await db.query(`select extract(hour from (now() at time zone $1)) as h`, [LOCAL_TZ]);
  return Number(r.rows[0].h);
}

async function localDateToday() {
  const r = await db.query(`select (now() at time zone $1)::date as d`, [LOCAL_TZ]);
  return String(r.rows[0].d); // 'YYYY-MM-DD'
}

let lastCleanupDate = null;
let lastBeatTs = 0;

async function tick({ verbose = false } = {}) {
  try {
    const ran = await alreadyRanToday();
    const hour = await localHourNow();
    const today = await localDateToday();

    if (verbose) console.log(`[${JOB_NAME}] tick: ran=${ran} hour=${hour}`);

    if (!ran && hour >= TARGET_HOUR) {
      if (verbose) console.log(`[${JOB_NAME}] iniciando reconcílio...`);
      await runReconcile({ verbose });
    }

    // Faxina da tabela auditoria: roda no máximo 1x por dia após CLEANUP_HOUR
    if (hour >= CLEANUP_HOUR && lastCleanupDate !== today) {
      if (verbose) console.log(`[auditoria.cleanup] iniciando...`);
      try {
        await runCleanup({ verbose });
      } finally {
        lastCleanupDate = today;
      }
    }

    // ➜ Pulso (push). Envia um "estou vivo" para o monitor externo.
    //    Por padrão, um ping a cada tick (15 min). Evita pingar mais de 1x/min.
    if (HEARTBEAT_URL) {
      const now = Date.now();
      if (now - lastBeatTs > 60_000) {
        const r = await ping(HEARTBEAT_URL);
        if (verbose) console.log(`[heartbeat] ping => ${r.status ?? 0} (ok=${r.ok})`);
        lastBeatTs = now;
      }
    }

  } catch (e) {
    console.error(`[${JOB_NAME}] tick erro`, e);
    // Opcional: se quiser notificar falhas do scheduler:
    if (process.env.HEARTBEAT_FAIL_URL) ping(process.env.HEARTBEAT_FAIL_URL);
  }
}

function startDailyReconciler({ verbose = false } = {}) {
  // 1) roda na subida se já passou das 03:00 e não rodou hoje
  tick({ verbose });

  // 2) checa periodicamente (cobre cenários de server “acorda” depois)
  setInterval(() => tick({ verbose }), CHECK_EVERY_MS);
}

module.exports = { startDailyReconciler };