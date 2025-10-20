// backend/jobs/reconcileSubscriptions.js
const db = require('../database/db');

const LOCAL_TZ = 'America/Sao_Paulo';
const JOB_NAME = 'reconcile_subscriptions';

// Entitlements “oficiais” por plano (ajuste se quiser)
function entitlementsFor(plan) {
  if (plan === 'anual') {
    return {
      premium: 'true',
      investimentos: 'true',
      heatmap: 'true',
      imports_per_month: '1000',
      retention_days: '365',
    };
  }
  // semestral = básico
  return {
    heatmap: 'true',
    imports_per_month: '500',
    retention_days: '180',
  };
}

async function q(sql, params = []) {
  return db.query(sql, params);
}

// retorna true se já existe um run hoje (na TZ local)
async function alreadyRanToday() {
  const r = await q(
    `select 1
       from job_runs
      where job_name = $1
        and run_date = (now() at time zone $2)::date`,
    [JOB_NAME, LOCAL_TZ]
  );
  return r.rowCount > 0;
}

async function markRan() {
  await q(
    `insert into job_runs (job_name, run_date)
     values ($1, (now() at time zone $2)::date)
     on conflict (job_name, run_date) do nothing`,
    [JOB_NAME, LOCAL_TZ]
  );
}

async function expireSubscriptions() {
  // Expira quem passou do current_period_end
  await q(
    `update subscriptions
        set status='expired',
            updated_at=now()
      where status in ('active','past_due')
        and current_period_end is not null
        and current_period_end < now()`
  );
}

// Apaga APENAS os entitlements gerenciados pelo sistema
// de quem não está 'active'. Mantém qualquer coisa 'manual'.
async function removeEntitlementsForNonActive() {
  await q(
    `delete from entitlements
      where managed_by = 'system'
        and user_id in (
          select user_id from subscriptions where status <> 'active'
        )`
  );
}

async function healEntitlementsForActive() {
  // Reaplica entitlements para quem está active (idempotente: apaga e recria SISTEMA)
  const r = await q(
    `select user_id, plan
       from subscriptions
      where status='active'`
  );

  for (const row of r.rows) {
    const ents = entitlementsFor(row.plan);
    // Zera somente os entitlements gerenciados pelo sistema
    await q(
      `delete from entitlements where user_id = $1 and managed_by = 'system'`,
      [row.user_id]
    );
    for (const [k, v] of Object.entries(ents)) {
      await q(
        `insert into entitlements (user_id, feature_key, value, managed_by)
         values ($1,$2,$3,'system')
         on conflict (user_id, feature_key)
           do update set value = excluded.value, managed_by = 'system'`,
        [row.user_id, k, String(v)]
      );
    }
  }
}

async function runReconcile({ verbose = false } = {}) {
  const t0 = Date.now();
  const client = await db.getClient?.() || null;
  try {
    if (client) await client.query('BEGIN');

    await expireSubscriptions();
    await removeEntitlementsForNonActive();
    await healEntitlementsForActive();
    await markRan();

    if (client) await client.query('COMMIT');
    if (verbose) console.log(`[${JOB_NAME}] ok em ${Date.now() - t0}ms`);
  } catch (e) {
    if (client) await client.query('ROLLBACK');
    console.error(`[${JOB_NAME}] erro`, e);
    throw e;
  } finally {
    if (client) client.release?.();
  }
}

module.exports = { runReconcile, alreadyRanToday, JOB_NAME, LOCAL_TZ };