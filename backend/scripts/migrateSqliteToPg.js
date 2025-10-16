// scripts/migrateSqliteToPg.js
/* Migra TUDO do SQLite para Postgres (1:1, sem duplicar, com validação de esquema).
   Uso:
     set SQLITE_PATH=.\database\financeiro.db
     set DATABASE_URL=postgres://postgres:SENHA@localhost:5432/siteFinancas
     node .\scripts\migrateSqliteToPg.js
*/
require('dotenv').config();
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const SQLITE_PATH = process.env.SQLITE_PATH || './financeiro.db';
const DATABASE_URL = process.env.DATABASE_URL;
const RESET = /^(1|true)$/i.test(process.env.RESET || '');

if (!DATABASE_URL) {
  console.error('Faltou DATABASE_URL (ex.: postgres://user:pass@host:5432/db)');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: /require|true/i.test(process.env.PGSSL || '') ? { rejectUnauthorized: false } : undefined,
});

function ident(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}
function placeholders(n) {
  return Array.from({ length: n }, (_, i) => `$${i + 1}`).join(',');
}

// Helpers p/ detectar número/uuid simples
const isNumeric = v => v !== null && v !== undefined && /^\d+$/.test(String(v));
const isLikelyUuid = v => typeof v === 'string' && v.includes('-') && !isNumeric(v);

// Esquemas explícitos onde sabemos exatamente as colunas (evita “id” fantasma)
const SCHEMA_OVERRIDES = {
  fx_cotacoes_mensais: ['par', 'ano', 'mes', 'close', 'data_ref'],
};

(async () => {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    .all()
    .map(r => r.name);

  console.log(`Tabelas encontradas no SQLite: ${tables.join(', ')}`);

    // ========= PRÉ-CHECK DE INTEGRIDADE NO SQLITE (pais → filhos) =========
  // Lista mínima de FKs relevantes do seu schema
  const fkPairs = [
    ['categorias',        'id',  'subcategorias',       'categoria_id'],
    ['import_lotes',      'id',  'import_itens',        'lote_id'],
    ['planos',            'id',  'planos_movimentos',   'plano_id'],
    ['categorias',        'id',  'lancamentos',         'categoria_id'],
    ['subcategorias',     'id',  'lancamentos',         'subcategoria_id'],
    ['formas_pagamento',  'id',  'lancamentos',         'forma_pagamento_id'],
    ['categorias',        'id',  'transacoes_externas', 'categoria_id'],
    ['subcategorias',     'id',  'transacoes_externas', 'subcategoria_id'],
    ['formas_pagamento',  'id',  'transacoes_externas', 'forma_pagamento_id'],
  ];

  for (const [parent, parentPk, child, childFk] of fkPairs) {
    if (!tables.includes(parent) || !tables.includes(child)) continue;
    const missing = sqlite.prepare(
      `SELECT DISTINCT ${ident(childFk)} AS fk
         FROM ${ident(child)}
        WHERE ${ident(childFk)} IS NOT NULL
          AND ${ident(childFk)} NOT IN (SELECT ${ident(parentPk)} FROM ${ident(parent)})
        ORDER BY fk
        LIMIT 50`
    ).all().map(r => r.fk);
    if (missing.length) {
      console.error(`\n[FK BROKEN NO SQLITE] ${child}.${childFk} → ${parent}.${parentPk}`);
      console.error(`  IDs sem pai no SQLite (primeiros 50): ${missing.join(', ')}`);
      throw new Error(`Dados de origem têm FK quebrada entre ${child}.${childFk} e ${parent}.${parentPk}. Corrija o SQLite antes de importar.`);
    }
  }
  // ========= FIM DO PRÉ-CHECK =========

  const client = await pool.connect();
  try {
    // Quais tabelas existem no PG (pode ter diferença de nomes/ausências)
    const pgExisting = [];
    for (const t of tables) {
      const colsPg = await getPgColumns(client, t);
      if (colsPg.length) pgExisting.push(t);
    }

    // Ordem de importação por dependências (FKs): pais → filhos
    const topoOrder = await computeImportOrder(client);
    const tablesOrdered =
      topoOrder
        .filter(t => pgExisting.includes(t) && tables.includes(t))     // somente as que existem nos dois lados
        .concat(tables.filter(t => pgExisting.includes(t) && !topoOrder.includes(t))); // sobras sem FK entram no fim
    console.log(`\n[Ordem de importação]\n${tablesOrdered.join(' -> ')}`);

    // Se for reimportar do zero: TRUNCATE global (todas as tabelas de uma vez), com CASCADE
    let didGlobalTruncate = false;
    if (RESET && pgExisting.length) {
      console.log(`\n[RESET] TRUNCATE global em: ${pgExisting.join(', ')}`);
      await client.query('BEGIN');
      await client.query(`TRUNCATE TABLE ${pgExisting.map(ident).join(', ')} RESTART IDENTITY CASCADE`);
      await client.query('COMMIT');
      didGlobalTruncate = true;
    }

    for (const table of tablesOrdered) {
      // 1) Colunas do SQLite
      let colsSqlite = SCHEMA_OVERRIDES[table] || sqlite.prepare(`PRAGMA table_info(${ident(table)})`).all().map(c => c.name);

      if (!colsSqlite.length) continue;

      // 2) Colunas do Postgres (ordem por ordinal_position)
      const colsPg = await getPgColumns(client, table);

      // 3) Validação forte (1:1, mesma quantidade e nomes)
      if (!sameSet(colsSqlite, colsPg)) {
        console.error(`\n[SCHEMA MISMATCH] Tabela: ${table}`);
        console.error(`  SQLite : ${JSON.stringify(colsSqlite)}`);
        console.error(`  Postgres: ${JSON.stringify(colsPg)}\n`);
        throw new Error(`Esquema diferente entre SQLite e Postgres para tabela ${table}. Ajuste o initDb.js para ficar 1:1 e rode de novo.`);
      }

      const cols = colsSqlite; // a partir daqui, usamos exatamente as colunas do SQLite validadas

      // 4) Chaves para dedupe (PK; se não tiver, primeiro UNIQUE)
      const conflictCols = await getConflictColumns(client, table);
      if (conflictCols?.length) {
        console.log(`\n[${table}] dedupe ON CONFLICT (${conflictCols.join(', ')})`);
      } else {
        console.log(`\n[${table}] (sem PK/UNIQUE detectado — inserção simples)`);
      }

      const rowCount = sqlite.prepare(`SELECT COUNT(*) AS c FROM ${ident(table)}`).get().c;
      console.log(`[${table}] ${rowCount} registros…`);
      if (rowCount === 0) {
        await fixSequence(client, table);
        continue;
      }

            // 5) (caso especial) mapear UUIDs de grupos → ids inteiros no PG ANTES de importar 'lancamentos'
      let mapParcela = null;     // Map<chave, idInt>
      let mapRecorr = null;      // Map<chave, idInt>
      const idxParc = colsSqlite.indexOf('grupo_parcela_id');
      const idxRec  = colsSqlite.indexOf('grupo_recorrente_id');
      const idxUser = colsSqlite.indexOf('usuario_id');
      if (table === 'lancamentos' && (idxParc !== -1 || idxRec !== -1)) {
        mapParcela = new Map();
        mapRecorr  = new Map();

        // Distintos do SQLite (apenas os não numéricos)
        const uuidsParc = sqlite.prepare(`
          SELECT DISTINCT usuario_id, grupo_parcela_id AS gid
          FROM ${ident('lancamentos')}
          WHERE grupo_parcela_id IS NOT NULL AND TRIM(grupo_parcela_id) <> ''
        `).all().filter(r => isLikelyUuid(r.gid));

        const uuidsRec = sqlite.prepare(`
          SELECT DISTINCT usuario_id, grupo_recorrente_id AS gid
          FROM ${ident('lancamentos')}
          WHERE grupo_recorrente_id IS NOT NULL AND TRIM(grupo_recorrente_id) <> ''
        `).all().filter(r => isLikelyUuid(r.gid));

        // Cria grupos_parcelas para cada UUID distinto
        if (uuidsParc.length) {
          await client.query('BEGIN');
          for (const r of uuidsParc) {
            const key = `${r.usuario_id}::${r.gid}`;
            if (mapParcela.has(key)) continue;
            const nome = `Migrado ${String(r.gid).slice(0, 8)}`;
            const ins = await client.query(
              `INSERT INTO ${ident('grupos_parcelas')} (${ident('usuario_id')}, ${ident('nome')}, ${ident('total')})
               VALUES ($1,$2,NULL) RETURNING id`,
              [r.usuario_id, nome]
            );
            mapParcela.set(key, ins.rows[0].id);
          }
          await client.query('COMMIT');
        }

        // Cria grupos_recorrentes para cada UUID distinto
        if (uuidsRec.length) {
          await client.query('BEGIN');
          for (const r of uuidsRec) {
            const key = `${r.usuario_id}::${r.gid}`;
            if (mapRecorr.has(key)) continue;
            const nome = `Migrado ${String(r.gid).slice(0, 8)}`;
            const ins = await client.query(
              `INSERT INTO ${ident('grupos_recorrentes')} (${ident('usuario_id')}, ${ident('nome')})
               VALUES ($1,$2) RETURNING id`,
              [r.usuario_id, nome]
            );
            mapRecorr.set(key, ins.rows[0].id);
          }
          await client.query('COMMIT');
        }
        console.log(`[lancamentos] grupos criados de UUIDs: parcelas=${mapParcela.size} recorrentes=${mapRecorr.size}`);
      }

      // 6) Import em lotes
      const pageSize = 1000;
      const selectStmt = sqlite.prepare(`SELECT ${cols.map(c => ident(c)).join(', ')} FROM ${ident(table)} LIMIT ? OFFSET ?`);

      await client.query('BEGIN');
      // Se já fizemos TRUNCATE global, não precisamos truncar por tabela aqui.

      for (let offset = 0; offset < rowCount; offset += pageSize) {
        const rows = selectStmt.all(pageSize, offset);
        if (!rows.length) break;

        const conflictClause = (conflictCols && conflictCols.length)
          ? ` ON CONFLICT (${conflictCols.map(ident).join(',')}) DO NOTHING`
          : '';

        const batch = 200;
        for (let i = 0; i < rows.length; i += batch) {
          const chunk = rows.slice(i, i + batch);

          const params = [];
          const valuesClause = chunk.map(r => {
            // Copia valores e ajusta somente quando for tabela 'lancamentos'
            const vals = cols.map((c, pos) => {
              let v = (r[c] === undefined ? null : r[c]);
              if (table === 'lancamentos') {
                if (c === 'grupo_parcela_id') {
                  if (v == null || v === '') return null;
                  if (isNumeric(v)) return Number(v);
                  const key = `${r['usuario_id']}::${v}`;
                  return mapParcela && mapParcela.get(key) ? mapParcela.get(key) : null;
                }
                if (c === 'grupo_recorrente_id') {
                  if (v == null || v === '') return null;
                  if (isNumeric(v)) return Number(v);
                  const key = `${r['usuario_id']}::${v}`;
                  return mapRecorr && mapRecorr.get(key) ? mapRecorr.get(key) : null;
                }
              }
              return v;
            });
            params.push(...vals);
            const base = params.length - vals.length;
            return `(${vals.map((_, k) => `$${base + k + 1}`).join(',')})`;
          }).join(',');

          const sql = `INSERT INTO ${ident(table)} (${cols.map(ident).join(',')})
                       VALUES ${valuesClause}${conflictClause}`;

          await client.query(sql, params);
        }
      }
      await client.query('COMMIT');

      await fixSequence(client, table);
      console.log(`[${table}] OK`);
    }
  } catch (e) {
    console.error('Falha na migração:', e);
    process.exitCode = 1;
  } finally {
    try { await client.query("SET session_replication_role = 'origin'"); } catch {}
    client.release();
    await pool.end();
    sqlite.close();
  }
})();

// Calcula ordem topológica por FKs (pais → filhos) no schema public
async function computeImportOrder(client) {
  const { rows } = await client.query(`
    SELECT
      tc.table_name   AS child,
      ccu.table_name  AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
  `);

  const parentsOf = new Map();   // child -> Set(parent)
  const childrenOf = new Map();  // parent -> Set(child)
  const all = new Set();
  for (const r of rows) {
    const c = r.child, p = r.parent;
    all.add(c); all.add(p);
    if (!parentsOf.has(c)) parentsOf.set(c, new Set());
    if (!childrenOf.has(p)) childrenOf.set(p, new Set());
    parentsOf.get(c).add(p);
    childrenOf.get(p).add(c);
  }
  // inclui tabelas sem FK para entrarem na ordem
  const { rows: tables } = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
  for (const { tablename } of tables) all.add(tablename);

  // Kahn (topological sort)
  const inDegree = new Map();
  for (const t of all) inDegree.set(t, 0);
  for (const [child, ps] of parentsOf.entries()) {
    inDegree.set(child, (inDegree.get(child) || 0) + ps.size);
  }
  const queue = [];
  for (const t of all) if ((inDegree.get(t) || 0) === 0) queue.push(t);
  const order = [];
  while (queue.length) {
    const t = queue.shift();
    order.push(t);
    const kids = childrenOf.get(t);
    if (!kids) continue;
    for (const ch of kids) {
      inDegree.set(ch, inDegree.get(ch) - 1);
      if (inDegree.get(ch) === 0) queue.push(ch);
    }
  }
  return order;
}

async function getPgColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table]
  );
  return rows.map(r => r.column_name);
}

async function getConflictColumns(client, table) {
  // PRIMARY KEY
  let res = await client.query(
    `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name   = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position`,
    [table]
  );
  if (res.rowCount) return res.rows.map(r => r.column_name);

  // Primeiro UNIQUE
  res = await client.query(
    `SELECT kcu.constraint_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name   = $1
        AND tc.constraint_type = 'UNIQUE'
      ORDER BY kcu.constraint_name, kcu.ordinal_position`,
    [table]
  );
  if (!res.rowCount) return null;
  const first = res.rows[0].constraint_name;
  return res.rows.filter(r => r.constraint_name === first).map(r => r.column_name);
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const A = new Set(a), B = new Set(b);
  for (const k of A) if (!B.has(k)) return false;
  return true;
}

async function fixSequence(client, table) {
  // 1) só ajusta se existir coluna 'id' no destino
  const colsPg = await getPgColumns(client, table);
  if (!colsPg.includes('id')) return;

  // 2) tenta descobrir a sequence ligada ao 'id' (serial/identity)
  let seqRes;
  try {
    seqRes = await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [table]);
  } catch {
    return; // sem sequence (ou coluna não serial) → nada a fazer
  }
  const seq = seqRes?.rows?.[0]?.seq;
  if (!seq) return; // 'id' existe mas não tem sequence (não é SERIAL/IDENTITY)

  // 3) posiciona sequence no MAX(id) (ou 1 se vazio)
  const { rows: r2 } = await client.query(`SELECT MAX(id) AS max FROM ${ident(table)}`);
  const max = r2?.[0]?.max;
  if (max === null) {
    await client.query(`SELECT setval($1, 1, false)`, [seq]);
  } else {
    await client.query(`SELECT setval($1, $2, true)`, [seq, max]);
  }
}