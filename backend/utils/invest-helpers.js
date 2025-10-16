'use strict';
// 🔹 Utilitários compartilhados p/ investimentos (Node + Postgres)

// db.query = pool.query (pg)
const db = require('../database/db');

// Base do próprio backend (usa env se houver)
const BACKEND_BASE =
  process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;

// Monta headers de auth quando existir token do usuário
const withAuth = (authHeader) =>
  authHeader ? { Authorization: authHeader } : {};

// -------------------- Datas & normalização --------------------
// 🔧 Toggles de trace/log (baixo ruído por padrão)
const TRACE_FLOW = false;          // logs de fluxo/dia (desligado)
const TRACE_MISS_PRICE = false;     // 1x por ativo quando houver posição e faltar preço
const TRACE_COVERAGE = false;       // mapas/resumos de cobertura (ligado
const TRACE_TESOURO_VAL = false;    // pode desligar depois que validarmos)
const dateInt = (s) => Number(String(s).slice(0, 10).replace(/-/g, ''));
const iso = (d) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
function isWeekend(d) {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}
// m: 1..12 (5 => Maio, 11 => Novembro)  -> Date.UTC usa mês 0..11, mas com "dia 0" pegamos o último dia do mês anterior de (m)
function lastBusinessDayOfMonthUTC(y, m) {
  const d = new Date(Date.UTC(y, m, 0));
  while (isWeekend(d)) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
function addDaysISO(isoStr, days) {
  if (!isoStr) return null;
  const d = new Date(isoStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}
const diasEntre = (aISO, bISO) =>
  Math.max(
    0,
    Math.ceil(
      (new Date(bISO + 'T00:00:00Z') - new Date(aISO + 'T00:00:00Z')) /
        86400000
    )
  );
function isBizDay(isoStr) {
  const d = new Date(isoStr + 'T00:00:00Z');
  const wd = d.getUTCDay();
  return wd >= 1 && wd <= 5;
}
function prevTrading(datesSet, isoStr) {
  let best = null;
  for (const d of datesSet) if (d < isoStr && (!best || d > best)) best = d;
  return best;
}
function nextTrading(datesSet, isoStr) {
  let best = null;
  for (const d of datesSet) if (d > isoStr && (!best || d < best)) best = d;
  return best;
}
function weekdaysBetween(startISO, endISO) {
  const out = [];
  if (!startISO || !endISO) return out;
  let d = new Date(startISO + 'T00:00:00Z');
  const e = new Date(endISO + 'T00:00:00Z');
  while (d <= e) {
    const wd = d.getUTCDay();
    if (wd >= 1 && wd <= 5) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
function rangeFromPeriodo(periodo = 'ano') {
  const today = new Date();
  const end = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
  let start;
  if (periodo === '12m') {
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 365);
  } else if (periodo === '24m') {
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 730);
  } else if (periodo === 'inicio') {
    start = new Date(Date.UTC(2000, 0, 1));
  } else {
    start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  }
  const to = (d) => d.toISOString().slice(0, 10);
  return { startISO: to(start), endISO: to(end) };
}
function calcularRentabilidade(atual, base) {
  if (!base || base === 0) return null;
  return ((atual - base) / base) * 100;
}

 function normTituloTesouro(nome) {
   let s = String(nome || '')
     .normalize('NFKD')
     .replace(/[\u0300-\u036f]/g, '')      // remove acentos
     .replace(/\s+/g, ' ')                 // espaços únicos
     .trim();
   if (!s) return '';
   if (!/^Tesouro\s/i.test(s)) s = `Tesouro ${s}`;
   s = s.replace(/\bAposentadoria\s+Extra\b/gi, '').trim();
   s = s.replace(/\b(IPCA|Renda|Educa)\s*(\+|Mais)\b/gi, (_, t) => `${t}+`);
   s = s.replace(/\s{2,}/g, ' ').trim();
   return s;
 }
function comeCotasBetween(diISO, dfISO) {
  const out = [],
    di = new Date(diISO + 'T00:00:00Z'),
    df = new Date(dfISO + 'T00:00:00Z');
  for (let y = di.getUTCFullYear(); y <= df.getUTCFullYear(); y++) {
    for (const m of [5, 11]) {
      const d = lastBusinessDayOfMonthUTC(y, m);
      if (d >= di && d <= df) out.push(d.toISOString().slice(0, 10));
    }
  }
  return out;
}

// -------------------- Fatores / Índices (CDI, SELIC, IPCA, Pré) --------------------
const fatorPRE = (taxaAA, dias, base = 252) => {
  const t = Number(taxaAA) || 0;
  const b = Number(base || 252);
  const dd = Number(dias || 0);
  const f = Math.pow(1 + t, dd / b);
  return Number.isFinite(f) && f > 0 ? f : 1;
};

async function ensureCDI(inicioISO, fimISO, opt = {}) {
  const rMax = await db.query(
    `SELECT MAX((data)::date) AS d FROM indices_cdi_diaria WHERE (data)::date <= $1::date`,
    [fimISO]
  );
  const max = rMax.rows?.[0]?.d ? new Date(rMax.rows[0].d) : null;
  const maxISO = max
    ? new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth(), max.getUTCDate()))
        .toISOString().slice(0, 10)
    : null;
  const start = maxISO
    ? new Date(new Date(maxISO + 'T00:00:00Z').getTime() + 86400000)
        .toISOString()
        .slice(0, 10)
    : inicioISO;

  const before = (await db.query(
    `SELECT COUNT(*)::int AS n FROM indices_cdi_diaria WHERE (data)::date BETWEEN $1::date AND $2::date`,
    [start, fimISO]
  )).rows?.[0]?.n || 0;

  try {
    const r = await fetch(`${BACKEND_BASE}/indices/cdi/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...withAuth(opt.authHeader) },
      body: JSON.stringify({ inicio: start, fim: fimISO })
    });
    const j = await r.json().catch(() => null);
    const after = (await db.query(
      `SELECT COUNT(*)::int AS n FROM indices_cdi_diaria WHERE (data)::date BETWEEN $1::date AND $2::date`,
      [start, fimISO]
    )).rows?.[0]?.n || 0;
  } catch (e) {
  }
  return true;
}

async function produtoCDIEntre(di, df) {
  if (!di || !df || String(di) > String(df)) return 1;
  const { rows } = await db.query(
    `SELECT valor FROM indices_cdi_diaria WHERE (data)::date BETWEEN $1::date AND $2::date ORDER BY (data)::date ASC`,
    [di, df]
  );
  let prod = 1;
  for (const r of rows || []) {
    const v = Number(String(r.valor).toString().replace(',', '.'));
    const step = 1 + (Number.isFinite(v) ? v / 100 : 0);
    prod *= step > 0 ? step : 1;
  }
  return Number.isFinite(prod) && prod > 0 ? prod : 1;
}
async function ensureSelic(inicioISO, fimISO, opt = {}) {
  const rMax = await db.query(
    `SELECT MAX((data)::date) AS d FROM indices_selic_diaria WHERE (data)::date <= $1::date`,
    [fimISO]
  );
  const max = rMax.rows?.[0]?.d ? new Date(rMax.rows[0].d) : null;
  const maxISO = max
    ? new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth(), max.getUTCDate()))
        .toISOString()
        .slice(0, 10)
    : null;
  const start = maxISO
    ? new Date(new Date(maxISO + 'T00:00:00Z').getTime() + 86400000)
        .toISOString()
        .slice(0, 10)
    : inicioISO;

  if (maxISO && maxISO >= fimISO) {
    return true;
  }

  const before = (await db.query(
    `SELECT COUNT(*)::int AS n FROM indices_selic_diaria WHERE (data)::date BETWEEN $1::date AND $2::date`,
    [start, fimISO]
  )).rows?.[0]?.n || 0;

  try {
    const r = await fetch(`${BACKEND_BASE}/indices/selic/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...withAuth(opt.authHeader) },
      body: JSON.stringify({ inicio: start, fim: fimISO })
    });
    const j = await r.json().catch(() => null);
    const after = (await db.query(
      `SELECT COUNT(*)::int AS n FROM indices_selic_diaria WHERE (data)::date BETWEEN $1::date AND $2::date`,
      [start, fimISO]
    )).rows?.[0]?.n || 0;
  } catch (e) {
    console.warn('[ensureSelic] falha no fetch:', e?.message || e);
  }
  return true;
}

async function produtoSelicEntre(di,df){
  const { rows } = await db.query(
    `SELECT valor FROM indices_selic_diaria WHERE (data)::date BETWEEN $1::date AND $2::date ORDER BY (data)::date ASC`,
    [di, df]
  );
  let p = 1;
  for (const r of rows || []) {
    const v = Number(r.valor);
    if (isFinite(v)) p *= 1 + v / 100;
  }
  return p;
}

async function fatorIPCAmais(rRealAA, di, df) {
  const s = new Date(di + 'T00:00:00Z'),
    e = new Date(df + 'T00:00:00Z');
  const yms = [];
  const c = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
  const l = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), 1));
  while (c <= l) {
    yms.push(
      `${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, '0')}`
    );
    c.setUTCMonth(c.getUTCMonth() + 1, 1);
  }
  let { rows } = await db.query(
    `SELECT competencia, valor FROM indices_ipca_mensal WHERE competencia = ANY($1::text[])`,
    [yms]
  );
  if ((rows || []).length < yms.length) {
    const ini = `${yms[0]}-01`,
      fim = `${yms[yms.length - 1]}-28`;
    try {
await fetch(`${BACKEND_BASE}/indices/ipca/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ inicio: ini, fim })
});
      const re = await db.query(
        `SELECT competencia, valor FROM indices_ipca_mensal WHERE competencia = ANY($1::text[])`,
        [yms]
      );
      rows = re.rows;
    } catch {}
  }
  let p = 1;
  for (const ym of yms) {
    const it = rows.find((x) => x.competencia === ym);
    const v = it ? Number(String(it.valor).toString().replace(',', '.')) : 0;
    const ff = 1 + (Number.isFinite(v) ? v / 100 : 0);
    p *= ff > 0 ? ff : 1;
  }
  const r = Number(String(rRealAA || 0).toString().replace(',', '.')) || 0;
  const extra = fatorPRE(r, diasEntre(di, df) % 30, 252);
  p *= extra;
  return Number.isFinite(p) && p > 0 ? p : 1;
}

// -------------------- Tesouro & RF (valor na data) --------------------
async function ensureTesouroPU(alvo, inicioISO, fimISO, opt = {}) {
  // aceita string (nome) ou objeto { nome, vencimento }
  const nome = typeof alvo === 'string' ? alvo : String(alvo?.nome || '');
  const venc = typeof alvo === 'object' && alvo?.vencimento
    ? String(alvo.vencimento).slice(0, 10)
    : '';

  const getStatus = async (base) => {
    const qsVenc = opt?.vencimento ? `&vencimento=${encodeURIComponent(opt.vencimento)}` : '';
    const url = `${base}/tesouro/pu?nome=${encodeURIComponent(nome)}&inicio=${encodeURIComponent(inicioISO)}&fim=${encodeURIComponent(fimISO)}${qsVenc}`;
    const r = await fetch(url, { headers: { ...withAuth(opt.authHeader) } });
    const j = await r.json().catch(() => null);
    const items = Array.isArray(j?.items) ? j.items : [];
    let maxISO = null;
    for (const it of items) {
      const d = String(it.data || '');
      if (d && (!maxISO || d > maxISO)) maxISO = d;
    }
    return { items, maxISO };
  };
  // Tenta /indices e raiz; só considera “ok” se cobrir até fimISO
  for (const base of [`${BACKEND_BASE}/indices`, BACKEND_BASE]) {
    const { items, maxISO } = await getStatus(base);
    if (items.length && maxISO && maxISO >= fimISO) return true;
    // não cobre até o fim -> força sync
    try {
      const body = venc
        ? { inicio: inicioISO, fim: fimISO, alvos: [{ nome, vencimento: venc }] }
        : { inicio: inicioISO, fim: fimISO, nomes: [nome] };
      await fetch(`${base}/tesouro/pu/sync-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...withAuth(opt.authHeader) },
        body: JSON.stringify(body),
      });
    } catch {}
    // revalida
    const again = await getStatus(base);
    if (again.items.length && again.maxISO && again.maxISO >= fimISO) return true;
  }
  return true;
}

async function valorRFnaData(cfg, flows, alvoISO, overrideManual, ctx = {}) {
  const num = (x) => {
    const n = Number(String(x ?? 0).toString().replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  if (overrideManual != null) return Number(overrideManual) || 0;

  const toISO = (v) => {
    if (!v) return null;
    if (v instanceof Date) return iso(v);
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d)) return iso(d);
    return s.slice(0, 10);
  };

  const alvo = toISO(alvoISO);
  if (!Array.isArray(flows) || !flows.length) return 0;
  flows = flows
    .map((f) => ({ ...f, data: toISO(f.data) }))
    .filter((f) => f.data && f.data <= alvo)
    .sort((a, b) => a.data.localeCompare(b.data));
  if (!flows.length) return 0;

  // Tesouro Direto por PU
  {
    const nomeAtivo = String(cfg?.nome_investimento || cfg?.nome || '');
    const sub = String(cfg?.subcategoria || '');
    const ehTesouro = /tesouro/i.test(sub) || /^TESOURO\s/.test(nomeAtivo.toUpperCase());
    if (ehTesouro) {
      try {
const titulo = normTituloTesouro(nomeAtivo);
// pega a primeira DATA DE COMPRA do ativo para não importar PU anterior
let firstBuyISO = null;
for (const f of flows) {
  const vt = Math.abs(num(f.valor_total));
  const isSell =
    f.sinal != null
      ? Number(f.sinal) < 0
      : /vend|sell|resgat|saida|saída|leilao|leilão/i.test(String(f.tipo || ''));
  if (vt > 0 && !isSell) { firstBuyISO = String(f.data); break; }
}
const iniISO = firstBuyISO || flows[0].data; // sem -45 dias
const venc = toISO(cfg?.vencimento); // usado só para escolher o título certo no CSV
await ensureTesouroPU({ nome: titulo, vencimento: venc }, iniISO, alvo, { authHeader: ctx?.authHeader });
        // monta aliases para aceitar as mesmas variações da rota GET/CSV
        const tipoOnly = String(titulo).replace(/\s+\d{4}$/, '').trim();
        const anoVenc = (venc && /^\d{4}-\d{2}-\d{2}$/.test(venc))
          ? venc.slice(0, 4)
          : (titulo.match(/\b(20\d{2})\b/)?.[1] || null);

        const aliases = Array.from(new Set([
          // normalizado com ano (ex.: "Tesouro Renda+ 2065")
          titulo,
          // apenas tipo + ano do vencimento (o CSV vem como "Tesouro Renda+" + vencimento separado)
          `${tipoOnly} ${anoVenc || ''}`.trim(),
          // normalizado a partir do nome original do cadastro
          normTituloTesouro(nomeAtivo),
          // nome original levemente normalizado (removendo "Aposentadoria Extra" e trocando "Mais"->"+")
          String(nomeAtivo).trim()
            .replace(/\bRenda\s+Mais\b/gi, 'Renda+')
            .replace(/\bAposentadoria Extra\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim(),
        ])).filter(Boolean).map(a => `%${a}%`);

        let sql =
          `SELECT (data)::date AS data, pu, pu_compra
             FROM indices_tesouro_pu
            WHERE nome ILIKE ANY($1)
              AND (data)::date <= $2::date
            ORDER BY (data)::date ASC`;
        const params = [aliases, alvo];
        const { rows: puRows } = await db.query(sql, params);
        const getPUOnOrBefore = (isoD, preferCompra = false) => {
          let v = null, origem = null;
          for (const r of puRows) {
            const d = String(r.data);
            if (d <= isoD) {
              const cand = preferCompra && r.pu_compra ? Number(r.pu_compra) : Number(r.pu);
              if (Number.isFinite(cand) && cand > 0) {
                v = cand;
                origem = (preferCompra && r.pu_compra) ? 'PU_COMPRA' : 'PU_BASE';
              }
            } else break;
          }
          return { v, origem };
        };
        const getPUOnOrAfter = (isoD, preferCompra = false) => {
          for (const r of puRows) {
            const d = String(r.data);
            if (d >= isoD) {
              const cand = preferCompra && r.pu_compra ? Number(r.pu_compra) : Number(r.pu);
              if (Number.isFinite(cand) && cand > 0) {
                return { v: cand, origem: (preferCompra && r.pu_compra) ? 'PU_COMPRA' : 'PU_BASE' };
              }
              break;
            }
          }
          return { v: null, origem: null };
        };
        // Valor no fim do período SEMPRE pela marcação (PU base)
        const puEnd = puRows.length ? Number(puRows[puRows.length - 1].pu) : null;
        if (puRows.length && puEnd != null) {
          let units = 0;
          for (const f of flows) {
            const vt = Math.abs(num(f.valor_total));
            if (!vt) continue;
            const isSell =
              f.sinal != null
                ? Number(f.sinal) < 0
                : /vend|sell|resgat|saida|saída|leilao|leilão/i.test(
                    String(f.tipo || '')
                  );
            // ✅ Compras: preferir PU_COMPRA; Vendas: PU base
            const preferCompra = !isSell;
            let { v: puFlow, origem } =
              getPUOnOrBefore(String(f.data), preferCompra);
            if (!puFlow) ({ v: puFlow, origem } =
              getPUOnOrAfter(String(f.data), preferCompra));
            if (puFlow && puFlow > 0) {
              const delta = (isSell ? -1 : +1) * (vt / puFlow);
              units += delta;
              if (TRACE_TESOURO_VAL) {
                console.log('[TES_RTG][FLOW]', {
                  ativo: titulo, data: String(f.data), tipo: String(f.tipo || ''),
                  cash: Number(vt.toFixed(2)) * (isSell ? -1 : +1),
                  pu_usado: Number(puFlow.toFixed(4)), origem_pu: origem,
                  unidades_delta: Number(delta.toFixed(8)), unidades_acum: Number(units.toFixed(8))
                });
              }
            } else if (TRACE_TESOURO_VAL) {
              console.warn('[TES_RTG][FLOW][SEM_PU]', {
                ativo: titulo, data: String(f.data), tipo: String(f.tipo || ''),
                preferiu: preferCompra ? 'PU_COMPRA' : 'PU_BASE'
              });
            }
          }
          return Number((units * puEnd).toFixed(2));
          const valorAtual = Number((units * puEnd).toFixed(2));
          if (TRACE_TESOURO_VAL) {
            console.log('[TES_RTG][RESUMO]', {
              ativo: titulo,
              pu_final: Number(puEnd.toFixed(4)),
              unidades_totais: Number(units.toFixed(8)),
              valor_atual: valorAtual
            });
          }
          return valorAtual;          
        }
      } catch {}
    }
  }

  // RF genérica (CDI/SELIC/Pré/IPCA+)
  let S = 0;
  let last = flows[0].data;
  const idx = String(cfg?.indexador || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();

try {
  if (idx === 'CDI')  await ensureCDI(last, alvo, { authHeader: ctx?.authHeader });
  if (idx === 'SELIC') await ensureSelic(last, alvo, { authHeader: ctx?.authHeader });
} catch {}

  const produtoCDI = async (di, df) => {
    if (ctx.produtoCDIEntreCached) return ctx.produtoCDIEntreCached(di, df);
    return await produtoCDIEntre(di, df);
  };
  const produtoSELIC = async (di,df)=> await produtoSelicEntre(di,df);
  const fatorIPCA = async (rAA, di, df) => {
    if (ctx.fatorIPCAmaisCached) return ctx.fatorIPCAmaisCached(rAA, di, df);
    return await fatorIPCAmais(rAA, di, df);
  };

  for (const f of flows) {
    if (S !== 0) {
      if (idx === 'PRE') {
        const eventos = cfg.come_cotas ? comeCotasBetween(last, f.data) : [];
        let ini = last;
        const taxaAA = num(cfg.taxa_anual);
        for (const cc of eventos) {
          const fator = fatorPRE(taxaAA, diasEntre(ini, cc), cfg.base_dias || 252);
          S *= fator;
          if (S > 0) {
            const ganho = S - S / fator;
            const ali = Math.max(0, num(cfg.aliquota_comecotas)) / 100;
            S = Math.max(0, S - Math.max(0, ganho * ali));
          }
          ini = cc;
        }
        const fatorFinal = fatorPRE(taxaAA, diasEntre(ini, f.data), cfg.base_dias || 252);
        S *= fatorFinal;
      } else if (idx === 'CDI') {
        const eventos = cfg.come_cotas ? comeCotasBetween(last, f.data) : [];
        let ini = last;
        for (const cc of eventos) {
          const p1 = await produtoCDI(ini, cc);
          const perc = num(cfg.percentual_cdi);
          let fator = Math.pow(p1, perc / 100);
          if (!Number.isFinite(fator) || fator <= 0) fator = 1;
          S *= fator;
          if (S > 0) {
            const ganho = S - S / fator;
            const ali = Math.max(0, num(cfg.aliquota_comecotas)) / 100;
            S = Math.max(0, S - Math.max(0, ganho * ali));
          }
          ini = cc;
        }
        const p2 = await produtoCDI(ini, f.data);
        const perc2 = num(cfg.percentual_cdi);
        let fator2 = Math.pow(p2, perc2 / 100);
        if (!Number.isFinite(fator2) || fator2 <= 0) fator2 = 1;
        S *= fator2;
      } else if (idx === 'SELIC') {
        const eventos = cfg.come_cotas ? comeCotasBetween(last, f.data) : [];
        let ini = last;
        for (const cc of eventos) {
          const p1 = await produtoSELIC(ini, cc);
          let fator = Number.isFinite(p1) && p1 > 0 ? p1 : 1;
          S *= fator;
          if (S > 0) {
            const ganho = S - S / fator;
            const ali = Math.max(0, num(cfg.aliquota_comecotas)) / 100;
            S = Math.max(0, S - Math.max(0, ganho * ali));
          }
          ini = cc;
        }
        const p2 = await produtoSELIC(ini, f.data);
        let fator2 = Number.isFinite(p2) && p2 > 0 ? p2 : 1;
        S *= fator2;
      } else if (idx === 'IPCA') {
        const eventos = cfg.come_cotas ? comeCotasBetween(last, f.data) : [];
        let ini = last;
        const rAA = num(cfg.taxa_anual);
        for (const cc of eventos) {
          const p1 = await fatorIPCA(rAA, ini, cc);
          S *= p1;
          if (S > 0) {
            const ganho = S - S / p1;
            const ali = Math.max(0, num(cfg.aliquota_comecotas)) / 100;
            S = Math.max(0, S - Math.max(0, ganho * ali));
          }
          ini = cc;
        }
        const p2 = await fatorIPCA(rAA, ini, f.data);
        S *= p2;
      }
    }
    const vt = Math.abs(num(f.valor_total));
    const isSell =
      f.sinal != null
        ? Number(f.sinal) < 0
        : /vend|sell|resgat|saida|saída|leilao|leilão/i.test(String(f.tipo || ''));
    const sinal = isSell ? -1 : +1;
    S += sinal * vt;
    last = String(f.data);
  }

  if (S !== 0 && last <= alvo) {
    if (idx === 'PRE') {
      const eventos = cfg.come_cotas ? comeCotasBetween(last, alvo) : [];
      let ini = last;
      const taxaAA = num(cfg.taxa_anual);
      for (const cc of eventos) {
        const fator = fatorPRE(taxaAA, diasEntre(ini, cc), cfg.base_dias || 252);
        S *= fator;
        if (S > 0) {
          const ganho = S - S / fator;
          const ali = Math.max(0, num(cfg.aliquota_comecotas)) / 100;
          S = Math.max(0, S - Math.max(0, ganho * ali));
        }
        ini = cc;
      }
      const f2 = fatorPRE(taxaAA, diasEntre(ini, alvo), cfg.base_dias || 252);
      S *= f2;
    } else if (idx === 'CDI') {
      const eventos = cfg.come_cotas ? comeCotasBetween(last, alvo) : [];
      let ini = last;
      for (const cc of eventos) {
        const p1 = await produtoCDI(ini, cc);
        const perc = num(cfg.percentual_cdi);
        let fator = Math.pow(p1, perc / 100);
        if (!Number.isFinite(fator) || fator <= 0) fator = 1;
        S *= fator;
        if (S > 0) {
          const ganho = S - S / fator;
          const ali = Math.max(0, num(cfg.aliquota_comecotas)) / 100;
          S = Math.max(0, S - Math.max(0, ganho * ali));
        }
        ini = cc;
      }
      const p2 = await produtoCDI(ini, alvo);
      const perc2 = num(cfg.percentual_cdi);
      let fator2 = Math.pow(p2, perc2 / 100);
      if (!Number.isFinite(fator2) || fator2 <= 0) fator2 = 1;
      S *= fator2;
    } else if (idx === 'SELIC') {
      const eventos = cfg.come_cotas ? comeCotasBetween(last, alvo) : [];
      let ini = last;
      for (const cc of eventos) {
        const p1 = await produtoSELIC(ini, cc);
        let fator = Number.isFinite(p1) && p1 > 0 ? p1 : 1;
        S *= fator;
        if (S > 0) {
          const ganho = S - S / fator;
          const ali = Math.max(0, num(cfg.aliquota_comecotas)) / 100;
          S = Math.max(0, S - Math.max(0, ganho * ali));
        }
        ini = cc;
      }
      const p2 = await produtoSELIC(ini, alvo);
      let fator2 = Number.isFinite(p2) && p2 > 0 ? p2 : 1;
      S *= fator2;
    } else if (idx === 'IPCA') {
      const eventos = cfg.come_cotas ? comeCotasBetween(last, alvo) : [];
      let ini = last;
      const rAA = num(cfg.taxa_anual);
      for (const cc of eventos) {
        const p1 = await fatorIPCA(rAA, ini, cc);
        S *= p1;
        if (S > 0) {
          const ganho = S - S / p1;
          const ali = Math.max(0, num(cfg.aliquota_comecotas)) / 100;
          S = Math.max(0, S - Math.max(0, ganho * ali));
        }
        ini = cc;
      }
      const f2 = await fatorIPCA(rAA, ini, alvo);
      S *= f2;
    }
  }

  if ((S === 0 || !Number.isFinite(S)) && flows.length) {
    const aplicadoLiquido = flows.reduce((acc, f) => {
      const vt = Math.abs(num(f.valor_total));
      const isSell =
        f.sinal != null
          ? Number(f.sinal) < 0
          : /vend|sell|resgat|saida|saída|leilao|leilão/i.test(
              String(f.tipo || '')
            );
      return acc + (isSell ? -vt : vt);
    }, 0);
    if (aplicadoLiquido > 0) S = aplicadoLiquido;
  }
  const out = Number.isFinite(S) ? Number(S.toFixed(2)) : 0;
  return out;
}

// -------------------- Yahoo/FX (com cache leve) --------------------
const yahooCache = new Map(); // key -> {ts, ttlMs, data}
function cacheGet(k) {
  const v = yahooCache.get(k);
  if (!v) return null;
  if (Date.now() - v.ts > v.ttlMs) {
    yahooCache.delete(k);
    return null;
  }
  return v.data;
}
function cacheSet(k, data, ttlMs = 5 * 60 * 1000) {
  yahooCache.set(k, { ts: Date.now(), ttlMs, data });
}
const toYahoo = (name) => {
  const t = String(name || '').trim().toUpperCase();
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return `${t}.SA`; // B3
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t)) return t; // EUA
  return null;
};

async function buildPriceSeriesFor(
  equities,
  startISO,
  endISO,
  padDays = 7,
  priceMode = 'adj'
) {
  const startPad = new Date(startISO);
  startPad.setUTCDate(startPad.getUTCDate() - padDays);
  const p1 = startPad.toISOString().slice(0, 10);
  const p2 = endISO;
  const priceSeries = new Map();
  if (!equities.length) return priceSeries;

  const yahooFinance = (await import('yahoo-finance2')).default;
  if (typeof yahooFinance.suppressNotices === 'function') {
    yahooFinance.suppressNotices(['ripHistorical']);
  }

  await Promise.all(
    equities.map(async ({ nome, yf }) => {
      const key = `hist|${yf}|${p1}|${p2}|${priceMode}`;
      let hist = cacheGet(key);
      if (!hist) {
        try {
          hist = await yahooFinance.historical(yf, {
            period1: p1,
            period2: p2,
            interval: '1d',
          });
          cacheSet(key, hist, 5 * 60 * 1000);
        } catch {
          hist = [];
        }
      }
      const mp = new Map();
      (hist || []).forEach((r) => {
        const d = new Date(r.date);
        const dISO = new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        )
          .toISOString()
          .slice(0, 10);
        const px = priceMode === 'adj' ? r.adjClose ?? r.close : r.close ?? r.adjClose;
        const wd = new Date(dISO + 'T00:00:00Z').getUTCDay();
        if (px && wd >= 1 && wd <= 5) mp.set(dISO, Number(px));
      });
      priceSeries.set(nome, mp);
    })
  );

  return priceSeries;
}

async function buildFXSeriesUSDBRL(startISO, endISO, padDays = 15) {
  const startPad = new Date(startISO);
  startPad.setUTCDate(startPad.getUTCDate() - padDays);
  const p1 = startPad.toISOString().slice(0, 10);
  const p2 = endISO;
  const mp = new Map();

  const yahooFinance = (await import('yahoo-finance2')).default;
  if (typeof yahooFinance.suppressNotices === 'function') {
    yahooFinance.suppressNotices(['ripHistorical']);
  }

  const key = `fx|USDBRL=X|${p1}|${p2}`;
  let hist = cacheGet(key);
  if (!hist) {
    try {
      hist = await yahooFinance.historical('USDBRL=X', {
        period1: p1,
        period2: p2,
        interval: '1d',
      });
      cacheSet(key, hist, 5 * 60 * 1000);
    } catch {
      hist = [];
    }
  }
  (hist || []).forEach((r) => {
    const d = new Date(r.date);
    const dISO = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    )
      .toISOString()
      .slice(0, 10);
    const px = r.adjClose ?? r.close;
    const wd = new Date(dISO + 'T00:00:00Z').getUTCDay();
    if (px && wd >= 1 && wd <= 5) mp.set(dISO, Number(px));
  });
  return mp;
}

function fxOnOrBefore(fxMap, isoStr) {
  if (!fxMap || !fxMap.size) return null;
  let best = null;
  for (const d of fxMap.keys())
    if (d <= isoStr && (!best || d > best)) best = d;
  return best ? fxMap.get(best) : null;
}
function prevMarketPrice(psMap, startISO) {
  if (!psMap) return null;
  let best = null;
  for (const d of psMap.keys())
    if (d < startISO && (!best || d > best)) best = d;
  return best ? psMap.get(best) : null;
}
function lastPxOnOrBefore(psMap, isoStr) {
  if (!psMap) return null;
  let best = null;
  for (const d of psMap.keys())
    if (d <= isoStr && (!best || d > best)) best = d;
  return best ? psMap.get(best) : null;
}

// -------------------- TWR agregação mensal --------------------
function agregaMensalTWR(daily) {
  const byMonth = new Map();
  for (const d of daily || []) {
    const ym = d.date.slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, 1);
    const f = 1 + ((Number(d.valor) || 0) / 100);
    byMonth.set(ym, byMonth.get(ym) * f);
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, f]) => ({
      ano_mes: ym,
      mes: parseInt(ym.slice(5, 7), 10),
      rentabilidade_pct: Number(((f - 1) * 100).toFixed(2)),
    }));
}

async function gerarSerieDiaria(usuarioId, opts = {}) {
  // Normaliza período (aceita "no-ano", "ytd", etc.)
  const normPeriodo = (p) => {
    const s = String(p || 'ano').toLowerCase().replace(/[\s_]+/g, '').replace(/[^a-z0-9]/g, '');
    if (s === 'ytd' || s === 'noano' || s === 'anoatual') return 'ano';
    if (s === '12meses' || s === 'ultimos12meses') return '12m';
    if (s === '24meses' || s === 'ultimos24meses') return '24m';
    if (s === 'inicio' || s === 'all' || s === 'desdeoinicio') return 'inicio';
    return s || 'ano';
  };
  const { periodo = 'ano', tradingDays = '1', accumulate = '1', onlyAtivos = '' } = opts;
  // debug opcional por query (?debug=1)
  const periodoN = normPeriodo(periodo);
  const filtroAtivos = String(onlyAtivos || '')
    .split(',').map(s => s.trim()).filter(Boolean).map(s => s.toUpperCase());
  const { startISO, endISO } = rangeFromPeriodo(periodoN);
 const startInt = dateInt(startISO);
 const endInt   = dateInt(endISO);

  // 🔒 Sempre converte para 'YYYY-MM-DD' (mesmo se vier Date)
  const toISO = (v) => {
    if (!v) return null;
    if (v instanceof Date) return iso(v);
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d)) return iso(d);
    return s.slice(0,10);
  };

  // 1) Operações e valores_atuais
  const compras = (await db.query(`
    SELECT 
      nome_investimento,
      (data_operacao)::date AS data_operacao,
      quantidade,
      valor_unitario,
      valor_total,
      COALESCE(subcategoria,'') AS subcategoria,
      LOWER(COALESCE(tipo_operacao,'')) AS tipo_operacao
    FROM investimentos
    WHERE usuario_id = $1
    ORDER BY (data_operacao)::date ASC
  `, [usuarioId])).rows || [];

// valores_atuais descontinuado na série diária
const valores = [];

  // 2) Indexa por ativo
  const porAtivo = new Map();
  const ensure = (nome) => {
    if (!porAtivo.has(nome)) porAtivo.set(nome, { compras: [], valores: [], subclasse: '' });
    return porAtivo.get(nome);
  };
  (compras || []).forEach(c => {
    const cISO = toISO(c.data_operacao);
    const a = ensure(c.nome_investimento);
    const op   = String(c.tipo_operacao || '').toLowerCase();
    const quant= Math.abs(Number(c.quantidade) || 0);
    const pu   = Number(c.valor_unitario) || 0;
    const vt   = Number(c.valor_total) || 0; // fluxo em dinheiro (±)
    let tipo = 'outro', qtd = quant, flow = true, cash = 0;
    if (op.includes('compra') || op.includes('buy') || op.includes('aplic')) {
      tipo = 'compra';  qtd = +quant; flow = true;  cash = +vt;
    } else if (
      op.includes('vende') || op.includes('venda') || op.includes('sell') ||
      op.includes('resgat') || op.includes('resgate') || op.includes('amortiz')
    ) {
      tipo = 'venda';   qtd = -quant; flow = true;  cash = -vt;
    } else if (op.includes('divid') || op.includes('provent') || op.includes('jcp')) {
      // Dividendos / Proventos / JCP: entram como fluxo de caixa (F_t), sem alterar quantidade
      tipo = 'provento'; qtd = 0; flow = true; cash = +vt;
    } else if (op.includes('transfer') && (op.includes('entrada') || op.includes('in'))) {
      tipo = 'transfer_in';  qtd = +quant; flow = false; cash = 0;
    } else if (op.includes('transfer') && (op.includes('saida') || op.includes('saída') || op.includes('out'))) {
      tipo = 'transfer_out'; qtd = -quant; flow = false; cash = 0;
    } else if (op.includes('bonif')) {
      tipo = 'bonificacao';  qtd = +quant; flow = false; cash = 0;
    }
    // guarda subclasse do ativo (precisamos para RF/Tesouro)
    if (!a.subclasse && c.subcategoria) a.subclasse = c.subcategoria;
    a.compras.push({
      date: cISO,
      dateInt: dateInt(cISO),
      qtd, pu, tipo, flow,
      cash,
      subclasse: c.subcategoria || ''
    });
  });
  for (const a of porAtivo.values()) {
    a.compras.sort((x,y)=> x.dateInt - y.dateInt);
    a.valores.sort((x,y)=> x.dateInt - y.dateInt);
  }
  if (filtroAtivos.length) {
    for (const nome of Array.from(porAtivo.keys())) {
      if (!filtroAtivos.includes(String(nome).toUpperCase())) porAtivo.delete(nome);
    }
  }

  // 📋 Quais ativos o backend vai tentar considerar
  if (TRACE_COVERAGE) {
    const lista = Array.from(porAtivo.entries()).map(([nome, a]) => ({
      nome, subclasse: a.subclasse || ''
    }));
    console.log('[COVER][ATIVOS_CAD]', { total: lista.length, itens: lista });
  }

  // 3) Séries de preços (Adj Close) + FX + PU Tesouro
  const equities = [];
  for (const [nome] of porAtivo.entries()) {
    const yf = toYahoo(nome);
    if (yf) equities.push({ nome, yf });
  }
  const priceSeries = await buildPriceSeriesFor(equities, startISO, endISO, /*padDays*/15, 'close');
  const nomeToYf = new Map(equities.map(e => [e.nome, e.yf]));
  const fxUSDBRL = await buildFXSeriesUSDBRL(startISO, endISO, 15);
  // Série paralela apenas com PU de COMPRA para Tesouro (derivar QTD)
  const tesouroCompraSeries = new Map();  
  for (const { nome, yf } of equities) {
    if (yf && !yf.endsWith('.SA')) {
      const mp = priceSeries.get(nome);
      if (mp && mp.size) {
        const conv = new Map();
        for (const [iso, pxUSD] of mp.entries()) {
          const fx = fxOnOrBefore(fxUSDBRL, iso);
          if (fx != null && isFinite(pxUSD)) conv.set(iso, Number(pxUSD) * Number(fx));
        }
        if (conv.size) priceSeries.set(nome, conv);
      }
    }
  }

    // ⚙️ Carrega config de RF (inclui vencimento) ANTES de sincronizar Tesouro
let rfCfgByNome = new Map();
  await Promise.all(Array.from(porAtivo.keys()).map(async (nome) => {
    const r = await db.query(
      `SELECT indexador, taxa_anual, percentual_cdi, base_dias, come_cotas, aliquota_comecotas,
              subcategoria, nome_investimento, vencimento
         FROM investimentos
        WHERE usuario_id = $1
          AND nome_investimento = $2
        ORDER BY
          CASE WHEN COALESCE(indexador,'') <> '' THEN 0 ELSE 1 END,
          id DESC
        LIMIT 1`,
      [usuarioId, nome]
    );
    rfCfgByNome.set(nome, r.rows?.[0] || null);
  }));

  // Tesouro: injeta PU diário
  const tesouros = [];
  for (const [nome, obj] of porAtivo.entries()) {
    const sub = String(obj.subclasse || '').toLowerCase();
    if (sub.includes('tesouro')) {
      tesouros.push({ nome, titulo: normTituloTesouro(nome) });
    }
  }

  // menor data de COMPRA por TÍTULO (normalizado)
  const firstByTitulo = new Map();
  for (const [nome, obj] of porAtivo.entries()) {
    const sub2 = String(obj.subclasse || '').toLowerCase();
    if (!sub2.includes('tesouro')) continue;
   const tnorm = normTituloTesouro(nome);
  const firstCompra = (obj.compras || []).find(tr => (tr.qtd ?? 0) > 0)?.date || null;
  if (!firstCompra) continue;
  const prev = firstByTitulo.get(tnorm);
  if (!prev || firstCompra < prev) firstByTitulo.set(tnorm, firstCompra);
  }

  const vistosPU = new Set();
  for (const t of tesouros) {
    if (vistosPU.has(t.titulo)) continue;
    vistosPU.add(t.titulo);
    try {
      const cfgTes = rfCfgByNome.get(t.nome);
      const venc = cfgTes?.vencimento ? toISO(cfgTes.vencimento) : '';

      // início = data da 1ª compra desse TÍTULO (sem acolchoamento)
const firstOp = firstByTitulo.get(t.titulo);
if (!firstOp) {
  continue;
}
const iniPU = firstOp;
await ensureTesouroPU({ nome: t.titulo, vencimento: venc }, iniPU, endISO, { authHeader: opts?.authHeader });

      const r = await fetch(
        `${BACKEND_BASE}/indices/tesouro/pu?nome=${encodeURIComponent(t.titulo)}&inicio=${encodeURIComponent(iniPU)}&fim=${encodeURIComponent(endISO)}`,
        { headers: { ...withAuth(opts?.authHeader) } }
      );
      const j = await r.json().catch(() => ({ items: [] }));
      const arr = Array.isArray(j.items) ? j.items : [];
      const mpBase = new Map(
        arr
          .map(it => [String(it.data).slice(0,10), Number(it.pu)])
          .filter(([k,v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && isFinite(v) && v>0)
      );
      const mpCompra = new Map(
        arr
          .map(it => [String(it.data).slice(0,10),
                      (it.pu_compra != null && isFinite(Number(it.pu_compra)))
                        ? Number(it.pu_compra) : null])
          .filter(([k,v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v != null && v > 0)
      );

if (mpBase.size) {
  // chave “crua” (como está cadastrado no teu banco)
  const keyRaw  = t.nome;    // ex.: "Tesouro Renda Mais Aposentadoria Extra 2065"
  // chave “normalizada” (como salvamos no indices_tesouro_pu)
  const keyNorm = t.titulo;  // ex.: "Tesouro Renda+ 2065"

  // mescla com o que já existir em keyRaw
  const prevRaw = priceSeries.get(keyRaw);
  const merged  = (prevRaw && prevRaw.size) ? prevRaw : new Map();
  for (const [k, v] of mpBase) if (!merged.has(k)) merged.set(k, v);

  // grava sob as duas chaves, para qualquer parte do sistema achar
  priceSeries.set(keyRaw, merged);
  priceSeries.set(keyNorm, merged);

  // guarda série de PU_COMPRA (quando existir) sob as mesmas chaves
  const mergedCompra = new Map();
  for (const [k, v] of mpCompra) mergedCompra.set(k, v);
  if (mergedCompra.size) {
    tesouroCompraSeries.set(keyRaw, mergedCompra);
    tesouroCompraSeries.set(keyNorm, mergedCompra);
  }
  // 🔍 PASSO B — checagem de mapeamento (nome cadastrado x normalizado) + PU no dia da 1ª compra
  if (TRACE_COVERAGE) {
    const puDiaCompra = merged.get(firstOp) ?? null;
    console.log('[TWR][TD][MATCH]', {
      ativo_raw: keyRaw,
      ativo_norm: keyNorm,
      first_compra: firstOp,
      tem_raw: priceSeries.has(keyRaw),
      tem_norm: priceSeries.has(keyNorm),
      pu_no_dia_compra: puDiaCompra
    });
  }  
  // 👇 Log de confirmação do intervalo de PU disponível
  const diasPU = Array.from(merged.keys()).sort();
  if (TRACE_COVERAGE) {
    console.log('[PU][OK]', {
      titulo: t.titulo,
      dias: diasPU.length,
      inicio: diasPU[0],
      fim: diasPU[diasPU.length - 1]
    });
  }
} else {
  if (TRACE_COVERAGE) {
    console.warn('[PU][VAZIO]', { titulo: t.titulo, de: iniPU, ate: endISO });
  }
}
    } catch {}
  }

    // 📋 Mapa de cobertura por ativo (fonte de preço/valor utilizada)
  if (TRACE_COVERAGE) {
    const mapa = [];
    for (const [nome, a] of porAtivo.entries()) {
      const sub = String(a.subclasse || '').toLowerCase();
      const yf = toYahoo(nome);
      const keyNorm = normTituloTesouro(nome);
      const psRaw  = priceSeries.get(nome);
      const psNorm = priceSeries.get(keyNorm);
      const ps = psRaw && psRaw.size ? psRaw : (psNorm && psNorm.size ? psNorm : null);
      const cfg = rfCfgByNome.get(nome) || {};
      const idx = String(cfg.indexador || '').trim().toUpperCase();
      let fonte = null;
      if (sub.includes('tesouro') || /^TESOURO\s/.test(String(nome).toUpperCase())) {
        fonte = ps ? 'TESOURO_PU' : (idx ? `RF_${idx}_SEM_PU` : 'TESOURO_SEM_PU');
      } else if (yf && ps) {
        fonte = 'YAHOO';
      } else if (idx) {
        fonte = `RF_${idx}`;
      } else {
        fonte = 'FALLBACK_PM';
      }
      const range = ps && ps.size ? (() => {
        const ks = Array.from(ps.keys()).sort();
        return { de: ks[0], ate: ks[ks.length-1], dias: ks.length };
      })() : null;
      mapa.push({ nome, subclasse: a.subclasse || '', yf, fonte, range });
    }
    console.log('[COVER][MAP]', mapa);
  }

  // 4) Calendário de dias (pregões + dias de fluxo + NAV não-equities)
  let days = [];
  let flowCashByDay = new Map();
  if (String(tradingDays).toLowerCase() === '1' || String(tradingDays).toLowerCase() === 'true') {
    const diasTradingSet = new Set();
    const flowDaysSet    = new Set();
    const navDaysNonEq   = new Set();
for (const mp of priceSeries.values()) {
  for (const d of mp.keys()) {
    const k = String(d).slice(0, 10); // normaliza
    if (k >= startISO && k <= endISO) diasTradingSet.add(k);
  }
}
    for (const [_nome, a] of porAtivo.entries()) {
      for (const tr of a.compras) {
        if (!tr.flow) continue;
        if (tr.dateInt < startInt || tr.dateInt > endInt) continue;
        const iso = tr.date;             // 🔒 usa SEMPRE a data original da operação
        flowDaysSet.add(iso);            // garante o dia na série
        tr.dateTrade = iso;              // fluxo contado no próprio dia
        tr.dateTradeInt = tr.dateInt;
        if (TRACE_FLOW) {
          if (!diasTradingSet.has(iso)) {
            console.log('[TWR][fluxo sem preço no dia, mantendo data]', { ativo: _nome, data: iso });
          } else if (/^Tesouro/i.test(String(_nome))) {
            console.log('[TWR][fluxo no dia]', { ativo: _nome, data: iso });
          }
        }
      }
    }
    const setDias = new Set([...diasTradingSet, ...flowDaysSet, ...navDaysNonEq]);
    // ❌ não forçar calendário contínuo; respeitar apenas dias com negociação/snapshot/fluxo
    days = Array.from(setDias).sort().map(iso => ({ iso, int: dateInt(iso) }));
    for (const [_n, a] of porAtivo.entries()) {
      for (const tr of a.compras) {
        if (!tr.flow || !tr.dateTrade) continue;
        const k = tr.dateTrade;
        flowCashByDay.set(k, (flowCashByDay.get(k) || 0) + (Number(tr.cash) || 0));
      }
    }
  } else {
    let cur = new Date(startISO);
    const end = new Date(endISO);
    while (cur <= end) {
      const iso = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate())).toISOString().slice(0,10);
      days.push({ iso, int: dateInt(iso) });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  if (TRACE_COVERAGE) {
    const dlist = days.map(d => d.iso);
    console.log('[COVER][DAYS]', { total: dlist.length, de: dlist[0], ate: dlist[dlist.length-1] });
  }

  // 5) TWR diário (neutro a fluxos)
  const state = new Map();
  for (const [nome, data] of porAtivo.entries()) {
    const ps = priceSeries.get(nome);
    const prevPx = prevMarketPrice(ps, startISO);
    state.set(nome, {
      subclasse: data.subclasse || '',
      qi: 0, pi: 0,
      cumQtd: 0,
      avgCostNum: 0,
      lastPrice: prevPx ?? null,
      lastValRow: null,
      _lastCalcISO: null,
      comp: data.compras, vals: data.valores,
      _warnedNoPrice: false,
      _everCounted: false,
      _appliedCarry: false,      
    });
  }
  let prevVInit = null;
  if (days.length) {
    const firstInt = days[0].int;
    for (const [nome, st] of state.entries()) {
      while (st.qi < st.comp.length && st.comp[st.qi].dateInt < firstInt) {
        const tr = st.comp[st.qi];
        if (tr.qtd >= 0) {
          st.avgCostNum += tr.qtd * tr.pu; st.cumQtd += tr.qtd;
        } else {
          const sell = -tr.qtd;
          const avg = st.cumQtd > 0 ? (st.avgCostNum / st.cumQtd) : 0;
          st.avgCostNum -= sell * avg; st.cumQtd -= sell;
          if (st.cumQtd < 1e-7) { st.cumQtd = 0; st.avgCostNum = 0; }
        }
        st.qi++;
      }
      while (st.pi < st.vals.length && st.vals[st.pi].dateInt < firstInt) {
        st.lastValRow = st.vals[st.pi]; st.pi++;
      }
      const ps = priceSeries.get(nome);
      let pPrev = ps ? prevMarketPrice(ps, days[0].iso) : null;
      if (pPrev == null && st.lastValRow) {
        pPrev = st.lastValRow.preco_unitario != null
          ? Number(st.lastValRow.preco_unitario)
          : (st.cumQtd > 0 ? Number(st.lastValRow.valor_total) / st.cumQtd : null);
      }
      if (pPrev == null && st.cumQtd > 0 && st.avgCostNum > 0) {
        pPrev = st.avgCostNum / st.cumQtd;
      }
      if (pPrev != null) {
        st.lastPrice = pPrev;
        // define âncora de carry a partir do 1º dia útil do período
        st._lastCalcISO = days[0].iso;
        prevVInit = (prevVInit ?? 0) + st.cumQtd * pPrev;
      }
    }
  }

  const serieValor = [];
  let prevV = null;
  let fCum = 1;
  // helper: passo diário de RF (CDI/SELIC/Pré/IPCA) entre di -> df
  const rfStepCache = new Map(); // key: nome|di|df
  const rfFatorStep = async (nome, cfg, diISO, dfISO) => {
    if (!cfg) return null;
    const key = `${nome}|${diISO}|${dfISO}`;
    if (rfStepCache.has(key)) return rfStepCache.get(key);
    const idx = String(cfg.indexador || '').trim().toUpperCase();
    let f = 1;
    if (idx === 'CDI') {
      await ensureCDI(diISO, dfISO, { authHeader: opts?.authHeader });
    // janela meio-aberta: (diISO, dfISO]
    const p = await produtoCDIEntre(
      toISO(new Date(new Date(diISO).getTime() + 24*60*60*1000)),
      dfISO
    );
      const perc = Number(String(cfg.percentual_cdi || 0).toString().replace(',','.')) || 0;
      f = Math.pow(p, perc / 100);
    } else if (idx === 'SELIC') {
      await ensureSelic(diISO, dfISO, { authHeader: opts?.authHeader });
      f = await produtoSelicEntre(diISO, dfISO);
    } else if (idx === 'PRE') {
      const taxa = Number(String(cfg.taxa_anual || 0).toString().replace(',','.')) || 0;
      const base = Number(cfg.base_dias || 252);
      f = fatorPRE(taxa, diasEntre(diISO, dfISO), base);
    } else if (idx === 'IPCA') {
      const rAA = Number(String(cfg.taxa_anual || 0).toString().replace(',','.')) || 0;
      f = await fatorIPCAmais(rAA, diISO, dfISO);
    } else {
      f = 1;
    }
    if (!Number.isFinite(f) || f <= 0) f = 1;
    rfStepCache.set(key, f);
    return f;
  };

  const out = [];
  for (const d of days) {
    let total = 0;
    let fluxoDia = Number((flowCashByDay && flowCashByDay.get(d.iso)) || 0);
      if (TRACE_FLOW && fluxoDia !== 0) {
        console.log('[TWR][DIA][fluxo]', { dia: d.iso, fluxoDia });
      }
    for (const [nome, st] of state.entries()) {
      while (st.qi < st.comp.length && st.comp[st.qi].dateInt <= d.int) {
        const tr = st.comp[st.qi];
        // Deriva/ajusta QTD p/ Tesouro:
        // - Preferir PU_COMPRA no dia da compra, se disponível (CSV “PU Compra Manhã/Tarde”).
        // - Senão, usar PU Base (série de marcação).
        const isTesouro =
          String(st.subclasse || '').toLowerCase().includes('tesouro') ||
          String(nome).toUpperCase().startsWith('TESOURO ');
        if (isTesouro && (tr.tipo === 'compra' || tr.tipo === 'venda') && Number(tr.cash)) {
          const psBase   = priceSeries.get(nome) || priceSeries.get(normTituloTesouro(nome));
          const psCompra = tesouroCompraSeries.get(nome) || tesouroCompraSeries.get(normTituloTesouro(nome));
          let puRef = null;
          if (tr.tipo === 'compra' && psCompra) {
            puRef = lastPxOnOrBefore(psCompra, tr.date);
            if (puRef == null) {
              // fallback: próximo disponível na série de compra
              const ks = Array.from(psCompra.keys()).sort();
              const next = ks.find(k => k >= tr.date);
              if (next) puRef = psCompra.get(next);
            }
          }
          if (puRef == null && psBase) {
            puRef = lastPxOnOrBefore(psBase, tr.date);
            if (puRef == null) {
              const ks = Array.from(psBase.keys()).sort();
              const next = ks.find(k => k >= tr.date);
              if (next) puRef = psBase.get(next);
            }
          }
          if (puRef == null && ps && ps.size) {
            const ks = Array.from(ps.keys()).sort();
            const next = ks.find(k => k >= tr.date);
            if (next) puRef = ps.get(next);
          }
          if (puRef != null && isFinite(puRef) && puRef > 0) {
            const cashAbs = Math.abs(Number(tr.cash));
            const qtdInfo = Math.abs(Number(tr.qtd) || 0);
            const qtdPorCash = cashAbs / puRef;
            // Se a qtd informada for 0, 1 ou muito diferente do que PU implica, ajusta
            const difVal = Math.abs(qtdInfo * puRef - cashAbs);
            const mismatch = (qtdInfo === 0) || (qtdInfo === 1) || (cashAbs > 0 && (difVal / cashAbs) > 0.2);
            if (mismatch) {
              tr.pu = puRef;
              const sinal = tr.tipo === 'venda' ? -1 : 1;
              const qtdNova = sinal * qtdPorCash;
              if (TRACE_COVERAGE) {
                console.log('[TWR][TES][qtd_ajustada]', {
                  ativo: nome,
                  data: tr.date,
                  fonte_pu: (tr.tipo === 'compra' && psCompra) ? 'PU_COMPRA' : 'PU_BASE',
                  cash: Number(tr.cash),
                  pu: puRef,
                  qtd_informada: Number(tr.qtd || 0),
                  qtd_nova: Number(qtdNova.toFixed(6))
                });
              }
              tr.qtd = qtdNova;
            }
          }
        }
        if (tr.tipo === 'bonificacao') {
          st.cumQtd += Math.max(0, tr.qtd);
        } else if (tr.tipo === 'ajuste_bonificacao') {
          const dec = Math.max(0, -tr.qtd);
          st.cumQtd = Math.max(0, st.cumQtd - dec);
        } else if (tr.qtd >= 0) {
          st.avgCostNum += tr.qtd * tr.pu; st.cumQtd += tr.qtd;
        } else {
          const sell = -tr.qtd;
          const avgCost = st.cumQtd > 0 ? (st.avgCostNum / st.cumQtd) : 0;
          st.avgCostNum -= sell * avgCost; st.cumQtd -= sell;
          if (st.cumQtd < 0.0000001) { st.cumQtd = 0; st.avgCostNum = 0; }
        }
        st.qi++;
      }
      while (st.pi < st.vals.length && st.vals[st.pi].dateInt <= d.int) {
        st.lastValRow = st.vals[st.pi];
        st.pi++;
      }

      let priceToday = st.lastPrice;
      const ps = priceSeries.get(nome);
      if (ps && ps.has(d.iso)) {
        priceToday = ps.get(d.iso);
        st.lastPrice = priceToday;
        // ancorar carry no próprio dia de mercado
        st._lastCalcISO = d.iso;

      } else if ((st.lastPrice == null) && st.cumQtd > 0 && st.avgCostNum > 0) {
        // ✅ Fallback para RF sem snapshot: inicia pelo PM (WAC) e ancora o carry
        const p = st.avgCostNum / st.cumQtd;
        if (isFinite(p) && p > 0) {
          priceToday = p;
          st.lastPrice = p;
        }        
      }
      // RF (não Tesouro): aplicar carry diário baseado na config do cadastro,
      // independentemente de a subclasse ter vindo preenchida nas operações.
      {
        const cfg = rfCfgByNome.get(nome);
        const sub = String(st.subclasse || cfg?.subcategoria || '').toLowerCase();
        const nomeUp = String(nome || '').toUpperCase();
        const isTesouro = sub.includes('tesouro') || nomeUp.startsWith('TESOURO ');
        // houve PREÇO hoje se veio de Yahoo (ps.has) OU se há valores_atuais exatamente no dia d.iso
        const houvePrecoHoje = (ps && ps.has(d.iso)) || (st.lastValRow && st.lastValRow.date === d.iso);
        if (!isTesouro && cfg && String(cfg.indexador || '').trim() && !houvePrecoHoje) {
          const di = st._lastCalcISO;
          const df = d.iso;
          if (st.lastPrice != null && di && di <= df) {
            const f = await rfFatorStep(nome, cfg, di, df);
            
            if (Number.isFinite(f) && f > 0) {
              const prev = st.lastPrice;
              priceToday = prev * f;
              st.lastPrice = priceToday;
              // âncora avança só quando aplicamos carry ou tivemos preço de mercado
              st._lastCalcISO = d.iso;
              st._appliedCarry = true;
            }
          }
        }
      }

      // 1x por ativo/dataset: há posição mas nenhum preço/nem PM para valorar
      if (TRACE_MISS_PRICE && st.cumQtd > 0 && (priceToday == null) && (!st.avgCostNum || st.avgCostNum === 0) && !st._warnedNoPrice) {
        console.warn('[COVER][MISS_PRICE]', { ativo: nome, dia: d.iso });
        st._warnedNoPrice = true;
      }      

      let valAtivo = 0;
      if (priceToday != null) {
        valAtivo = st.cumQtd * priceToday;
      } else {
        valAtivo = st.avgCostNum;
      }
      total += (isFinite(valAtivo) ? valAtivo : 0);
      if (valAtivo > 0) st._everCounted = true;
    }
    serieValor.push({ date: d.iso, total });
    if (prevV === null) {
      prevV = (prevVInit ?? total);
      let r0 = (prevV > 0) ? ((total - prevV - fluxoDia) / prevV) * 100 : 0;
      if (Math.abs(r0) < 1e-10) r0 = 0;
      out.push({ date: d.iso, valor: Number(r0.toFixed(6)) });
      const rd0 = Number(r0.toFixed(6));
      fCum *= (1 + rd0 / 100);
      prevV = total;
    } else {
      let rd;
      if (prevV > 0) {
        let r = ((total - prevV - fluxoDia) / prevV) * 100;
        if (Math.abs(r) < 1e-10) r = 0;
        rd = Number(r.toFixed(6));
      } else {
        rd = 0;
      }
      if (TRACE_FLOW && (fluxoDia !== 0 || Math.abs(rd) > 3)) {
       console.log('[TWR][DIA][calc]', {
          dia: d.iso, Vprev: Number(prevV.toFixed(2)), V: Number(total.toFixed(2)),
          fluxoDia: Number(fluxoDia.toFixed(2)), rDiaPct: rd
        });
      }
      out.push({ date: d.iso, valor: rd });
      fCum *= (1 + rd / 100);
      prevV = total;
    }
  }

  // Corta dias antes de existir posição
  let firstIdx = serieValor.findIndex(x => Number(x.total) > 0);
  if (firstIdx < 0) firstIdx = 0;
  let outCropped = out.slice(firstIdx);
  // Garante corte estrito dentro do período selecionado
  outCropped = outCropped.filter(r => r.date >= startISO && r.date <= endISO);

  if (String(accumulate) === '1') {
    let f = 1;
    const withCum = outCropped.map(d => {
      f *= (1 + (Number(d.valor) || 0) / 100);
      const cum = Number(((f - 1) * 100).toFixed(4));
      // 🔑 adiciona aliases esperados pelo front: carteira (diário) e carteira_cum (acumulado)
      return { date: d.date, valor: d.valor, carteira: d.valor, valor_cum: cum, carteira_cum: cum };
    });

    if (TRACE_COVERAGE) {
      const assets = Array.from(state.entries()).map(([nome, st]) => ({
        nome,
        everCounted: !!st._everCounted,
        appliedCarry: !!st._appliedCarry
      }));
      const faltando = assets.filter(a => !a.everCounted).map(a => a.nome);
      console.log('[COVER][SUMMARY]', {
        ativos_total: assets.length,
        ativos_contabilizados: assets.filter(a => a.everCounted).length,
        ativos_somente_carry: assets.filter(a => a.appliedCarry).length,
        ativos_nunca_contados: faltando
      });
    }

  return withCum;
  }
  const outPlain = outCropped.map(d => ({ ...d, carteira: d.valor }));
  if (TRACE_COVERAGE) {
    const assets = Array.from(state.entries()).map(([nome, st]) => ({
      nome,
      everCounted: !!st._everCounted,
      appliedCarry: !!st._appliedCarry
    }));
    const faltando = assets.filter(a => !a.everCounted).map(a => a.nome);
    console.log('[COVER][SUMMARY]', {
      ativos_total: assets.length,
      ativos_contabilizados: assets.filter(a => a.everCounted).length,
      ativos_somente_carry: assets.filter(a => a.appliedCarry).length,
      ativos_nunca_contados: faltando
    });
  }
  return outPlain;
}

// -------------------- Exports --------------------
// ✅ Exporte TODAS as helpers referenciadas pelas rotas
module.exports = {
  // datas
  dateInt,
  iso,
  lastBusinessDayOfMonthUTC,
  addDaysISO,
  diasEntre,
  isBizDay,
  prevTrading,
  nextTrading,
  weekdaysBetween,
  rangeFromPeriodo,
  // normalização/cálculo
  calcularRentabilidade,
  normTituloTesouro,
  comeCotasBetween,
  fatorPRE,
  // índices / fatores
  ensureCDI,
  produtoCDIEntre,
  ensureSelic,
  produtoSelicEntre,
  fatorIPCAmais,
  ensureTesouroPU,
  valorRFnaData,
  // yahoo / fx
  toYahoo,
  buildPriceSeriesFor,
  buildFXSeriesUSDBRL,
  fxOnOrBefore,
  prevMarketPrice,
  lastPxOnOrBefore,
  // twr / séries
  agregaMensalTWR,
  gerarSerieDiaria, // ← se existir na sua helpers; se não, remova esta linha
};