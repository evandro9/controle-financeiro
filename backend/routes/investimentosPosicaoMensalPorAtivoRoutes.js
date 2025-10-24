// backend/routes/investimentosPosicaoMensalPorAtivoRoutes.js (Postgres)
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { normTituloTesouro, valorRFnaData } = require('../utils/invest-helpers');

// Base absoluta para chamadas internas (ex.: https://controle-financeiro-qk03.onrender.com/api)
const API_BASE = (process.env.API_PUBLIC_BASE || '').replace(/\/+$/, '');

router.use(auth);
const DBG = (...x)=>console.log('[POS-MES-ATV]', ...x);

// ====== Utils de datas/negócio ======
function isWeekend(d){ const w=d.getUTCDay(); return w===0 || w===6; }
function lastBusinessDayOfMonthUTC(y, m /*1..12*/){
  const d = new Date(Date.UTC(y, m, 0));
  while (isWeekend(d)) d.setUTCDate(d.getUTCDate()-1);
  return d;
}
function comeCotasBetween(diISO, dfISO){
  const out=[];
  const di=new Date(diISO+'T00:00:00Z'), df=new Date(dfISO+'T00:00:00Z');
  for(let y=di.getUTCFullYear(); y<=df.getUTCFullYear(); y++){
    for(const m of [5,11]){ // Maio/Novembro
      const d = lastBusinessDayOfMonthUTC(y, m);
      if(d>=di && d<=df) out.push(d.toISOString().slice(0,10));
    }
  }
  return out.sort();
}
const iso = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10);
const diasEntre = (aISO,bISO)=> Math.max(0, Math.ceil((new Date(bISO+'T00:00:00Z')-new Date(aISO+'T00:00:00Z'))/86400000));
const fatorPRE = (taxaAA, dias, base=252)=> Math.pow(1 + (Number(taxaAA)||0), (dias||0)/Number(base||252));
const endOfMonth = (y,m)=> new Date(Date.UTC(Number(y), Number(m), 0));
const toYahoo = (name) => {
  const t = String(name || '').trim().toUpperCase();
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return `${t}.SA`; // B3
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t)) return t;   // EUA/ETFs etc.
  return null;
};

const lastTradingPriceInMonth = (ps, y, m) => {
  if (!ps || !ps.size) return null;
  const ym = `${y}-${String(m).padStart(2,'0')}-`;
  let bestDay = null;
  for (const d of ps.keys()) if (d.startsWith(ym) && (!bestDay || d > bestDay)) bestDay = d;
  if (bestDay) return ps.get(bestDay);
  // fallback: último preço ≤ fim do mês
  const cutoff = `${y}-${String(m).padStart(2,'0')}-31`;
  let bestAny = null;
  for (const d of ps.keys()) if (d <= cutoff && (!bestAny || d > bestAny)) bestAny = d;
  return bestAny ? ps.get(bestAny) : null;
};

// ====== Índices — versão Postgres ======
async function ensureSelic(inicioISO, fimISO){
  const r = await db.query(
    `SELECT 1 FROM indices_selic_diaria WHERE date(data) BETWEEN $1::date AND $2::date LIMIT 1`,
    [inicioISO, fimISO]
  );
  if (r.rowCount) return true;
  if (API_BASE) try {
    await fetch(`${API_BASE}/indices/selic/sync`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ inicio: inicioISO, fim: fimISO })
    });
  } catch {}
  return true;
}
async function ensureCDI(inicioISO, fimISO){
  const r = await db.query(
    `SELECT 1 FROM indices_cdi_diaria WHERE date(data) BETWEEN $1::date AND $2::date LIMIT 1`,
    [inicioISO, fimISO]
  );
  if (r.rowCount) return true;
  if (API_BASE) try {
    await fetch(`${API_BASE}/indices/cdi/sync`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ inicio: inicioISO, fim: fimISO })
    });
  } catch {}
  return true;
}
async function produtoCDIEntre(di, df){
  const { rows } = await db.query(
    `SELECT valor FROM indices_cdi_diaria
      WHERE date(data) BETWEEN $1::date AND $2::date
      ORDER BY date(data) ASC`,
    [di, df]
  );
  let prod = 1;
  for (const r of rows||[]) { const v = Number(r.valor); if (isFinite(v)) prod *= (1 + v/100); }
  return prod;
}
async function fatorIPCAmais(rRealAA, di, df){
  // prepara competências YYYY-MM entre di..df
  const start = new Date(di+'T00:00:00Z'), end = new Date(df+'T00:00:00Z');
  const yms=[]; const cur=new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(),1));
  const last=new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(),1));
  while(cur<=last){ yms.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth()+1).padStart(2,'0')}`); cur.setUTCMonth(cur.getUTCMonth()+1,1); }

  let { rows } = await db.query(
    `SELECT competencia, valor FROM indices_ipca_mensal WHERE competencia = ANY($1::text[])`,
    [yms]
  );
  if ((rows||[]).length < yms.length) {
    const ini=`${yms[0]}-01`, fim=`${yms[yms.length-1]}-28`;
    try {
      await fetch('/api/indices/ipca/sync', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ inicio: ini, fim })
      });
    } catch {}
    const re = await db.query(
      `SELECT competencia, valor FROM indices_ipca_mensal WHERE competencia = ANY($1::text[])`,
      [yms]
    );
    rows = re.rows;
  }
  let prod=1;
  for (const ym of yms) {
    const it = rows.find(x=>x.competencia===ym);
    const v = it ? Number(it.valor) : 0;
    prod *= (1 + v/100);
  }
  const dias = diasEntre(di, df) % 30;
  prod *= fatorPRE(Number(rRealAA||0), dias, 252);
  return prod;
}
async function ensureTesouroPU(nome, inicioISO, fimISO) {
  const hits = async (baseAbs) => {
    const url = `${baseAbs}/tesouro/pu?nome=${encodeURIComponent(nome)}&inicio=${encodeURIComponent(inicioISO)}&fim=${encodeURIComponent(fimISO)}`;
    const r = await fetch(url);
    try { const j = await r.json(); return (Array.isArray(j.items) && j.items.length) ? j.items : []; }
    catch { return []; }
  };
  const bases = API_BASE ? [`${API_BASE}/indices`, `${API_BASE}`] : [];
  for (const baseAbs of bases) {
    const ok = await hits(baseAbs); if (ok.length) return true;
  }
  for (const baseAbs of bases) {
    try {
      await fetch(`${baseAbs}/tesouro/pu/sync-auto`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ inicio: inicioISO, fim: fimISO, nomes: [nome] })
      });
    } catch {}
  }
  return true;
}

// ====== RF — valor teórico no mês (Postgres) ======
async function valorRFnoMes(cfg, fluxosAtivo, ano, mes, overrideManual, ctx = {}){
  if (overrideManual != null) return Number(overrideManual);
  const ultimo = iso(new Date(Date.UTC(ano, mes, 0)));
  if (!ctx.skipEnsureSelic) { try { await ensureSelic((fluxosAtivo[0]?.data || ultimo), ultimo); } catch {} }
  let S=0, last=(fluxosAtivo[0]?.data || ultimo);
  const flows = (fluxosAtivo||[]).filter(f=>f.data<=ultimo).sort((a,b)=>a.data.localeCompare(b.data));

  for(const f of flows){
    if(S!==0){
      if (cfg.indexador === 'PRE') {
        const eventos = (cfg.come_cotas ? comeCotasBetween(last, f.data) : []);
        let ini = last;
        for (const cc of eventos) {
          const fator = fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
          S *= fator;
          if (S > 0) {
            const ganho = S - S / fator;
            const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
            S = Math.max(0, S - Math.max(0, ganho*ali));
          }
          ini = cc;
        }
        S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, f.data), cfg.base_dias || 252);
      } else if (cfg.indexador === 'CDI') {
        const eventos = (cfg.come_cotas ? comeCotasBetween(last, f.data) : []);
        let ini = last;
        for (const cc of eventos) {
          const p1 = ctx.produtoCDIEntreCached ? await ctx.produtoCDIEntreCached(ini, cc) : await produtoCDIEntre(ini, cc);
          const fator = Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
          S *= fator;
          if (S > 0) {
            const ganho = S - S / fator;
            const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
            S = Math.max(0, S - Math.max(0, ganho*ali));
          }
          ini = cc;
        }
        const p2 = ctx.produtoCDIEntreCached ? await ctx.produtoCDIEntreCached(ini, f.data) : await produtoCDIEntre(ini, f.data);
        S *= Math.pow(p2, Number(cfg.percentual_cdi || 0) / 100);
      } else if (cfg.indexador === 'IPCA') {
        const eventos = (cfg.come_cotas ? comeCotasBetween(last, f.data) : []);
        let ini = last;
        for (const cc of eventos) {
          const p1 = ctx.fatorIPCAmaisCached ? await ctx.fatorIPCAmaisCached(Number(cfg.taxa_anual||0), ini, cc) : await fatorIPCAmais(Number(cfg.taxa_anual||0), ini, cc);
          S *= p1;
          if (S > 0) {
            const ganho = S - S / p1;
            const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
            S = Math.max(0, S - Math.max(0, ganho*ali));
          }
          ini = cc;
        }
        const p2 = ctx.fatorIPCAmaisCached ? await ctx.fatorIPCAmaisCached(Number(cfg.taxa_anual||0), ini, f.data) : await fatorIPCAmais(Number(cfg.taxa_anual||0), ini, f.data);
        S *= p2;
      }
    }
    S += (f.sinal * Math.abs(Number(f.valor_total)||0));
    last=f.data;
  }

  if (S !== 0 && last <= ultimo) {
    if (cfg.indexador === 'PRE') {
      const eventos = (cfg.come_cotas ? comeCotasBetween(last, ultimo) : []);
      let ini = last;
      for (const cc of eventos) {
        const fator = fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
        S *= fator;
        if (S > 0) {
          const ganho = S - S / fator;
          const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
          S = Math.max(0, S - Math.max(0, ganho*ali));
        }
        ini = cc;
      }
      S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, ultimo), cfg.base_dias || 252);
    } else if (cfg.indexador === 'CDI') {
      const eventos = (cfg.come_cotas ? comeCotasBetween(last, ultimo) : []);
      let ini = last;
      for (const cc of eventos) {
        const p1 = ctx.produtoCDIEntreCached ? await ctx.produtoCDIEntreCached(ini, cc) : await produtoCDIEntre(ini, cc);
        const fator = Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
        S *= fator;
        if (S > 0) {
          const ganho = S - S / fator;
          const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
          S = Math.max(0, S - Math.max(0, ganho*ali));
        }
        ini = cc;
      }
      const p2 = ctx.produtoCDIEntreCached ? await ctx.produtoCDIEntreCached(ini, ultimo) : await produtoCDIEntre(ini, ultimo);
      S *= Math.pow(p2, Number(cfg.percentual_cdi || 0) / 100);
    } else if (cfg.indexador === 'IPCA') {
      const eventos = (cfg.come_cotas ? comeCotasBetween(last, ultimo) : []);
      let ini = last;
      for (const cc of eventos) {
        const p1 = ctx.fatorIPCAmaisCached ? await ctx.fatorIPCAmaisCached(Number(cfg.taxa_anual||0), ini, cc) : await fatorIPCAmais(Number(cfg.taxa_anual||0), ini, cc);
        S *= p1;
        if (S > 0) {
          const ganho = S - S / p1;
          const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
          S = Math.max(0, S - Math.max(0, ganho*ali));
        }
        ini = cc;
      }
      const f2 = ctx.fatorIPCAmaisCached ? await ctx.fatorIPCAmaisCached(Number(cfg.taxa_anual||0), ini, ultimo) : await fatorIPCAmais(Number(cfg.taxa_anual||0), ini, ultimo);
      S *= f2;
    }
  }

  // Marcação a mercado Tesouro (PU)
  try {
    const nomeTD = normTituloTesouro(String(cfg.nome_investimento||cfg.nome||cfg.subcategoria||'').trim());
    const ehTesouro = /tesouro/i.test(String(cfg.subcategoria||'')) || /^TESOURO\s/i.test(nomeTD.toUpperCase());
    if (ehTesouro) {
      if (!ctx.skipEnsureTesouro) { try { await ensureTesouroPU(nomeTD, last, ultimo); } catch {} }

      const nomeTD2 = nomeTD.replace(/\bAposentadoria Extra\b/i, '').trim();
      const likeA = `%${nomeTD}%`, likeB = `%${nomeTD2}%`;
      const puIniRow = await db.query(
       `SELECT pu FROM indices_tesouro_pu
          WHERE ( (nome=$1) OR (nome=$2) OR (nome ILIKE $3) OR (nome ILIKE $4) )
            AND (data)::date <= $5::date
          ORDER BY (data)::date DESC LIMIT 1`,
        [nomeTD, nomeTD2, likeA, likeB, last]
      );
      const puFimRow = await db.query(
        `SELECT pu FROM indices_tesouro_pu
          WHERE ( (nome=$1) OR (nome=$2) OR (nome ILIKE $3) OR (nome ILIKE $4) )
            AND (data)::date <= $5::date
          ORDER BY (data)::date DESC LIMIT 1`,
        [nomeTD, nomeTD2, likeA, likeB, ultimo]
      );
      const puIni = Number(puIniRow.rows?.[0]?.pu ?? NaN);
      const puFim = Number(puFimRow.rows?.[0]?.pu ?? NaN);
      if (isFinite(puIni) && isFinite(puFim) && puIni > 0) {
        S *= (puFim / puIni);
      }
    }
  } catch { /* silencioso */ }

  return Number((S||0).toFixed(2));
}

// ====== Rota principal ======
router.get('/', async (req, res) => {
  const usuario_id = req.user.id;
  const { periodo = 'ano', classe_id, subclasse_id, classe, subclasse } = req.query;

  try {
    // Descobre o nome da classe pelo ID (para detectar "Caixa" por contexto)
    let nomeClasseCtx = null;
// pegar nome da classe (se veio classe_id)
if (classe_id) {
  try {
    // tabela correta do projeto: investimento_classes
    const rC = await db.query('SELECT nome FROM investimento_classes WHERE id=$1', [Number(classe_id)]);
    nomeClasseCtx = rC.rows?.[0]?.nome || null;
  } catch {}
}
    const isCaixaCtx = /CAIXA/i.test(String(nomeClasseCtx || classe || ''));
    DBG('classeCtx', { classe_id, nomeClasseCtx, isCaixaCtx });

    // 1) Investimentos do usuário (filtros)
    const whereInv = ['i.usuario_id = $1'];
    const paramsInv = [usuario_id];
    if (classe_id)     { whereInv.push('i.classe_id = $' + (paramsInv.length+1));    paramsInv.push(Number(classe_id)); }
    if (subclasse_id)  { whereInv.push('i.subclasse_id = $' + (paramsInv.length+1)); paramsInv.push(Number(subclasse_id)); }
    if (!classe_id && classe)       { whereInv.push('UPPER(c.nome) = UPPER($'   + (paramsInv.length+1) + ')'); paramsInv.push(String(classe)); }
    if (!subclasse_id && subclasse) { whereInv.push('UPPER(s.nome) = UPPER($'+ (paramsInv.length+1) + ')');     paramsInv.push(String(subclasse)); }

    const rInv = await db.query(
      `SELECT
         i.nome_investimento,
         i.data_operacao,
         i.tipo_operacao,
         i.quantidade,
         i.valor_total,
         i.indexador,
         i.taxa_anual,
         i.percentual_cdi,
         i.base_dias,
         i.come_cotas,
         i.aliquota_comecotas,
         c.nome AS categoria,
         s.nome AS subcategoria
       FROM investimentos i
       LEFT JOIN investimento_classes c   ON c.id = i.classe_id
       LEFT JOIN investimento_subclasses s ON s.id = i.subclasse_id
       WHERE ${whereInv.join(' AND ')}
       ORDER BY date(i.data_operacao) ASC`,
      paramsInv
    );
    const investimentos = rInv.rows;
    DBG('movimentacoes:', investimentos.length, 'classe_id:', classe_id, 'classe:', classe);    

    const ativosPermitidos = new Set(investimentos.map(i => i.nome_investimento));
    if (ativosPermitidos.size === 0) return res.json({ linhas: [], meses: [] });

    // 2) Range contínuo de meses do período (carry-forward garantido)
    const formatKey = (ano, mes) => `${ano}-${String(mes).padStart(2, '0')}`;
    const addMonths = (y,m,delta) => {
      const d = new Date(Date.UTC(y, m-1, 1)); d.setUTCMonth(d.getUTCMonth()+delta,1);
      return [d.getUTCFullYear(), d.getUTCMonth()+1];
    };
    const today = new Date();
    const endY = today.getUTCFullYear(), endM = today.getUTCMonth()+1; // fim = mês atual
    let startY = endY, startM = 1; // default: ano corrente
    if (periodo === '12m') { [startY,startM] = addMonths(endY,endM,-11); }
    else if (periodo === '24m') { [startY,startM] = addMonths(endY,endM,-23); }
    else if (periodo === 'inicio') {
      const first = investimentos[0]?.data_operacao ? new Date(investimentos[0].data_operacao) : new Date(Date.UTC(2000,0,1));
      startY = first.getUTCFullYear(); startM = first.getUTCMonth()+1;
    } // 'ano' => jan do ano corrente
    let todosMeses = [];
    for (let y=startY,m=startM; (y<endY) || (y===endY && m<=endM); ) {
      todosMeses.push(formatKey(y,m));
      [y,m] = addMonths(y,m,1);
    }
    DBG('meses-range:', todosMeses.length, todosMeses[0], '...', todosMeses[todosMeses.length-1]);
    if (!todosMeses.length) return res.json({ linhas: [], meses: [] });

    // 5) Yahoo prices + FX
    const ativosSet = new Set(investimentos.map(i => i.nome_investimento));
    const equities = [];
    for (const nome of ativosSet) { const yf = toYahoo(nome); if (yf) equities.push({ nome, yf }); }

    const [minYYYY, minMM] = todosMeses[0].split('-').map(Number);
    const [maxYYYY, maxMM] = todosMeses[todosMeses.length - 1].split('-').map(Number);
    const period1 = new Date(Date.UTC(minYYYY, minMM - 1, 1)).toISOString().slice(0, 10);
    const period2 = endOfMonth(maxYYYY, maxMM).toISOString().slice(0, 10);

    const priceSeries = new Map(); // nome -> Map('YYYY-MM-DD'->close)
    if (equities.length) {
      const yahooFinance = (await import('yahoo-finance2')).default;
      await Promise.all(equities.map(async ({ nome, yf }) => {
        try {
          const hist = await yahooFinance.historical(yf, { period1, period2, interval: '1d' });
          const mp = new Map();
          (hist || []).forEach(r => {
            const d = new Date(r.date);
            const isoD = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
            const px = (r.close != null ? Number(r.close) : (r.adjClose != null ? Number(r.adjClose) : null));
            if (px && isFinite(px)) mp.set(isoD, px);
          });
          priceSeries.set(nome, mp);
        } catch {}
      }));
    }
    const nomeParaTicker = new Map(equities.map(e => [e.nome, e.yf]));

    const fxSeries = new Map();
    if (equities.some(e => !e.yf.endsWith('.SA'))) {
      const yahooFinance = (await import('yahoo-finance2')).default;
      try {
        const fxHist = await yahooFinance.historical('USDBRL=X', { period1, period2, interval: '1d' });
        (fxHist || []).forEach(r => {
          const d = new Date(r.date);
          const isoD = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10);
          const px = (r.close ?? r.adjClose);
          if (px != null && isFinite(px)) fxSeries.set(isoD, Number(px));
        });
      } catch {}
    }
    const lastFxInMonth = (y, m) => {
      const ym = `${y}-${String(m).padStart(2,'0')}-`;
      let best = null;
      for (const d of fxSeries.keys()) if (d.startsWith(ym) && (!best || d > best)) best = d;
      if (best) return fxSeries.get(best);
      // fallback: último FX até o fim do mês
      const cutoff = `${y}-${String(m).padStart(2,'0')}-31`;
      let bestAny = null;
      for (const d of fxSeries.keys()) if (d <= cutoff && (!bestAny || d > bestAny)) bestAny = d;
      return bestAny ? fxSeries.get(bestAny) : null;
    };

    // 6) Pré-ensure índices p/ RF + cache
    try { await ensureSelic(period1, period2); } catch {}
    try { await ensureCDI(period1, period2); } catch {}
    const ipcaCache = new Map();
    const cdiCache  = new Map();
    const produtoCDIEntreCached = async (di, df) => {
      const key = `${di}|${df}`; if (cdiCache.has(key)) return cdiCache.get(key);
      const val = await produtoCDIEntre(di, df); cdiCache.set(key, val); return val;
    };
    const fatorIPCAmaisCached = async (rRealAA, di, df) => {
      const key = `${rRealAA}|${di}|${df}`; if (ipcaCache.has(key)) return ipcaCache.get(key);
      const val = await fatorIPCAmais(rRealAA, di, df); ipcaCache.set(key, val); return val;
    };

    // 6.1) Pré-ensure PU Tesouro para todos os títulos vistos
    const nomesTesouro = Array.from(ativosSet).filter(n => /^tesouro\s/i.test(String(n)));
    for (const nome of nomesTesouro) {
      try { await ensureTesouroPU(normTituloTesouro(nome), period1, period2); } catch {}
    }

    // 7) Calcula posição mensal por ativo
    const linhas = [];
    for (const chave of todosMeses) {
      const [ano, mes] = chave.split('-').map(Number);
      const limite = endOfMonth(ano, mes);

      // quantidade acumulada até o mês
      const qtdPorAtivo = {};
      investimentos.forEach(inv => {
        const dt = new Date(inv.data_operacao);
        if (dt <= limite) {
          const tipo = String(inv.tipo_operacao || '').toLowerCase();
          const qAbs = Math.abs(Number(inv.quantidade) || 0);
          if (tipo.includes('compra') || tipo.includes('bonific') || tipo.includes('buy') || tipo.includes('aplic')) {
            qtdPorAtivo[inv.nome_investimento] = (qtdPorAtivo[inv.nome_investimento] || 0) + qAbs;
          } else if (
            tipo.includes('venda') || tipo.includes('sell') ||
            tipo.includes('ajuste_bonific') || (tipo.includes('ajuste') && tipo.includes('bonific')) ||
            tipo.includes('resgat') || tipo.includes('leilao') || tipo.includes('leilão')
          ) {
            qtdPorAtivo[inv.nome_investimento] = Math.max(0, (qtdPorAtivo[inv.nome_investimento] || 0) - qAbs);
          }
        }
      });

      for (const [ativo, qtd] of Object.entries(qtdPorAtivo)) {
        if (qtd <= 0) continue;

        const ps = priceSeries.get(ativo);
        const px = lastTradingPriceInMonth(ps, ano, Number(mes));
        let atual = 0;
        if (px != null) {
          const yf = nomeParaTicker.get(ativo);
          const isBR = yf && yf.endsWith('.SA');
          if (isBR) atual = qtd * px;
          else atual = qtd * px * (lastFxInMonth(ano, Number(mes)) || 0);
        }
        // Fallback: sem ticker → saldo por fluxo (aplicações - resgates) até o fim do mês
        if (!atual || atual <= 0) {
          let S = 0;
          for (const inv of investimentos) {
            if (inv.nome_investimento !== ativo) continue;
            const dt = new Date(inv.data_operacao);
            if (dt > limite) continue;
            const t = String(inv.tipo_operacao||'').toLowerCase();
            const sinal = (t.includes('vend') || t.includes('resgat') || t.includes('saíd') || t.includes('saida')) ? -1 : +1;
            S += sinal * Math.abs(Number(inv.valor_total)||0);
          }
          if (S > 0) atual = S;
        }        
        if (atual > 0) linhas.push({ mes: chave, ativo, atual: Number(atual.toFixed(2)) });
      }
    }

// 8) Renda Fixa / Tesouro — valor REAL de mês-fim (mesma lógica do resumo)
const rfMap = new Map();
for (const inv of investimentos) {
  const nome = inv.nome_investimento;
  const subc = String(inv.subcategoria || '');
  const idx  = inv.indexador;
  // considera RF quando há indexador OU for Tesouro na subclasse
  if (/tesouro/i.test(subc) || (idx && String(idx).trim() !== '')) {
    const cur = rfMap.get(nome) || {};
    rfMap.set(nome, {
      nome_investimento: nome,
      indexador: (cur.indexador ?? idx) ?? null,
      taxa_anual: Math.max(Number(cur.taxa_anual||0), Number(inv.taxa_anual||0) || 0) || null,
      percentual_cdi: Math.max(Number(cur.percentual_cdi||0), Number(inv.percentual_cdi||0) || 0) || null,
      base_dias: Number(inv.base_dias || cur.base_dias) || 252,
      come_cotas: Boolean(inv.come_cotas ?? cur.come_cotas) || false,
      aliquota_comecotas: Number(inv.aliquota_comecotas ?? cur.aliquota_comecotas) || 15,
      subcategoria: subc,
      vencimento: inv.vencimento || null,
    });
  }
}
DBG('rfMap.size', rfMap.size);

if (rfMap.size) {
  DBG('rfMap.keys', Array.from(rfMap.keys()));
  const nomes = Array.from(rfMap.keys());
  const fluxo = await db.query(
    `SELECT nome_investimento, (data_operacao)::date AS data, valor_total,
            LOWER(tipo_operacao) AS tipo
       FROM investimentos
      WHERE usuario_id=$1 AND nome_investimento = ANY($2::text[])`,
    [usuario_id, nomes]
  );
  const flowsMap = new Map();
  for (const r of fluxo.rows || []) {
    if (!rfMap.has(r.nome_investimento)) continue;
    const isSell = /vend|resgat|saida|saída|leilao|leilão/.test(String(r.tipo || ''));
    const sinal  = isSell ? -1 : +1;
    if (!flowsMap.has(r.nome_investimento)) flowsMap.set(r.nome_investimento, []);
    flowsMap.get(r.nome_investimento).push({
      data: String(r.data),
      valor_total: Number(r.valor_total) || 0,
      tipo: r.tipo,
      sinal
    });
  }
  // índice rápido mês|ativo -> posição já calculada (equities) para sobrescrever
  const idx = new Map(linhas.map((l,i)=>[`${l.mes}|${l.ativo}`, i]));

  for (const ym of todosMeses) {
    const [yy, mm] = ym.split('-').map(Number);
    const ultimoISO = endOfMonth(yy, mm).toISOString().slice(0,10);

    for (const [nome, cfg] of rfMap.entries()) {
      const flows = (flowsMap.get(nome)||[]).sort((a,b)=>a.data.localeCompare(b.data));
      if (!flows.length) continue;

      // usa a MESMA rotina do resumo para valorar no fim do mês
      const v = await valorRFnaData(
        { ...cfg, nome_investimento: nome },
        flows,
        ultimoISO,
        null,
        { /* caches já usados mais acima quando existir: */
          produtoCDIEntreCached,
          fatorIPCAmaisCached
        }
      );

      DBG('RF mensal', { ym, nome, idx: cfg.indexador || null, v });

      const k = `${ym}|${nome}`;
      const i = idx.get(k);
      if (i != null) {
        // só sobrescreve se o valor calculado for positivo
        if (v > 0) linhas[i].atual = Number(v.toFixed(2));
      } else if (v > 0) {
        idx.set(k, linhas.length);
        linhas.push({ mes: ym, ativo: nome, atual: Number(v.toFixed(2)) });
      }
    }
  }
}

    DBG('linhas:', linhas.length);
    if (!linhas.length && rfMap.size) DBG('atenção', 'rfMap tinha itens mas nenhum valor > 0 foi gerado');
    if (!linhas.length) DBG('linhas vazio (verifique filtros / classe_id / meses)');
    res.json(linhas);
  } catch (err) {
    console.error('Erro /posicao-mensal-por-ativo:', err);
    res.status(500).json({ erro: 'Erro ao calcular posição mensal por ativo' });
  }
});

module.exports = router;