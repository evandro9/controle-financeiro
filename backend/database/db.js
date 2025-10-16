const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /require|true/i.test(process.env.PGSSL || '') ? { rejectUnauthorized: false } : undefined,
});

// troca ? -> $1, $2...
const toDollarParams = (sql = '') => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

// adiciona RETURNING * em DML quando não houver
const withReturning = (sql = '') => {
  const s = sql.trim();
  const isDml = /^(insert|update|delete)\b/i.test(s);
  if (!isDml) return sql;
  if (/returning\b/i.test(s)) return sql;
  return `${sql} RETURNING *`;
};

const asCb = (promise, cb, ctx = undefined) => {
  if (typeof cb !== 'function') return promise;
  promise.then((val) => cb.call(ctx, null, val)).catch((err) => cb.call(ctx, err));
};

const pickLastId = (rows = []) => {
  const r = rows?.[0] || {};
  if ('id' in r) return r.id;
  const key = Object.keys(r).find((k) => /_id$/i.test(k));
  return key ? r[key] : null;
};

const db = {
  all(sql, params = [], cb) {
    const q = toDollarParams(sql);
    const p = pool.query(q, params).then((res) => res.rows);
    return asCb(p, cb);
  },
  get(sql, params = [], cb) {
    const q = toDollarParams(sql);
    const p = pool.query(q, params).then((res) => (res.rows?.[0] ?? null));
    return asCb(p, cb);
  },
  run(sql, params = [], cb) {
    const q = toDollarParams(withReturning(sql));
    const p = pool
      .query(q, params)
      .then((res) => {
        const ctx = { lastID: pickLastId(res.rows), changes: res.rowCount };
        if (typeof cb === 'function') return cb.call(ctx, null);
        return { rows: res.rows, rowCount: res.rowCount, ...ctx };
      })
      .catch((err) => {
        if (typeof cb === 'function') return cb.call({ lastID: null, changes: 0 }, err);
        throw err;
      });
    return p;
  },
  prepare(sql) {
    const q = toDollarParams(withReturning(sql));
    return {
      run(params = [], cb) {
        const p = pool
          .query(q, params)
          .then((res) => {
            const ctx = { lastID: pickLastId(res.rows), changes: res.rowCount };
            if (typeof cb === 'function') return cb.call(ctx, null);
            return { rows: res.rows, rowCount: res.rowCount, ...ctx };
          })
          .catch((err) => {
            if (typeof cb === 'function') return cb.call({ lastID: null, changes: 0 }, err);
            throw err;
          });
        return p;
      },
      finalize(cb) { if (typeof cb === 'function') cb(); },
    };
  },
  exec(sql, cb) {
    const blocks = String(sql)
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(toDollarParams);
    const p = pool.connect().then(async (client) => {
      try {
        await client.query('BEGIN');
        for (const q of blocks) await client.query(q);
        await client.query('COMMIT');
        client.release();
        return true;
      } catch (e) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        client.release();
        throw e;
      }
    });
    return asCb(p, cb);
  },

  // 🔽 Adições para compatibilidade direta com rotas em pg:
  query(text, params) {
    // passa direto para o Pool do pg (sem toDollarParams)
    return pool.query(text, params);
  },
  connect() {
    // permite transações explícitas via client = await db.connect()
    return pool.connect();
  },
  pool, // opcional: deixa disponível se você quiser acessar o Pool

};

module.exports = db;