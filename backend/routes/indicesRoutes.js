// backend/routes/indicesRoutes.js  (Postgres)
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth'); // 👉 seu autenticador padrão

// Utils
const dtBR = (d) => `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
const iso = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10);

// 👉 importa utilitários que já criamos em invest-helpers.js
const {
  weekdaysBetween,
  isBizDay,
  normTituloTesouro,
} = require('../utils/invest-helpers');

const isoUTC = (d) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10);

const toISO = (v) => {
  if (!v) return null;
  if (v instanceof Date) return isoUTC(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d) ? null : isoUTC(d);
};

// ontem em UTC (limite superior)
const ontemISO = () => {
  const hoje = new Date();
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// clamp do fim para ontem, e sanity‐check do intervalo
function normalizeRange(body) {
  const di = toISO(body?.inicio) || '2000-01-01';
  const fimReq = toISO(body?.fim);
  const oy = ontemISO();
  const df = (!fimReq || fimReq > oy) ? oy : fimReq;
  return { diISO: di, dfISO: df, oy };
}

 // ---- Helper p/ SGS (JSON público) ----
 function isoParaBR(iso) {
   const [y,m,d] = iso.split('-');
   return `${d}/${m}/${y}`;
 }
 async function getSgsRange(serieCode, diISO, dfISO, fetchImpl = fetch) {
   const diBR = isoParaBR(diISO);
   const dfBR = isoParaBR(dfISO);
   const url  = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serieCode}/dados?formato=json&dataInicial=${diBR}&dataFinal=${dfBR}`;
   const resp = await fetchImpl(url, { headers: { 'user-agent': 'SiteFinancas/1.0', 'accept': 'application/json' } });
   const raw  = await resp.text();
   if (!resp.ok) {
     console.error(`[SGS ${serieCode}] status=${resp.status} body=${raw.slice(0,180)}`);
     throw new Error(`SGS ${serieCode} retornou ${resp.status}`);
   }
   let json;
   try { json = JSON.parse(raw); }
   catch(e) {
     console.error(`[SGS ${serieCode}] erro parse body=${raw.slice(0,180)}`);
     throw e;
   }
   // Normaliza: { data: 'DD/MM/AAAA', valor: Number }
   return json.map(r => ({
     data: r.data,
     valor: Number(String(r.valor).replace(',', '.'))
   }));
 }

// 🔹 Sincroniza SELIC diária (SGS 11) no intervalo [inicio,fim]
router.post('/indices/selic/sync', auth, async (req, res) => {
  const { diISO, dfISO, oy } = normalizeRange(req.body);

  if (!diISO || !dfISO || diISO > dfISO) {
    return res.json({ ok: true, registros: 0 });
  }

  try {
    const r = await fetch('https://api.bcb.gov.br/dados/…/selic?...', { /* teus headers/options */ })
      .catch(() => null);

    let arr = [];
    if (r && r.ok) {
      const j = await r.json().catch(() => null);
      if (Array.isArray(j)) arr = j;
      if (!arr.length && Array.isArray(j?.items)) arr = j.items;
    }
    arr = Array.isArray(arr) ? arr : [];

    const diasUteis = new Set(weekdaysBetween(diISO, dfISO));
    const rows = arr
      .map(it => {
        const data = toISO(it.data || it.Date || it.date);
        const v = Number(String(it.valor ?? it.Value ?? it.value ?? 0).toString().replace(',', '.'));
        return { data, valor: Number.isFinite(v) ? v : null };
      })
      .filter(it => it.data && diasUteis.has(it.data) && it.valor != null);

    if (!rows.length) return res.json({ ok: true, registros: 0 });

    const sql = `
      INSERT INTO indices_selic_diaria (data, valor)
      VALUES ($1::date, $2::numeric)
      ON CONFLICT (data) DO UPDATE SET valor = EXCLUDED.valor
    `;
    let inserted = 0;
    for (const it of rows) {
      await db.query(sql, [it.data, it.valor]);
      inserted++;
    }

    return res.json({ ok: true, registros: inserted });
  } catch (e) {
    console.error('[ROTA] /indices/selic/sync erro:', e);
    return res.status(200).json({ ok: false, registros: 0, erro: 'fetch/insert' });
  }
});


// ?? Upsert de PU (Tesouro Direto) — subir planilha/integração
// body: { registros: [{ data:'YYYY-MM-DD', nome:'Tesouro IPCA+ 2035', pu: 3451.23 }, ...] }
router.post('/indices/tesouro/pu/upsert', auth, async (req, res) => {
  try {
    const arr = Array.isArray(req.body?.registros) ? req.body.registros : [];
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const r of arr) {
        const data = String(r.data||'').slice(0,10);
        const nome = normTituloTesouro(String(r.nome||'').trim());
        const pu   = Number(r.pu);
        const puCompra = (r.pu_compra != null) ? Number(r.pu_compra) : null;
        if (!data || !nome || !isFinite(pu)) continue;
        await client.query(`DELETE FROM indices_tesouro_pu WHERE data=$1 AND nome=$2`, [data, nome]);
        await client.query(
          `INSERT INTO indices_tesouro_pu (data, nome, pu, pu_compra)
             VALUES ($1,$2,$3,$4)`,
          [data, nome, pu, puCompra]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok:true, registros: arr.length });
  } catch (e) {
    console.error('[PU upsert] erro:', e);
    res.status(500).json({ ok:false, erro:'Falha ao salvar PU Tesouro' });
  }
});

// ?? Consulta PU por período
// query: ?nome=Tesouro%20IPCA%2B%202035&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
router.get('/indices/tesouro/pu', auth, async (req, res) => {
  try {
    const { nome, inicio, fim } = req.query||{};
    if (!nome || !inicio || !fim) return res.status(400).json({ ok:false, erro:'Informe nome, inicio e fim' });

    const nomeReq  = String(nome).trim();
    const nomeNorm = normTituloTesouro(nomeReq);
    const likeReq        = `%${nomeReq}%`;
    const likeNorm       = `%${nomeNorm}%`;
    const likeLooseReq   = `%${nomeReq.split(/\s+/).filter(Boolean).join('%')}%`;
    const likeLooseNorm  = `%${nomeNorm.split(/\s+/).filter(Boolean).join('%')}%`;

    const { rows } = await db.query(
      `SELECT to_char((data)::date, 'YYYY-MM-DD') AS data,
              MAX(pu) AS pu,
              MAX(pu_compra) AS pu_compra
         FROM indices_tesouro_pu
        WHERE (nome = $1 OR nome = $2 OR nome ILIKE $3 OR nome ILIKE $4 OR nome ILIKE $5 OR nome ILIKE $6)
          AND (data)::date BETWEEN $7::date AND $8::date
        GROUP BY (data)::date
        ORDER BY (data)::date ASC`,
      [nomeReq, nomeNorm, likeReq, likeNorm, likeLooseReq, likeLooseNorm, String(inicio), String(fim)]
    );
    res.json({ ok:true, items: rows || [] });
  } catch (e) {
    res.status(500).json({ ok:false, erro:String(e?.message||e) });
  }
});

// DEBUG: retorna contagem de linhas na tabela e amostra (sem refatorar nada)
router.get('/indices/tesouro/pu/debug/peek', auth, async (req, res) => {
  try {
    const { nome, inicio, fim, limit = 3 } = req.query || {};
    const cQ = await db.query(`SELECT COUNT(*)::int AS c FROM indices_tesouro_pu`);
    const count = cQ.rows?.[0]?.c || 0;

    let items = [];
    if (nome && inicio && fim) {
      const { rows } = await db.query(
        `SELECT to_char((data)::date,'YYYY-MM-DD') AS data, nome, pu
           FROM indices_tesouro_pu
          WHERE nome IN ($1,$2)
            AND (data)::date BETWEEN $3::date AND $4::date
          ORDER BY data
          LIMIT $5`,
        [String(nome).trim(), String(nome).trim(), String(inicio), String(fim), Number(limit)||3]
      );
      items = rows || [];
    }
    res.json({ ok:true, table_count: count, sample: items });
  } catch (e) {
    res.status(500).json({ ok:false, erro: String(e?.message||e) });
  }
});

// 🔹 Sincroniza IPCA mensal (SGS 433) no intervalo de competências [inicio,fim] (datas ISO; basta ano-mês)
router.post('/indices/ipca/sync', auth, async (req, res) => {
  const { diISO, dfISO } = normalizeRange(req.body);
  // aqui tanto faz FDS, mas seguimos clamp e sanity‐check
  if (!diISO || !dfISO || diISO > dfISO) {
    return res.json({ ok: true, registros: 0 });
  }

  try {
    const r = await fetch('https://api.bcb.gov.br/dados/…/ipca_mensal?...', { /* headers */ })
      .catch(() => null);

    let arr = [];
    if (r && r.ok) {
      const j = await r.json().catch(() => null);
      if (Array.isArray(j)) arr = j;
      if (!arr.length && Array.isArray(j?.items)) arr = j.items;
    }
    arr = Array.isArray(arr) ? arr : [];

    // normaliza para { competencia: 'YYYY-MM', valor: number }
    const rows = arr
      .map(it => {
        const data = toISO(it.data || it.date || it.referencia || it.competencia);
        if (!data) return null;
        const ym = data.slice(0, 7);
        const v = Number(String(it.valor ?? it.Value ?? it.value ?? 0).toString().replace(',', '.'));
        return v == null || isNaN(v) ? null : { competencia: ym, valor: v };
      })
      .filter(Boolean);

    if (!rows.length) return res.json({ ok: true, registros: 0 });

    const sql = `
      INSERT INTO indices_ipca_mensal (competencia, valor)
      VALUES ($1::text, $2::numeric)
      ON CONFLICT (competencia) DO UPDATE SET valor = EXCLUDED.valor
    `;
    let inserted = 0;
    for (const it of rows) {
      await db.query(sql, [it.competencia, it.valor]);
      inserted++;
    }

    return res.json({ ok: true, registros: inserted });
  } catch (e) {
    console.error('[ROTA] /indices/ipca/sync erro:', e);
    return res.status(200).json({ ok: false, registros: 0, erro: 'fetch/insert' });
  }
});

// 🔹 Sincroniza CDI diária (SGS 12) no intervalo [inicio,fim]
router.post('/indices/cdi/sync', auth, async (req, res) => {
  const { diISO, dfISO, oy } = normalizeRange(req.body);

  // intervalo inválido => nada a fazer (evita RangeError / toISOString em datas inválidas)
  if (!diISO || !dfISO || diISO > dfISO) {
    return res.json({ ok: true, registros: 0 });
  }

  try {
    // Chama o fetch que você já usa (Bacen/serviço interno). Mantém a tua URL original:
    const r = await fetch('https://api.bcb.gov.br/dados/…/cdi?...', { /* teus headers/options */ })
      .catch(() => null);

    // Se falhar ou vier 404, trata como vazio
    let arr = [];
    if (r && r.ok) {
      const j = await r.json().catch(() => null);
      // aceita array do Bacen no formato [{data:"2025-09-24", valor: "0,12"}]
      if (Array.isArray(j)) arr = j;
      // se teu backend já normaliza, também aceita {items:[...]}
      if (!arr.length && Array.isArray(j?.items)) arr = j.items;
    }

    // Protege contra “(arr || []) is not iterable”
    arr = Array.isArray(arr) ? arr : [];

    // Mantém só dias úteis dentro de [diISO..dfISO]
    const diasUteis = new Set(weekdaysBetween(diISO, dfISO));
    const rows = arr
      .map(it => {
        const data = toISO(it.data || it.Date || it.date);
        // valor pode vir como "0,12"
        const v = Number(String(it.valor ?? it.Value ?? it.value ?? 0).toString().replace(',', '.'));
        return { data, valor: Number.isFinite(v) ? v : null };
      })
      .filter(it => it.data && diasUteis.has(it.data) && it.valor != null);

    if (!rows.length) return res.json({ ok: true, registros: 0 });

    // Insere de forma idempotente (sem estourar a PK): atualiza se já existir
    const sql = `
      INSERT INTO indices_cdi_diaria (data, valor)
      VALUES ($1::date, $2::numeric)
      ON CONFLICT (data) DO UPDATE SET valor = EXCLUDED.valor
    `;
    let inserted = 0;
    for (const it of rows) {
      await db.query(sql, [it.data, it.valor]);
      inserted++;
    }

    return res.json({ ok: true, registros: inserted });
  } catch (e) {
    // 200 com zero evita quebrar quem chama esse endpoint
    return res.status(200).json({ ok: false, registros: 0, erro: 'fetch/insert' });
  }
});

// ------------------- PEEK / DEBUG -------------------
router.get('/indices/cdi/peek', auth, async (req, res) => {
  try {
    const rMax = await db.query(`SELECT MAX((data)::date) AS max FROM indices_cdi_diaria`);
    const rCnt = await db.query(`SELECT COUNT(*)::int AS n FROM indices_cdi_diaria`);
    res.json({ ok:true, ultima: rMax.rows?.[0]?.max || null, linhas: rCnt.rows?.[0]?.n || 0 });
  } catch (e) {
    res.status(500).json({ ok:false, erro:String(e?.message||e) });
  }
});
router.get('/indices/selic/peek', async (req, res) => {
  try {
    const rMax = await db.query(`SELECT MAX((data)::date) AS max FROM indices_selic_diaria`);
    const rCnt = await db.query(`SELECT COUNT(*)::int AS n FROM indices_selic_diaria`);
    res.json({ ok:true, ultima: rMax.rows?.[0]?.max || null, linhas: rCnt.rows?.[0]?.n || 0 });
  } catch (e) {
    res.status(500).json({ ok:false, erro:String(e?.message||e) });
  }
});

// === [NOVO] Sync automático de PU Tesouro Direto a partir do CKAN (Tesouro Transparente) ===
// Fonte oficial (CSV diário): https://www.tesourotransparente.gov.br/ckan/.../precotaxatesourodireto.csv
// Preferimos "PU Venda Tarde" (mark-to-market), com fallbacks se não existir.
// === SUBSTITUIR TODA A ROTA /indices/tesouro/pu/sync-auto POR ESTE BLOCO ===
// === [NOVO] Sync automático de PU Tesouro Direto a partir do CKAN (Tesouro Transparente) ===
router.post('/indices/tesouro/pu/sync-auto', auth, async (req, res) => {
  // CSV oficial diário
  const CSV_URL = 'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv';

  // util local já existente no mesmo arquivo
  const toISOlocal = (v) => {
    if (!v) return null;
    if (v instanceof Date) return iso(v);
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d) ? null : iso(d);
  };

  try {
    // ===== 1) Entrada
    let { inicio, fim, alvos, nomes, vencimentos } = req.body || {};
    const inicioISO = toISOlocal(inicio) || '2000-01-01';
    const fimISO    = toISOlocal(fim)    || iso(new Date());

    // targets: [{ nomeNorm, vencISO|null }]
    let targets = [];
    if (Array.isArray(alvos) && alvos.length) {
      targets = alvos
        .map(a => ({
          nomeNorm: normTituloTesouro(String(a?.nome || '')),
          vencISO : toISOlocal(a?.vencimento) || null
        }))
        .filter(t => t.nomeNorm);
    } else if (Array.isArray(nomes) && nomes.length) {
      const vArr = Array.isArray(vencimentos) ? vencimentos : [];
      targets = nomes.map((n, i) => ({
        nomeNorm: normTituloTesouro(String(n || '')),
        vencISO : toISOlocal(vArr[i]) || null
      })).filter(t => t.nomeNorm);
    }
    // se não mandar nada, não filtra por nome (mas normalmente o helper manda)
    const temFiltroNome = targets.length > 0;

    // conjunto de vencimentos informados (se vieram)
const allowedVencs = new Set(targets.map(t => t.vencISO).filter(Boolean));

// nomes genéricos no CSV que SEMPRE exigem vencimento para não misturar séries
const needsVenc = (n) =>
  /^Tesouro\s+Renda\+$/i.test(n) ||
  /^Tesouro\s+IPCA\+$/i.test(n) ||
  /^Tesouro\s+Prefixado$/i.test(n) ||
  /^Tesouro\s+Educa\+$/i.test(n);

    // ===== 2) Baixa CSV
    const r = await fetch(CSV_URL);
    if (!r.ok) {
      return res.status(502).json({ ok:false, erro:`Falha HTTP ${r.status} ao baixar CSV` });
    }
    const csv = await r.text();

    // ===== 3) Header / índices
    const linhas = csv.split(/\r?\n/).filter(l => /\S/.test(l));
    if (!linhas.length) return res.json({ ok:true, gravados:0, motivo:'csv_vazio' });

    const firstLine = linhas[0];
    const delim = firstLine.includes(';') ? ';' : ',';
    const header = firstLine.split(delim).map(h => h.trim().replace(/\uFEFF/g, ''));

    const idxNome = header.findIndex(h => /^tipo\s*t[ií]tulo$/i.test(h));
    const idxVenc = header.findIndex(h => /^data\s*venc/i.test(h));
    const idxData = header.findIndex(h => /^data\s*base$/i.test(h));
  // PU de marcação (preferimos Venda Manhã/Tarde; fallback Base)
  let idxPU = header.findIndex(h => /^pu\s*venda\s*manh/i.test(h));
  if (idxPU < 0) idxPU = header.findIndex(h => /^pu\s*venda\s*tarde/i.test(h));
  if (idxPU < 0) idxPU = header.findIndex(h => /^pu\s*base/i.test(h));

  // PU de COMPRA (Manhã/Tarde), usado para derivar QTD na compra
  let idxPUC = header.findIndex(h => /^pu\s*compra\s*manh/i.test(h));
  if (idxPUC < 0) idxPUC = header.findIndex(h => /^pu\s*compra\s*tarde/i.test(h));
  // se não existir no CSV, deixamos null e cairemos para 'pu'

    if (idxNome < 0 || idxData < 0 || idxPU < 0) {
      return res.status(422).json({ ok:false, erro:'Cabeçalho inesperado do CSV' });
    }

    // ===== 4) Varredura + filtros + logs finos
    let tot = 0, matchNome = 0, matchNomeVenc = 0, outRange = 0, invalidPU = 0;
    const amostraPassou = new Set();
    const amostraFalhouVenc = new Set();

    const client = await db.connect();
    let gravados = 0;
    try {
      await client.query('BEGIN');

      for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(delim);
        if (cols.length <= Math.max(idxNome, idxData, idxPU)) continue;
        tot++;

        const nomeBruto = (cols[idxNome] || '').trim();
        const nomeNorm  = normTituloTesouro(nomeBruto);
        if (!nomeNorm) continue;

        // data base dd/mm/aaaa -> ISO
        const dataBruta = (cols[idxData] || '').trim();
        const [d, m, y] = dataBruta.split('/').map(s => s && s.trim());
        const dataISO   = (d && m && y) ? `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : null;
        if (!dataISO || dataISO < inicioISO || dataISO > fimISO) { outRange++; continue; }

        // vencimento dd/mm/aaaa -> ISO (se existir coluna)
        let vencISO = null;
        if (idxVenc >= 0) {
          const vencBruta = (cols[idxVenc] || '').trim();
          const [dv, mv, yv] = vencBruta.split('/').map(s => s && s.trim());
          vencISO = (dv && mv && yv) ? `${yv}-${mv.padStart(2,'0')}-${dv.padStart(2,'0')}` : null;
        }

        // PU numérico
        const puStr = String(cols[idxPU] || '').replace(/\./g, '').replace(',', '.').trim();
        const pu = Number(puStr);
        if (!Number.isFinite(pu) || pu <= 0) { invalidPU++; continue; }

        let puCompra = null;
        if (idxPUC >= 0 && cols[idxPUC] != null) {
          const puCStr = String(cols[idxPUC]).replace(/\./g, '').replace(',', '.').trim();
          const puC = Number(puCStr);
          if (Number.isFinite(puC) && puC > 0) puCompra = puC;
        }        

// Filtro por nome / vencimento (quando targets vieram)
// Observação:
//  - títulos genéricos do CSV ("Tesouro Renda+", "Tesouro IPCA+", "Tesouro Prefixado", "Tesouro Educa+")
//    SEMPRE exigem vencimento para não misturar séries distintas.
//  - se o caller informou algum(s) vencimento(s) em "alvos"/"vencimentos", só aceitamos esses exatos.
let nomeSalvar = nomeNorm; // <- por padrão, usa o nome do CSV
if (temFiltroNome) {
  const mustHaveVenc = needsVenc(nomeNorm) || allowedVencs.size > 0;
  let passou = false;
  let matchedFromTarget = null; // <- quando casar, vamos usar o nome do target (ex.: "Tesouro Renda+ 2065")

  for (const t of targets) {
    const nomeOK =
      (nomeNorm === t.nomeNorm) ||
      t.nomeNorm.includes(nomeNorm) ||
      nomeNorm.includes(t.nomeNorm);
    if (!nomeOK) continue;

    if (mustHaveVenc) {
      if (allowedVencs.size === 0) {
        // nome é genérico e não recebemos vencimento => não arriscamos misturar séries
        continue;
      }
      // nome bateu e temos ao menos um vencimento permitido -> exige match exato
      if (vencISO && allowedVencs.has(vencISO)) {
        passou = true;
        matchedFromTarget = t.nomeNorm; // usa o nome recebido no alvo (com ano)
        break;
      } else {
        amostraFalhouVenc.add(`${nomeNorm} | vencCSV=${vencISO || '-'} vs allow=${Array.from(allowedVencs).join(',')}`);
        continue;
      }
    } else {
      // nome específico (não genérico) e caller não exigiu vencimento
      passou = true;
      matchedFromTarget = t.nomeNorm;
      break;
    }
  }

  if (!passou) continue;

  // Se casou com um target, SALVA usando o nome do target (com ano)
  if (matchedFromTarget) nomeSalvar = normTituloTesouro(matchedFromTarget);

  matchNome++;
  if (mustHaveVenc) matchNomeVenc++;
  if (amostraPassou.size < 8) amostraPassou.add(`${nomeSalvar} | venc=${vencISO || '-'}`);
}

// UPSERT (data, nome) — grava com nomeSalvar e ambos os PUs
await client.query(
  `INSERT INTO indices_tesouro_pu (data, nome, pu, pu_compra)
     VALUES ($1,$2,$3,$4)
   ON CONFLICT (data, nome)
   DO UPDATE SET
     pu = EXCLUDED.pu,
     pu_compra = COALESCE(EXCLUDED.pu_compra, indices_tesouro_pu.pu_compra)`,
  [dataISO, nomeSalvar, pu, puCompra]
);
        gravados++;
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Erro /indices/tesouro/pu/sync-auto:', e);
      return res.status(500).json({ ok:false, erro:String(e?.message || e) });
    } finally {
      client.release();
    }

    return res.json({
      ok: true,
      range: { inicio: inicioISO, fim: fimISO },
      totalCSV: tot,
      outRange,
      invalidPU,
      matchNome,
      matchNomeVenc,
      gravados
    });
  } catch (err) {
    console.error('Erro /indices/tesouro/pu/sync-auto:', err);
    return res.status(500).json({ ok:false, erro:String(err?.message || err) });
  }
});

module.exports = router;