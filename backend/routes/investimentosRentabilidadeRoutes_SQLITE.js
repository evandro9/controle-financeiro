// backend/routes/investimentosRentabilidadeRoutes.js

const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

function isWeekend(d){ const w=d.getUTCDay(); return w===0 || w===6; }
function lastBusinessDayOfMonthUTC(y, m /*1..12*/){
  const d = new Date(Date.UTC(y, m, 0));         // último dia do mês
  while (isWeekend(d)) d.setUTCDate(d.getUTCDate()-1);
  return d;
}
// retorna array de datas ISO ('YYYY-MM-DD') dos come-cotas entre [diISO, dfISO]
function comeCotasBetween(diISO, dfISO){
  const out=[];
  const di=new Date(diISO+'T00:00:00Z'), df=new Date(dfISO+'T00:00:00Z');
  for(let y=di.getUTCFullYear(); y<=df.getUTCFullYear(); y++){
    for(const m of [5,11]){ // Maio, Novembro
      const d = lastBusinessDayOfMonthUTC(y, m);
      if(d>=di && d<=df){
        out.push(d.toISOString().slice(0,10));
      }
    }
  }
  return out.sort();
}

// helper período → range diário
function rangeFromPeriodo(periodo = 'ano') {
  const today = new Date();
  const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  let start;
  if (periodo === '12m') {
    start = new Date(end); start.setUTCDate(start.getUTCDate() - 365);
  } else if (periodo === '24m') {
    start = new Date(end); start.setUTCDate(start.getUTCDate() - 730);
  } else if (periodo === 'inicio') {
    start = new Date(Date.UTC(2000, 0, 1));
  } else { // 'ano'
    start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  }
  const toISO = (d) => d.toISOString().slice(0,10);
  return { startISO: toISO(start), endISO: toISO(end) };
}

// Função auxiliar para calcular rentabilidade com proteção contra divisão por zero
function calcularRentabilidade(atual, base) {
  if (!base || base === 0) return null;
  return ((atual - base) / base) * 100;
}

// === Helpers de calendário de pregão ===
function isBizDay(iso) {
  // iso = 'YYYY-MM-DD'
  const d = new Date(iso + 'T00:00:00Z');
  const wd = d.getUTCDay(); // 0 dom, 6 sáb
  return wd >= 1 && wd <= 5;
}
function prevTrading(datesSet, iso) {
  // último dia de pregão < iso
  let best = null;
  for (const d of datesSet) if (d < iso && (!best || d > best)) best = d;
  return best;
}
function nextTrading(datesSet, iso) {
  // primeiro dia de pregão > iso
  let best = null;
  for (const d of datesSet) if (d > iso && (!best || d < best)) best = d;
  return best;
}

// Normalizador de títulos do Tesouro – igual ao usado na hierárquica
function normTituloTesouro(s = '') {
  // remove acentos, colapsa espaços
  let t = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  // padroniza "Tesouro" no início
  t = t.replace(/^tesouro\s+/i, 'Tesouro ');
  // IPCA "Mais" -> "IPCA+"
  t = t.replace(/\bIPCA\s*(MAIS|\+)?\b/i, 'IPCA+');
  // Renda Mais -> Renda+
  t = t.replace(/\bRenda\s*\+\b/i, 'Renda+').replace(/\bRenda\s*Mais\b/i, 'Renda+');
  // Prefixado/Selic já estão ok; remove espaços repetidos de novo
  return t.replace(/\s+/g, ' ').trim();
}

// ------------ Renda Fixa helpers (mesmos do arquivo anterior) ------------
function iso(d){return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())).toISOString().slice(0,10);}
async function ensureSelic(db, inicioISO, fimISO){
  return new Promise((resolve,reject)=>{
    db.get(`SELECT 1 FROM indices_selic_diaria WHERE data BETWEEN ? AND ? LIMIT 1`,
      [inicioISO, fimISO],
      async (e,row)=>{
        if (e) return reject(e);
        if (row) return resolve(true);
        try {
          await fetch('/api/indices/selic/sync', {
            method: 'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ inicio: inicioISO, fim: fimISO })
          });
          resolve(true);
        } catch {
          resolve(false);
        }
      });
  });
}

function fatorPRE(t,d,b=252){const r=Number(t)||0;return Math.pow(1+r,(d||0)/Number(b||252));}

function diasEntre(a,b){return Math.max(0,Math.ceil((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/86400000));}

function produtoSelicEntre(db,di,df){return new Promise((resolve,reject)=>{db.all(`SELECT valor FROM indices_selic_diaria WHERE data BETWEEN ? AND ? ORDER BY data ASC`,[di,df],(e,rows)=>{if(e)return reject(e);let p=1;for(const r of rows||[]){const v=Number(r.valor);if(isFinite(v))p*=(1+v/100);}resolve(p);});});}

async function ensureTesouroPU(nome, inicioISO, fimISO) {
   const base = '/api/indices';
   try {
     let r = await fetch(`${base}/tesouro/pu?nome=${encodeURIComponent(nome)}&inicio=${encodeURIComponent(inicioISO)}&fim=${encodeURIComponent(fimISO)}`);
     let j = await r.json().catch(()=>({}));
     if (Array.isArray(j.items) && j.items.length) return true;
     await fetch(`${base}/tesouro/pu/sync-auto`, {
       method:'POST',
       headers:{ 'Content-Type':'application/json' },
       body: JSON.stringify({ inicio: inicioISO, fim: fimISO, nomes: [nome] })
     });
     r = await fetch(`${base}/tesouro/pu?nome=${encodeURIComponent(nome)}&inicio=${encodeURIComponent(inicioISO)}&fim=${encodeURIComponent(fimISO)}`);
     j = await r.json().catch(()=>({}));
     return Array.isArray(j.items) && j.items.length;
   } catch { return false; }
 }

async function fatorIPCAmais(db, r, di, df){
  const s=new Date(di+'T00:00:00Z'), e=new Date(df+'T00:00:00Z');
  const yms=[]; const c=new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(),1));
  const l=new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(),1));
  while(c<=l){ yms.push(`${c.getUTCFullYear()}-${String(c.getUTCMonth()+1).padStart(2,'0')}`); c.setUTCMonth(c.getUTCMonth()+1,1); }
  let rows=await new Promise((res,rej)=>db.all(
    `SELECT competencia,valor FROM indices_ipca_mensal WHERE competencia IN (${yms.map(()=>'?').join(',')})`,
    yms,(er,rr)=>er?rej(er):res(rr||[])
  ));
  if(rows.length<yms.length){
    const ini=`${yms[0]}-01`, fim=`${yms[yms.length-1]}-28`;
    await fetch('/api/indices/ipca/sync', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ inicio: ini, fim })
    });
    rows=await new Promise((res,rej)=>db.all(
      `SELECT competencia,valor FROM indices_ipca_mensal WHERE competencia IN (${yms.map(()=>'?').join(',')})`,
      yms,(er,rr)=>er?rej(er):res(rr||[])
    ));
  }
  let p=1; for(const ym of yms){ const it=rows.find(x=>x.competencia===ym); const v=it?Number(it.valor):0; p*=(1+v/100); }
  p*=fatorPRE(Number(r||0), diasEntre(di,df)%30, 252);
  return p;
}

async function valorRFnaData(db,cfg,flows,alvoISO,overrideManual){
  if(overrideManual!=null) return Number(overrideManual);
  // capitaliza desde o primeiro fluxo até a data alvo
  await ensureSelic(db, (flows[0]?.data||alvoISO), alvoISO);
  let S=0,last=(flows[0]?.data||alvoISO);
  const fs=(flows||[]).filter(f=>f.data<=alvoISO).sort((a,b)=>a.data.localeCompare(b.data));
  for(const f of fs){
    if(S!==0){
if (cfg.indexador === 'PRE') {
  const eventos = (cfg.come_cotas ? comeCotasBetween(last, f.data) : []);
  let ini = last;
  for (const cc of eventos) {
    S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
    if (S > 0) {
      const ganho = S - S / fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
      const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
      const ir  = Math.max(0, ganho * ali);
      S = Math.max(0, S - ir);
    }
    ini = cc;
  }
  S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, f.data), cfg.base_dias || 252);
}
else if (cfg.indexador === 'CDI') {
  const eventos = (cfg.come_cotas ? comeCotasBetween(last, f.data) : []);
  let ini = last;
  for (const cc of eventos) {
    const p1 = await produtoCDIEntre(db, ini, cc);
    S *= Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
    if (S > 0) {
      const ganho = S - S / Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
      const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
      const ir  = Math.max(0, ganho * ali);
      S = Math.max(0, S - ir);
    }
    ini = cc;
  }
  const p2 = await produtoCDIEntre(db, ini, f.data);
  S *= Math.pow(p2, Number(cfg.percentual_cdi || 0) / 100);
}
else if (cfg.indexador === 'IPCA') {
  const eventos = (cfg.come_cotas ? comeCotasBetween(last, f.data) : []);
  let ini = last;
  for (const cc of eventos) {
    const p1 = await fatorIPCAmais(db, Number(cfg.taxa_anual || 0), ini, cc);
    S *= p1;
    if (S > 0) {
      const ganho = S - S / p1;
      const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
      const ir  = Math.max(0, ganho * ali);
      S = Math.max(0, S - ir);
    }
    ini = cc;
  }
  const p2 = await fatorIPCAmais(db, Number(cfg.taxa_anual || 0), ini, f.data);
  S *= p2;
}
    }
    S+=(f.sinal*Math.abs(Number(f.valor_total)||0)); last=f.data;
  }
if (S !== 0 && last <= alvoISO) {
  if (cfg.indexador === 'PRE') {
    const eventos = (cfg.come_cotas ? comeCotasBetween(last, alvoISO) : []);
    let ini = last;
    for (const cc of eventos) {
      S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
      if (S > 0) {
        const ganho = S - S / fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
        const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
        const ir  = Math.max(0, ganho * ali);
        S = Math.max(0, S - ir);
      }
      ini = cc;
    }
    S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, alvoISO), cfg.base_dias || 252);
  }
  else if (cfg.indexador === 'CDI') {
    const eventos = (cfg.come_cotas ? comeCotasBetween(last, alvoISO) : []);
    let ini = last;
    for (const cc of eventos) {
      const p1 = await produtoCDIEntre(db, ini, cc);
      S *= Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
      if (S > 0) {
        const ganho = S - S / Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
        const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
        const ir  = Math.max(0, ganho * ali);
        S = Math.max(0, S - ir);
      }
      ini = cc;
    }
    const p2 = await produtoCDIEntre(db, ini, alvoISO);
    S *= Math.pow(p2, Number(cfg.percentual_cdi || 0) / 100);
  }
  else if (cfg.indexador === 'IPCA') {
    const eventos = (cfg.come_cotas ? comeCotasBetween(last, alvoISO) : []);
    let ini = last;
    for (const cc of eventos) {
      const p1 = await fatorIPCAmais(db, Number(cfg.taxa_anual || 0), ini, cc);
      S *= p1;
      if (S > 0) {
        const ganho = S - S / p1;
        const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
        const ir  = Math.max(0, ganho * ali);
        S = Math.max(0, S - ir);
      }
      ini = cc;
    }
    const p2 = await fatorIPCAmais(db, Number(cfg.taxa_anual || 0), ini, alvoISO);
    S *= p2;
  }

      // === Marcação a Mercado (PU Tesouro) na data alvo ===
      const ehTesouro = String(cfg?.subcategoria||'').toLowerCase().includes('tesouro')
                     || /^TESOURO\s/.test(String(cfg?.nome_investimento||'').toUpperCase());
      if (ehTesouro) {
        try {
          const nomeOriginal = String(cfg.nome_investimento||'').trim();
          const nomeTD = normTituloTesouro(nomeOriginal);
          // garante existência de PU apenas do que interessa (idempotente)
          const okPU = await ensureTesouroPU(nomeTD, last, alvoISO);
          const url = `/api/indices/tesouro/pu?nome=${encodeURIComponent(nomeTD)}&inicio=${encodeURIComponent(last)}&fim=${encodeURIComponent(alvoISO)}`;
          const r = await fetch(url);
          const j = await r.json().catch(()=>({}));
          const items = Array.isArray(j?.items) ? j.items : [];
          const puIni = (() => {
            const cand = items.filter(x => x.data <= last);
            return cand.length ? Number(cand[cand.length-1].pu) : Number(items[0]?.pu);
          })();
          const puFim = (() => {
            const cand = items.filter(x => x.data <= alvoISO);
            return cand.length ? Number(cand[cand.length-1].pu) : Number(items[items.length-1]?.pu);
          })();
          if (isFinite(puIni) && isFinite(puFim) && puIni > 0) {
            S *= (puFim / puIni);
          }
        } catch { /* se faltar PU mesmo após sync, segue sem MtM */ }
      }

}
  return Number((S||0).toFixed(2));
}

async function ensureCDI(db, inicioISO, fimISO) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT 1 FROM indices_cdi_diaria WHERE data BETWEEN ? AND ? LIMIT 1`,
      [inicioISO, fimISO],
      async (e, row) => {
        if (e) return reject(e);
        if (row) return resolve(true);
        try {
          await fetch('/api/indices/cdi/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inicio: inicioISO, fim: fimISO })
          });
          resolve(true);
        } catch {
          resolve(false);
        }
      }
    );
  });
}

function produtoCDIEntre(db, di, df) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT valor FROM indices_cdi_diaria WHERE data BETWEEN ? AND ? ORDER BY data ASC`,
      [di, df],
      (e, rows) => {
        if (e) return reject(e);
        let prod = 1;
        for (const r of rows || []) {
          const v = Number(r.valor);
          if (isFinite(v)) prod *= (1 + v / 100); // v é % ao dia
        }
        resolve(prod);
      }
    );
  });
}

// Garante auth em todas as rotas abaixo
router.use(auth);


// 📊 Rota 1: Rentabilidade DETALHADA por ativo e subclasse (usada pela tabela)
router.get('/rentabilidade-detalhada', (req, res) => {
  const { ano, subclasse } = req.query;
  const usuario_id = req.user.id;

  if (!ano) return res.status(400).json({ erro: 'Ano é obrigatório.' });

  const params = [usuario_id];
  let query = `
    SELECT
      i.nome_investimento,
      i.subcategoria,
      SUM(
        CASE 
          WHEN LOWER(i.tipo_operacao) LIKE '%compra%'
            OR LOWER(i.tipo_operacao) LIKE '%buy%'
            OR LOWER(i.tipo_operacao) LIKE '%aplic%'
          THEN i.valor_total
          ELSE 0
        END
      ) AS valor_compra
    FROM investimentos i
    WHERE i.usuario_id = ?
  `;
  if (subclasse) {
    query += ' AND i.subcategoria LIKE ?';
    params.push(`%${subclasse}%`);
  }
  query += ' GROUP BY i.nome_investimento, i.subcategoria';

  db.all(query, params, (err, compras) => {
    if (err) return res.status(500).json({ erro: 'Erro ao buscar compras.' });

    const comprasMap = {};
    compras.forEach(c => {
      comprasMap[c.nome_investimento] = c.valor_compra || 1;
    });

    const valoresParams = [usuario_id, ano];
    let valoresQuery = `
      SELECT
        strftime('%m', va.data_referencia) AS mes,
        va.data_referencia,
        i.subcategoria AS subclasse,
        i.nome_investimento AS ativo,
        va.valor_total AS valor_atual
      FROM valores_atuais va
      JOIN investimentos i 
        ON i.nome_investimento = va.nome_investimento 
        AND i.usuario_id = va.usuario_id
      WHERE va.usuario_id = ?
        AND strftime('%Y', va.data_referencia) = ?
    `;

    if (subclasse) {
      valoresQuery += ' AND i.subcategoria LIKE ?';
      valoresParams.push(`%${subclasse}%`);
    }

    valoresQuery += ' ORDER BY i.subcategoria, i.nome_investimento, va.data_referencia';

    db.all(valoresQuery, valoresParams, (err2, rows) => {
      if (err2) return res.status(500).json({ erro: 'Erro ao buscar rentabilidade.' });

      const agrupado = {};
      rows.forEach(r => {
        const chave = `${r.subclasse}||${r.ativo}`;
        if (!agrupado[chave]) agrupado[chave] = {
          valor_compra: comprasMap[r.ativo] || 1,
          historico: []
        };
        agrupado[chave].historico.push({
          mes: parseInt(r.mes),
          valor: r.valor_atual,
          data: r.data_referencia
        });
      });

      const resultado = [];

      for (const chave in agrupado) {
        const [subclasse, ativo] = chave.split('||');
        const { valor_compra, historico } = agrupado[chave];

        historico.sort((a, b) => a.mes - b.mes);

        for (let i = 0; i < historico.length; i++) {
          const atual = historico[i].valor;
          const mes = historico[i].mes;
          let base = i === 0 ? valor_compra : historico[i - 1].valor;

          const rentabilidade = calcularRentabilidade(atual, base);
          resultado.push({
  mes,
  subclasse,
  ativo,
  rentabilidade_pct: rentabilidade,
  valor_investido: base // <- base já é o valor acumulado certo até o mês
});
        }
      }

      res.json(Array.isArray(resultado || []) ? resultado || [] : []);
    });
  });
});

// 📈 Rentabilidade Mensal Geral (agora derivada da diária TWR)
router.get("/rentabilidade-mensal/:ano", (req, res) => {
  const usuarioId = req.user.id;
  const ano = Number(req.params.ano);
  const { periodo = 'ano' } = req.query;
  // janela alvo do ano (a rota mantém a semântica original)
  const startISO = `${ano}-01-01`;
  const endISO   = `${ano}-12-31`;

  // Reusa a própria função/rota diária programaticamente
  // (encapsule a lógica diária em uma função pura se preferir)
  req.query.periodo = 'inicio';
  // chame a mesma lógica que gera o array "daily" (retornos diários %)
  // e a seguir só agregue por mês:
  if (typeof gerarSerieDiaria !== 'function') {
   console.error('[rentabilidade-mensal] gerarSerieDiaria não está disponível neste módulo');
    return res.json([]);
  }
  gerarSerieDiaria(usuarioId, req.query).then((dailyAll=[]) => {
    const daily = dailyAll.filter(d => d.date >= startISO && d.date <= endISO);
    let mensal = agregaMensalTWR(daily);
    if (periodo === '12m') mensal = mensal.slice(-12);
    else if (periodo === '24m') mensal = mensal.slice(-24);
    else if (periodo === 'ano') mensal = mensal.filter(m => m.ano_mes.startsWith(String(ano)));
    res.json(mensal);
  }).catch(() => res.json([]));
});

const toYahoo = (name) => {
  const t = String(name || '').trim().toUpperCase();
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return `${t}.SA`; // B3
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t)) return t;   // EUA/ETFs etc.
  return null;
};
const detectSplitFactor = (pOld, pNew) => {
  if (!pOld || !pNew) return 1;
  const ratios = [2,3,4,5,10];
  const r = pOld / pNew;
  for (const k of ratios) if (Math.abs(r - k) / k <= 0.05) return k;
  return 1;
};

async function buildPriceSeriesFor(equities, startISO, endISO, padDays = 7, priceMode = 'adj') {
  const startPad = new Date(startISO); startPad.setUTCDate(startPad.getUTCDate() - padDays);
  const p1 = startPad.toISOString().slice(0,10);
  const p2 = endISO;
  const priceSeries = new Map();
  if (!equities.length) return priceSeries;
  const yahooFinance = (await import('yahoo-finance2')).default;
  await Promise.all(equities.map(async ({ nome, yf }) => {
    try {
      const hist = await yahooFinance.historical(yf, { period1: p1, period2: p2, interval: '1d' });
      const mp = new Map();
      (hist || []).forEach(r => {
        const d = new Date(r.date);
        const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10);
        // priceMode: 'close' (price return) | 'adj' (total return com proventos)
        // 'adj' => sempre adjClose; só cai para close se NÃO existir adjClose
        const px = (priceMode === 'adj')
          ? (r.adjClose != null ? r.adjClose : r.close)
          : (r.close != null ? r.close : r.adjClose);
        // só dias úteis (previne “sábado fantasma” por fuso/normalização)
        const wd = new Date(iso + 'T00:00:00Z').getUTCDay(); // 0-dom,6-sáb
        if (px && wd >= 1 && wd <= 5) mp.set(iso, Number(px));
      });
      priceSeries.set(nome, mp);
    } catch(e){ console.error('⚠️ preço diário', yf, e?.message); }
  }));
  return priceSeries;
}

// === FX histórico (USDBRL) para converter séries em USD → BRL ===
async function buildFXSeriesUSDBRL(startISO, endISO, padDays = 15) {
  const startPad = new Date(startISO); startPad.setUTCDate(startPad.getUTCDate() - padDays);
  const p1 = startPad.toISOString().slice(0,10);
  const p2 = endISO;
  const mp = new Map();
  const yahooFinance = (await import('yahoo-finance2')).default;
  try {
    const hist = await yahooFinance.historical('USDBRL=X', { period1: p1, period2: p2, interval: '1d' });
    (hist || []).forEach(r => {
      const d = new Date(r.date);
      const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10);
      const px = (r.adjClose != null ? r.adjClose : r.close);
      const wd = new Date(iso + 'T00:00:00Z').getUTCDay(); // 1..5
      if (px && wd >= 1 && wd <= 5) mp.set(iso, Number(px));
    });
  } catch(e){ console.error('⚠️ FX USDBRL', e?.message); }
  return mp;
}
function fxOnOrBefore(fxMap, iso) {
  if (!fxMap || !fxMap.size) return null;
  let best = null;
  for (const d of fxMap.keys()) if (d <= iso && (!best || d > best)) best = d;
  return best ? fxMap.get(best) : null;
}

function prevMarketPrice(psMap, startISO) {
  if (!psMap) return null;
  let best=null;
  for (const d of psMap.keys()) if (d < startISO && (!best || d > best)) best = d;
  return best ? psMap.get(best) : null;
}
function agregaMensalTWR(daily) {
  const byMonth = new Map(); // 'YYYY-MM' -> fator
  for (const d of (daily||[])) {
    const ym = d.date.slice(0,7);
    if (!byMonth.has(ym)) byMonth.set(ym, 1);
    const f = 1 + ((Number(d.valor)||0)/100);
    byMonth.set(ym, byMonth.get(ym) * f);
  }
  return Array.from(byMonth.entries())
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([ym,f]) => ({ ano_mes: ym, mes: parseInt(ym.slice(5,7),10), rentabilidade_pct: Number(((f-1)*100).toFixed(2)) }));
}

// 📊 Rentabilidade por Subclasse e Ativo (TWR mensal por ativo + subtotal por subclasse)
router.get('/rentabilidade-subclasse-ativo/:ano', async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const ano = Number(req.params.ano);
    const startISO = `${ano}-01-01`;
    const endISO   = `${ano}-12-31`;
    const startInt = Number(startISO.replaceAll('-', ''));
    const priceMode = 'adj'; // usa adjClose (total return)

    // filtros opcionais
    const onlyAtivos = String(req.query.onlyAtivos || '')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    // 1) Dados base
    const compras = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          nome_investimento,
          COALESCE(subcategoria,'Outros') AS subclasse,
          LOWER(COALESCE(tipo_operacao,'')) AS tipo_operacao,
          date(data_operacao) AS data_operacao,
          quantidade,
          valor_unitario
        FROM investimentos
        WHERE usuario_id = ? AND date(data_operacao) <= date(?)
        ORDER BY date(data_operacao) ASC
      `, [usuarioId, endISO], (e, rows) => e ? reject(e) : resolve(rows || []));
    });
    const valores = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          nome_investimento,
          date(data_referencia) AS data_referencia,
          preco_unitario,
          valor_total
        FROM valores_atuais
        WHERE usuario_id = ? AND date(data_referencia) <= date(?)
        ORDER BY date(data_referencia) ASC
      `, [usuarioId, endISO], (e, rows) => e ? reject(e) : resolve(rows || []));
    });

    // 2) Organiza por ativo
    const porAtivo = new Map(); // nome -> { subclasse, compras[], valores[] }
    const ensure = (nome, subc='Outros') => {
      if (!porAtivo.has(nome)) porAtivo.set(nome, { subclasse: subc, compras: [], valores: [] });
      return porAtivo.get(nome);
    };
    // 2.1) Constrói a lista de ATIVOS válidos a partir de 'investimentos'
    const ativosInvest = new Set();
    for (const c of compras) {
      ativosInvest.add(c.nome_investimento);
      const a = ensure(c.nome_investimento, c.subclasse);
      a.subclasse = c.subclasse || a.subclasse;
      const op = String(c.tipo_operacao || '').toLowerCase();
      const quant = Math.abs(Number(c.quantidade) || 0);
      const pu    = Number(c.valor_unitario) || 0;
      // classifica
      let tipo = 'outro', qtd = quant, flow = true;
      if (op.includes('compra') || op.includes('buy') || op.includes('aplic')) {
        tipo = 'compra'; qtd = +quant; flow = true;
      } else if (op.includes('venda') || op.includes('sell') || op.includes('resgat') || op.includes('saida') || op.includes('saída')) {
        tipo = 'venda'; qtd = -quant; flow = true;
      } else if (op.includes('ajuste_bonificacao') || (op.includes('ajuste') && op.includes('bonific'))) {
        // fração em ativos: baixa quantidade sem mexer no custo → NÃO é fluxo
        tipo = 'ajuste_bonificacao'; qtd = -quant; flow = false;
      } else if (op.includes('bonific')) {
        // bonificação: aumenta qty e custo não muda → NÃO é fluxo
        tipo = 'bonificacao'; qtd = +quant; flow = false;
      }
      a.compras.push({
        date: c.data_operacao,
        dateInt: Number(c.data_operacao.replaceAll('-', '')),
        qtd, pu, tipo, flow
      });
    }
    // 2.2) Só anexa 'valores_atuais' para quem EXISTE em 'investimentos'
    for (const v of valores) {
      if (!ativosInvest.has(v.nome_investimento)) continue; // ignora “fantasmas” (ITUB4, etc.)
      const a = ensure(v.nome_investimento);
      a.valores.push({
        date: v.data_referencia,
        dateInt: Number(v.data_referencia.replaceAll('-', '')),
        preco_unitario: v.preco_unitario != null ? Number(v.preco_unitario) : null,
        valor_total: v.valor_total != null ? Number(v.valor_total) : null
      });
    }
    // 2.3) (opcional) se vier onlyAtivos=..., aplica em cima da lista válida
    if (onlyAtivos.length) {
      for (const nome of Array.from(porAtivo.keys())) {
        if (!onlyAtivos.includes(String(nome).toUpperCase())) porAtivo.delete(nome);
      }
    }
    for (const a of porAtivo.values()) {
      a.compras.sort((x,y)=>x.dateInt - y.dateInt);
      a.valores.sort((x,y)=>x.dateInt - y.dateInt);
    }

    // 3) Preço diário de mercado (para ativos com padrão B3)
    const equities = [];
    for (const [nome, obj] of porAtivo.entries()) {
      const yf = toYahoo(nome); // ex.: XPLG11 -> XPLG11.SA | VOO -> VOO
      if (yf) equities.push({ nome, yf });
    }
    const nomeToYf = new Map(equities.map(e => [e.nome, e.yf]));

    // 3) Séries de preços (Adj Close) + FX para não-.SA
    const priceSeries = await buildPriceSeriesFor(equities, startISO, endISO, /*padDays*/15, 'adj');
    const fxUSDBRL = await buildFXSeriesUSDBRL(startISO, endISO, 15);
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
    // 3.1) Tesouro Direto → injeta PU como “série de preços” (marcação a mercado)
    const tesouros = [];
    for (const [nome, a] of porAtivo.entries()) {
      if (String(a.subclasse||'').toLowerCase().includes('tesouro')) {
        tesouros.push({ nome, titulo: normTituloTesouro(nome) });
      }
    }
    for (const t of tesouros) {
      try {
        await ensureTesouroPU(t.titulo, startISO, endISO); // idempotente
        const r = await fetch(
          `/api/indices/tesouro/pu?nome=${encodeURIComponent(t.titulo)}&inicio=${encodeURIComponent(startISO)}&fim=${encodeURIComponent(endISO)}`
        );
        const j = await r.json().catch(() => ({ items: [] }));
        const mp = new Map((j.items || []).map(it => [String(it.data), Number(it.pu)]));
        if (mp.size) {
          // usa o NOME do ativo como chave (igual aos demais)
          priceSeries.set(t.nome, mp);
        }
      } catch (e) {
        console.warn('[mensal][TD] falha PU', t.titulo, e?.message);
      }
    }

    // 4) Calendário SOMENTE de dias realmente usados:
    //    - pregões (vêm das séries de preços)
    //    - dias com FLUXO reindexados para próximo/último pregão
    //    - NAV de não-equities reindexados para ÚLTIMO pregão anterior
    const diasTradingSet = new Set();
    for (const mp of priceSeries.values()) {
      for (const d of mp.keys()) {
        if (d >= startISO && d <= endISO) diasTradingSet.add(d);
      }
    }
    const flowDaysSet = new Set();
    for (const [nome, a] of porAtivo.entries()) {
      for (const tr of a.compras) {
        if (tr.date < startISO || tr.date > endISO) continue;
        const trg = diasTradingSet.has(tr.date)
          ? tr.date
          : (nextTrading(diasTradingSet, tr.date) || prevTrading(diasTradingSet, tr.date));
        if (trg) flowDaysSet.add(trg);
      }
    }
    const navDaysNonEq = new Set();
    for (const [nome, a] of porAtivo.entries()) {
      if (toYahoo(nome)) continue; // só para quem NÃO tem série de mercado
      for (const v of a.valores) {
        if (v.date < startISO || v.date > endISO) continue;
        const trg = prevTrading(diasTradingSet, v.date);
        if (trg) navDaysNonEq.add(trg);
      }
    }
    const diasEfetivos = new Set([...diasTradingSet, ...flowDaysSet, ...navDaysNonEq]);
    const days = Array.from(diasEfetivos).sort().map(iso => ({ iso, int: Number(iso.replaceAll('-', '')) }));

// 5) Série diária por ativo (estrutura base; usaremos em TWR e para bases do MWR)
    const state = new Map(); // nome -> estado
    for (const [nome, a] of porAtivo.entries()) {
      const ps = priceSeries.get(nome);
      const prevPx = prevMarketPrice(ps, startISO);
      state.set(nome, {
        subclasse: a.subclasse,
        qi: 0, pi: 0,
        cumQtd: 0,
        avgCostNum: 0,
        lastPrice: prevPx ?? null,
        lastValRow: null,
        comp: a.compras,
        vals: a.valores
      });
    }

      // === PRE-ÂNCORA: calcula V_{t-1} (valor da carteira no ÚLTIMO pregão ANTES do primeiro dia do período) ===
  let prevVInit = null;
  if (days.length) {
    const firstInt = days[0].int;
    for (const [nome, st] of state.entries()) {
      // avança transações até a véspera
      while (st.qi < st.comp.length && st.comp[st.qi].dateInt < firstInt) {
        const tr = st.comp[st.qi];
        if (tr.qtd >= 0) { st.avgCostNum += tr.qtd * tr.pu; st.cumQtd += tr.qtd; }
        else {
          const sell = -tr.qtd;
          const avg = st.cumQtd > 0 ? (st.avgCostNum / st.cumQtd) : 0;
          st.avgCostNum -= sell * avg; st.cumQtd -= sell;
          if (st.cumQtd < 1e-7) { st.cumQtd = 0; st.avgCostNum = 0; }
        }
        st.qi++;
      }
      // avança valores_atuais até a véspera
      while (st.pi < st.vals.length && st.vals[st.pi].dateInt < firstInt) {
        st.lastValRow = st.vals[st.pi]; st.pi++;
      }
      // preço do último pregão antes do período (ou fallback)
      const ps = priceSeries.get(nome);
      let pPrev = ps ? prevMarketPrice(ps, days[0].iso) : null;
      if (pPrev == null && st.lastValRow) {
        pPrev = st.lastValRow.preco_unitario != null
          ? Number(st.lastValRow.preco_unitario)
          : (st.cumQtd > 0 ? Number(st.lastValRow.valor_total) / st.cumQtd : null);
      }
      if (pPrev == null && st.cumQtd > 0 && st.avgCostNum > 0) {
        pPrev = st.avgCostNum / st.cumQtd; // WAC como último recurso
      }
      if (pPrev != null) {
        st.lastPrice = pPrev;
        // valor da posição no ÚLTIMO pregão antes do período (ex.: 2024-12 EOM)
        st._VprevInit = st.cumQtd * pPrev;
        prevVInit = (prevVInit ?? 0) + st._VprevInit;
      }
    }
  }

    const dailyRetByAtivo = new Map(); // nome -> [{date, valor}]

    const lastTradingPriceAndDate = (ps, year, month) => {
      if (!ps || !ps.size) return {px:null, dt:null};
      const mm = String(month).padStart(2,'0');
      let lastDay = null;
      for (const d of ps.keys()) {
        if (d.startsWith(`${year}-${mm}-`) && (!lastDay || d > lastDay)) lastDay = d;
      }
      return lastDay ? { px: ps.get(lastDay), dt: lastDay } : { px: null, dt: null };
    };

    // Série DIÁRIA da carteira (neutra a fluxos) para depois agregar por mês
    const dailyPortfolio = [];
    let prevV_port = null;   // V_{t-1} da carteira
    let prevVInit_port = prevVInit ?? null; // âncora: valor no último pregão ANTES do 1º dia

    for (const d of days) {
      let V_all = 0, F_all = 0;
      const V_sub = new Map(), F_sub = new Map();

      for (const [nome, st] of state.entries()) {
        // aplica transações até o dia e captura Δq SOMENTE de fluxos (compra/venda)
        let deltaQtdFlowHoje = 0;
        while (st.qi < st.comp.length && st.comp[st.qi].dateInt <= d.int) {
          const tr = st.comp[st.qi];
          if (tr.dateInt === d.int && tr.flow) deltaQtdFlowHoje += tr.qtd;
          // aplica efeito no estoque/custo conforme o TIPO
          if (tr.tipo === 'bonificacao') {
            // +qtd, custo NÃO muda
            st.cumQtd += Math.max(0, tr.qtd);
          } else if (tr.tipo === 'ajuste_bonificacao') {
            // -qtd, custo NÃO muda
            const dec = Math.max(0, -tr.qtd);
            st.cumQtd = Math.max(0, st.cumQtd - dec);
            // custo fica igual (PM sobe por menos cotas)
          } else if (tr.qtd >= 0) {
            // compra normal
            st.avgCostNum += tr.qtd * tr.pu; st.cumQtd += tr.qtd;
          } else {
            // venda: baixa a PM
            const sell = -tr.qtd;
            const avg = st.cumQtd > 0 ? (st.avgCostNum / st.cumQtd) : 0;
            st.avgCostNum -= sell * avg; st.cumQtd -= sell;
            if (st.cumQtd < 1e-7) { st.cumQtd = 0; st.avgCostNum = 0; }
          }
          st.qi++;
        }
        // atualiza último valor_atuais até o dia
        while (st.pi < st.vals.length && st.vals[st.pi].dateInt <= d.int) {
          st.lastValRow = st.vals[st.pi]; st.pi++;
        }
    
       // guarda preço do DIA ANTERIOR (para valorar fluxo)
        const prevPriceForFlow = st.lastPrice;
        // preço de avaliação (market/carry/valores_atuais/WAC) -> priceToday
let priceToday = st.lastPrice;
let priceSource = 'carry';
      const ps = priceSeries.get(nome);
      const hasPs = ps && ps.size > 0;
      if (hasPs) {
        if (ps.has(d.iso)) {
          priceToday = ps.get(d.iso);
          st.lastPrice = priceToday;
          priceSource = 'market';
        }
        // se não tem preço de mercado no dia, mantemos carry: source permanece 'carry'
      } else if (st.lastValRow) {
        let p=null;
        if (st.lastValRow.preco_unitario!=null) p=Number(st.lastValRow.preco_unitario);
        else if (st.lastValRow.valor_total!=null) p=(st.cumQtd>0)?(Number(st.lastValRow.valor_total)/st.cumQtd):null;
        if (p && isFinite(p)) {
          if (st.lastPrice) {
            const k = detectSplitFactor(st.lastPrice,p);
            if (k!==1) st.cumQtd *= k;
          }
          priceToday = p; st.lastPrice = p;
          priceSource = (st.lastValRow.preco_unitario!=null) ? 'valores_atuais.preco' : 'valores_atuais.vtotal/cumQtd';
          } else if (st.cumQtd>0 && st.avgCostNum>0) {
            priceToday = (st.avgCostNum / st.cumQtd);
            priceSource = 'wac';
        }
        } else if (st.cumQtd>0 && st.avgCostNum>0) {
          priceToday = (st.avgCostNum / st.cumQtd);
          priceSource = 'wac';  
      }
        // V/F
        const V_prev = (dailyRetByAtivo.get(nome)?.length ? dailyRetByAtivo.get(nome).at(-1)._V_after : null);
        const V_curr = (priceToday!=null) ? st.cumQtd * priceToday : 0;
          let F_d = 0;
 if (deltaQtdFlowHoje !== 0) {
   // usar preço de HOJE para neutralizar o P&L das cotas novas no próprio dia
   const refFlowPrice =
     (Number.isFinite(priceToday) ? priceToday
              : (prevPriceForFlow ?? (st.cumQtd > 0 ? (st.avgCostNum / st.cumQtd) : 0)));
   F_d = deltaQtdFlowHoje * refFlowPrice;
   const ref = Number(refFlowPrice ?? 0).toFixed(6);
   console.log('[rentab][flow]', d.iso, '|', nome, '| Δqtd=', deltaQtdFlowHoje, '| ref=', ref, '| F=', Number(F_d).toFixed(2), '| src=', priceSource);
 }
 let r = null;
        if (!dailyRetByAtivo.has(nome)) dailyRetByAtivo.set(nome, []);
        dailyRetByAtivo.get(nome).push({ date: d.iso, valor: r ?? 0, _V_after: V_curr, _F: F_d, subclasse: st.subclasse });

        // agrega subclasse/geral
        V_all += V_curr; 
        F_all += F_d;
        const s = st.subclasse || 'Outros';
        V_sub.set(s, (V_sub.get(s)||0) + V_curr);
        F_sub.set(s, (F_sub.get(s)||0) + F_d);
      }
      // ---- Carteira: r_d = (V - V_{-} - F_d)/V_{-}
      if (prevV_port === null) {
        const base = (prevVInit_port ?? V_all);
        const r0 = base > 0 ? ((V_all - base - F_all) / base) * 100 : 0;
dailyPortfolio.push({ date: d.iso, valor: Number(r0.toFixed(6)), V: V_all });
        prevV_port = V_all;
      } else {
        const rd = prevV_port > 0 ? ((V_all - prevV_port - F_all) / prevV_port) * 100 : 0;
        dailyPortfolio.push({ date: d.iso, valor: Number(rd.toFixed(6)), V: V_all });
        if (Math.abs(rd) >= 2) {
          console.log('[rentab][carteira]', d.iso, 'rd=', Number(rd).toFixed(4), 'prevV=', Number(prevV_port).toFixed(2), 'total=', Number(V_all).toFixed(2), 'fluxo=', Number(F_all).toFixed(2));
        }
        prevV_port = V_all;
      }
    }

    // 5.1) Pré-carrega CFGs de RF (PRE/CDI/IPCA) por ativo para cálculo mensal
    const rfCfgByNome = new Map();
    await Promise.all(Array.from(porAtivo.keys()).map(nome => new Promise((res, rej) => {
      db.get(
        `SELECT indexador, taxa_anual, percentual_cdi, base_dias, come_cotas, aliquota_comecotas,
                subcategoria, nome_investimento
           FROM investimentos
          WHERE usuario_id=? AND nome_investimento=?
          ORDER BY ROWID DESC LIMIT 1`,
        [usuarioId, nome],
        (e, r) => (e ? rej(e) : (rfCfgByNome.set(nome, r || null), res()))
      );
    })));

    // Helper: EOM (último dia útil) → ISO
    const eomISO = (y, m) => lastBusinessDayOfMonthUTC(y, m).toISOString().slice(0,10);

    // Helper: fator mensal da RF (PRE/CDI/IPCA) com come-cotas (quando marcado)
    const rfFatorEntre = async (cfg, diISO, dfISO) => {
      if (!cfg || !cfg.indexador) return null;
      const idx = String(cfg.indexador).toUpperCase();
      const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
      const eventos = (cfg.come_cotas ? comeCotasBetween(diISO, dfISO) : []);
      let S = 1, ini = diISO;
      if (idx === 'PRE') {
        for (const cc of eventos) {
          const p1 = fatorPRE(Number(cfg.taxa_anual || 0), diasEntre(ini, cc), Number(cfg.base_dias || 252));
          const Spre = S; S *= p1;
          if (S > 0) { const ganho = S - S / p1; const ir = Math.max(0, ganho * ali); S = Math.max(0, S - ir); }
          ini = cc;
        }
        const p2 = fatorPRE(Number(cfg.taxa_anual || 0), diasEntre(ini, dfISO), Number(cfg.base_dias || 252));
        S *= p2;
        return S;
      } else if (idx === 'CDI') {
        await ensureCDI(db, diISO, dfISO);
        for (const cc of eventos) {
          const p1 = await produtoCDIEntre(db, ini, cc);
          const f1 = Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
          S *= f1;
          if (S > 0) { const ganho = S - S / f1; const ir = Math.max(0, ganho * ali); S = Math.max(0, S - ir); }
          ini = cc;
        }
        await ensureCDI(db, ini, dfISO);
        const p2 = await produtoCDIEntre(db, ini, dfISO);
        const f2 = Math.pow(p2, Number(cfg.percentual_cdi || 0) / 100);
        S *= f2;
        return S;
      } else if (idx === 'IPCA') {
        for (const cc of eventos) {
          const p1 = await fatorIPCAmais(db, Number(cfg.taxa_anual || 0), ini, cc);
          S *= p1;
          if (S > 0) { const ganho = S - S / p1; const ir = Math.max(0, ganho * ali); S = Math.max(0, S - ir); }
          ini = cc;
        }
        const p2 = await fatorIPCAmais(db, Number(cfg.taxa_anual || 0), ini, dfISO);
        S *= p2;
        return S;
      }
      return null;
    };

    const dados = [];
    for (const [nome, series] of dailyRetByAtivo.entries()) {
      const sub = series[0]?.subclasse || 'Outros';
      const ps = priceSeries.get(nome);
      const cfgRF = rfCfgByNome.get(nome);
      const isTesouro = String(sub||'').toLowerCase().includes('tesouro');

      if (ps && ps.size) {
        // (A) Séries de mercado (Ações/ETFs) e Tesouro (PU) → EOM/EOM
   for (let m = 1; m <= 12; m++) {
     const [py, pm] = (m === 1) ? [ano - 1, 12] : [ano, m - 1];
    //  const p_prev = getLastTradingPrice(py, pm);
    //  const p_curr = getLastTradingPrice(ano, m);
    //  const pct = (p_curr != null && p_prev != null && p_prev !== 0)
    //    ? Number(((p_curr / p_prev - 1) * 100).toFixed(2))
    //    : null;
     // Busca sempre o último pregão do mês anterior e do mês atual
     let { px: p_prev } = lastTradingPriceAndDate(ps, py, pm);
     const { px: p_curr } = lastTradingPriceAndDate(ps, ano, m);
     // ?? Fallback para janeiro: usa o último preço antes de 01-01 (ex.: 30/12)
     if (m === 1 && (p_prev == null || !isFinite(p_prev))) {
       p_prev = prevMarketPrice(ps, `${ano}-01-01`);
     }
     let pct = null;
     if (p_curr != null && p_prev != null && p_prev !== 0) {
       pct = Number(((p_curr / p_prev - 1) * 100).toFixed(2));
     }
     // Força que janeiro use como base o fechamento de dezembro anterior
     if (m === 1 && pct != null) {
       // Nada extra — já pegamos py/pm corretos acima
     }
 dados.push({
   tipo: 'ativo',
   subclasse: sub,
   ativo: nome,
   mes: m,
   mes_str: String(m).padStart(2,'0'),
   ano_mes: `${ano}-${String(m).padStart(2,'0')}`,
   rentabilidade_pct: pct
 });
   }
      } else if (cfgRF && !isTesouro && cfgRF.indexador) {
        // (B) Renda Fixa (PRE/CDI/IPCA) → fator mensal por indexador + come-cotas
        for (let m = 1; m <= 12; m++) {
          const [py, pm] = (m === 1) ? [ano - 1, 12] : [ano, m - 1];
          const di = eomISO(py, pm);
          const df = eomISO(ano, m);
          const f = await rfFatorEntre(cfgRF, di, df);
          const pct = (f != null) ? Number(((f - 1) * 100).toFixed(2)) : null;
          dados.push({ tipo: 'ativo', subclasse: sub, ativo: nome, mes: m, rentabilidade_pct: pct });
        }
      } else {
        // (C) Demais casos sem preço/índice → ainda usamos TWR da série diária como fallback
        const mensal = agregaMensalTWR(series).filter(m => m.ano_mes.startsWith(String(ano)));
        for (const m of mensal) {
          dados.push({ tipo: 'ativo', subclasse: sub, ativo: nome, mes: m.mes, rentabilidade_pct: m.rentabilidade_pct });
        }
      }
        
    }

        // ==== Pesos e fatores mensais por ATIVO (para agregar SUBCLASSE e TOTAL) ====
    // V_prev_i(m) = valor da posição do ativo i no fim do mês ANTERIOR (a partir da série diária já calculada)
    // fator_i(m)  = p_curr / p_prev (usando Adj Close EOM/EOM já usado em `dados`)
    const VprevByAtivoMes = new Map(); // nome -> Map(mes -> V_prev)
    const fatorByAtivoMes = new Map(); // nome -> Map(mes -> fator)

    // mapeia EOM por ativo na série diária: pega último _V_after do mês
    const lastEomValue = (series, year, month) => {
      const mm = String(month).padStart(2,'0');
      let best = null, row = null;
      for (const r of series) {
        if (r.date && r.date.startsWith(`${year}-${mm}-`) && (!best || r.date > best)) {
          best = r.date; row = r;
        }
      }
      return row ? Number(row._V_after || 0) : 0;
    };

    // carrega V_prev e fator a partir de `dailyRetByAtivo` e `dados`
    const dadosByAtivoMes = new Map(); // nome -> Map(mes -> rentabilidade_pct)
    for (const d of dados) {
      if (d.tipo === 'ativo' && d.ativo && d.mes != null && d.rentabilidade_pct != null) {
        if (!dadosByAtivoMes.has(d.ativo)) dadosByAtivoMes.set(d.ativo, new Map());
        dadosByAtivoMes.get(d.ativo).set(d.mes, Number(d.rentabilidade_pct));
      }
    }
    for (const [nome, series] of dailyRetByAtivo.entries()) {
      const byMesV = new Map();
      const byMesF = new Map();
      for (let m = 1; m <= 12; m++) {
        const [py, pm] = (m === 1) ? [ano - 1, 12] : [ano, m - 1];
        // V_prev = valor da posição no fim do mês anterior
        let Vprev = lastEomValue(series, py, pm);
        // ✅ Para janeiro, se não houver EOM do ano anterior na série diária,
        // usa a âncora calculada na pré-âncora (st._VprevInit).
        if ((m === 1) && (!Vprev || Vprev === 0)) {
          const st = state.get(nome);
          if (st && st._VprevInit != null && isFinite(st._VprevInit) && st._VprevInit > 0) {
            Vprev = st._VprevInit;
          }
        }
        byMesV.set(m, Vprev);
        // fator = 1 + retorno_mensal(%)/100
        const pct = dadosByAtivoMes.get(nome)?.get(m);
        const fator = (pct != null) ? (1 + pct/100) : null;
        byMesF.set(m, fator);
      }
      VprevByAtivoMes.set(nome, byMesV);
      fatorByAtivoMes.set(nome, byMesF);
    }


    // 7) Subtotais por subclasse (mantém) e Total Geral (via TWR mensal da carteira)
    const dadosSub = [];
    let totalGeral = {};
    
     // Subtotais por SUBCLASSE: média simples dos retornos mensais dos ATIVOS daquela subclasse
 // (poderia ser média ponderada por AUM, se você tiver o peso no fim de cada mês)
  for (const sub of Array.from(new Set(dados.map(d => d.subclasse)))) {
   for (let m = 1; m <= 12; m++) {
     let num = 0, den = 0;
     for (const [nome, series] of dailyRetByAtivo.entries()) {
       const subAtv = series[0]?.subclasse || 'Outros';
       if (subAtv !== sub) continue;
       const Vprev = VprevByAtivoMes.get(nome)?.get(m) || 0;
       const fator = fatorByAtivoMes.get(nome)?.get(m); // p_curr/p_prev
       if (Vprev > 0 && fator != null) {
         num += Vprev * fator;
         den += Vprev;
       }
     }
     const pct = (den > 0 && num > 0) ? Number(((num/den - 1) * 100).toFixed(2)) : null;
 dadosSub.push({
   tipo: 'subclasse',
   subclasse: sub,
   ativo: null,
   mes: m,
   mes_str: String(m).padStart(2,'0'),
   ano_mes: `${ano}-${String(m).padStart(2,'0')}`,
   rentabilidade_pct: pct
 });
   }
 }

let mensalCarteira = agregaMensalTWR(dailyPortfolio)
  .filter(m => m.ano_mes.startsWith(String(ano))); // só meses do ano solicitado

// 🔪 Corta meses anteriores ao NASCIMENTO da carteira no ano (1º dia com V>0 no próprio ano)
const primeiroDia = dailyPortfolio.find(d => d.date.startsWith(String(ano)) && d.V && d.V > 0);
if (primeiroDia) {
  const mesInicio = primeiroDia.date.slice(0, 7); // 'YYYY-MM'
  mensalCarteira = mensalCarteira.filter(m => m.ano_mes >= mesInicio);
}
   // Descobre o primeiro mês com posição real (carteira > 0)
let primeiroMesCarteira = null;
for (const d of dailyPortfolio) {
  // aqui você só quer datas em que realmente tinha valor
  if (d.valor !== null && d.valor !== undefined) {
    // cuidado: d.valor é retorno %, não o valor absoluto
    // então use prevV_port dentro do loop original ou salve V_all lá
  }
}
  for (const m of mensalCarteira) {
    const keyStr = String(m.mes).padStart(2,'0');
    const r = Number(m.rentabilidade_pct);
    const val = (Number.isFinite(r)) ? Number(r.toFixed(2)) : null;
    totalGeral[m.mes] = val;
    totalGeral[keyStr] = val;
  }
    res.json({ dados: [...dadosSub, ...dados], totalGeral });

  } catch (e) {
    console.error('❌ Erro TWR mensal por subclasse/ativo:', e.stack || e.message);
    res.status(500).json({ erro: 'Erro ao calcular TWR mensal.' });
  }
});


// 📊 Rota: Rentabilidade Hierárquica por Classe > Subclasse > Ativo (usada pela TabelaRentabilidadeHierarquica)
router.get('/rentabilidade-hierarquica', auth, async (req, res) => {
  const usuario_id = req.user.id;

  try {
    // 1) Traga investido (BRL) e quantidade total por ativo
const base = await new Promise((resolve, reject) => {
  const query = `
    WITH quantidades_finais AS (
      SELECT
        i.nome_investimento,
        SUM(CASE 
              WHEN LOWER(i.tipo_operacao) LIKE '%vend%' THEN -i.quantidade
              WHEN LOWER(i.tipo_operacao) LIKE '%ajuste_bonificacao%'
                OR (LOWER(i.tipo_operacao) LIKE '%ajuste%' AND LOWER(i.tipo_operacao) LIKE '%bonific%') THEN 0
              ELSE i.quantidade
            END) AS quantidade_total
      FROM investimentos i
      WHERE i.usuario_id = ?
      GROUP BY i.nome_investimento
    ),
    investimentos_com_valor AS (
      SELECT
        i.nome_investimento,
        -- pega somente dos cadastros de domínio; se não tiver, marca "Sem classe/subclasse"
        COALESCE(ic.nome, 'Sem classe')       AS classe,
        COALESCE(isc.nome, 'Sem subclasse')   AS subclasse,
        SUM(
          CASE 
            WHEN LOWER(i.tipo_operacao) LIKE '%compra%' 
              OR LOWER(i.tipo_operacao) LIKE '%buy%' 
              OR LOWER(i.tipo_operacao) LIKE '%aplic%' 
            THEN i.valor_total
            WHEN LOWER(i.tipo_operacao) LIKE '%vend%' 
              OR LOWER(i.tipo_operacao) LIKE '%resgat%' 
              OR LOWER(i.tipo_operacao) LIKE '%leilao%'
              OR LOWER(i.tipo_operacao) LIKE '%leilão%'
            THEN -i.valor_total
            ELSE 0
          END
        ) AS investido
      FROM investimentos i
      LEFT JOIN investimento_classes ic
        ON ic.id = i.classe_id
       AND (ic.usuario_id = i.usuario_id OR ic.usuario_id IS NULL)
      LEFT JOIN investimento_subclasses isc
        ON isc.id = i.subclasse_id
       AND (isc.usuario_id = i.usuario_id OR isc.usuario_id IS NULL)
      WHERE i.usuario_id = ?
      GROUP BY i.nome_investimento, classe, subclasse
    )
    SELECT
      icv.classe              AS classe,
      icv.subclasse           AS subclasse,
      icv.nome_investimento   AS ativo,
      COALESCE(icv.investido, 0)           AS investido,
      COALESCE(qf.quantidade_total, 0)     AS quantidade
    FROM investimentos_com_valor icv
    JOIN quantidades_finais qf 
      ON icv.nome_investimento = qf.nome_investimento
    WHERE qf.quantidade_total > 0
  `;
  db.all(query, [usuario_id, usuario_id], (err, rows) => err ? reject(err) : resolve(rows || []));
});

    // 2) Monte mapa por ativo
    const porAtivo = new Map();
    for (const r of base) {
      porAtivo.set(r.ativo, {
        classe: r.classe || 'Outros',
        subclasse: r.subclasse || 'Outros',
        investido: Number(r.investido) || 0,
        qtd: Number(r.quantidade) || 0,
      });
    }

    // 3) Preços de mercado (Yahoo) para quem tiver padrão B3
    //    (usa helpers existentes: toYahoo/buildPriceSeriesFor)
    const equities = [];
    for (const [nome, obj] of porAtivo.entries()) {
      const yf = toYahoo(nome); // ex.: XPLG11 -> XPLG11.SA | VOO -> VOO
      if (yf) equities.push({ nome, yf });
    }
    // 🔧 mapa nome -> ticker Yahoo (usado na conversão USD→BRL mais abaixo)
    const nomeToYf = new Map(equities.map(e => [e.nome, e.yf]));

    // Janela curtinha só p/ garantir último preço recente
    const today = new Date();
    const endISO = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
      .toISOString().slice(0,10);
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - 30);
    const startISO = start.toISOString().slice(0,10);

    const yahooFinance = (await import('yahoo-finance2')).default;

    // Tenta pegar preço spot via quote primeiro
const quotesMap = new Map();
await Promise.all(equities.map(async ({ nome, yf }) => {
  try {
    const q = await yahooFinance.quote(yf);
    const p = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice;
    if (p != null && isFinite(p)) {
      quotesMap.set(nome, Number(p));
      return;
    }
  } catch (_) { /* fallback abaixo */ }
}));

// Mantém série diária como fallback (mas com 'close', não adjClose)
const priceSeries = await buildPriceSeriesFor(equities, startISO, endISO, 15, 'close');

// ? FX spot (USDBRL) para converter ativos EUA em BRL
let fxSpot = null;
try {
  const qfx = await yahooFinance.quote('USDBRL=X');
  fxSpot = qfx?.regularMarketPrice ?? qfx?.postMarketPrice ?? qfx?.preMarketPrice ?? null;
} catch {}
if (fxSpot == null) {
  try {
    const end = new Date();
    const start = new Date(); start.setUTCDate(start.getUTCDate() - 10);
    const fxHist = await yahooFinance.historical('USDBRL=X', {
      period1: start.toISOString().slice(0,10),
      period2: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())).toISOString().slice(0,10),
      interval: '1d'
    });
    const last = (fxHist || []).filter(r => (r.adjClose ?? r.close)).pop();
    fxSpot = last ? Number(last.adjClose ?? last.close) : null;
  } catch {}
}

    // 4) Fallback: último valor em valores_atuais (para não-equities ou ausência de série)
    const fallbackRows = await new Promise((resolve, reject) => {
      db.all(`
        SELECT va.nome_investimento, va.preco_unitario, va.valor_total
        FROM valores_atuais va
        JOIN (
          SELECT nome_investimento, MAX(date(data_referencia)) AS data_max
          FROM valores_atuais
          WHERE usuario_id = ?
          GROUP BY nome_investimento
        ) uv
          ON uv.nome_investimento = va.nome_investimento
         AND date(va.data_referencia) = uv.data_max
        WHERE va.usuario_id = ?
      `, [usuario_id, usuario_id], (e, rows) => e ? reject(e) : resolve(rows || []));
    });
    const fb = new Map(fallbackRows.map(r => [r.nome_investimento, r]));

    // 5) Construa a estrutura de saída (classe > subclasse > ativos)
    const estrutura = {};
    for (const [nome, a] of porAtivo.entries()) {
      // ?? Renda Fixa: se o ativo tiver indexador, usa motor de RF e pula preço de mercado
      const cfg = await new Promise((res, rej) =>
        db.get(
          `SELECT indexador, taxa_anual, percentual_cdi, base_dias,
                  subcategoria, nome_investimento, come_cotas, aliquota_comecotas,
                  vencimento
             FROM investimentos
            WHERE usuario_id=? AND nome_investimento=? AND COALESCE(indexador,'') <> ''
            ORDER BY ROWID DESC LIMIT 1`,
          [usuario_id, nome],
          (e, r) => (e ? rej(e) : res(r || null))
        )
      );
      if (cfg && cfg.indexador) {
        // fluxos (valor_total em BRL; compra/aplic + | venda/resgate -)
        const flows = await new Promise((res, rej) =>
          db.all(
            `SELECT date(data_operacao) AS data, valor_total, LOWER(tipo_operacao) AS tipo
               FROM investimentos
              WHERE usuario_id=? AND nome_investimento=?`,
            [usuario_id, nome],
            (e, rows) => (e ? rej(e) : res(rows || []))
          )
        );
        const arr = (flows || []).map(f => ({
          data: f.data,
          valor_total: Number(f.valor_total) || 0,
          sinal: ((f.tipo || '').includes('vend') || (f.tipo || '').includes('resgat')) ? -1 : +1
        }));
        // override manual hoje (se houver snapshot em valores_atuais no dia)
        const hojeISO = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
                          .toISOString().slice(0,10);
        const over = await new Promise((res, rej) =>
          db.get(
            `SELECT valor_total FROM valores_atuais
              WHERE usuario_id=? AND nome_investimento=? AND date(data_referencia)=date(?)`,
            [usuario_id, nome, hojeISO],
            (e, r) => (e ? rej(e) : res(r?.valor_total ?? null))
          )
        );
         const atualRF = await valorRFnaData(
         db,
          { ...cfg, subcategoria: a.subclasse, nome_investimento: nome },
          arr,
          hojeISO,
          over
        );
        if (!estrutura[a.classe]) estrutura[a.classe] = { nome: a.classe, investido: 0, atual: 0, subclasses: {} };
        if (!estrutura[a.classe].subclasses[a.subclasse]) {
          estrutura[a.classe].subclasses[a.subclasse] = { nome: a.subclasse, investido: 0, atual: 0, ativos: [] };
        }
        estrutura[a.classe].subclasses[a.subclasse].ativos.push({
          nome, investido: a.investido, atual: atualRF,
          rentabilidade: a.investido > 0 ? ((atualRF - a.investido) / a.investido) * 100 : null
        });
        estrutura[a.classe].subclasses[a.subclasse].investido += a.investido;
        estrutura[a.classe].subclasses[a.subclasse].atual     += atualRF;
        estrutura[a.classe].investido += a.investido;
        estrutura[a.classe].atual     += atualRF;
        continue; // << pula toda a lógica de preço de mercado
      }

      // preço de referência (preferência: mercado; senão fallback)
let price = null;

// 1) Tenta preço spot do Yahoo (quote)
if (quotesMap.has(nome)) {
  price = quotesMap.get(nome);
}

// 2) Se não tiver quote, tenta último fechamento (close)
if (price == null) {
  const ps = priceSeries.get(nome);
  if (ps && ps.size) {
    const lastPrice = Array.from(ps.values()).at(-1);
    if (isFinite(lastPrice)) price = Number(lastPrice);
  }
}

// 2.5) Converte EUA→BRL (se ticker não for .SA)
const yf = nomeToYf.get(nome);
if (yf && !yf.endsWith('.SA') && price != null && fxSpot) {
  price = price * fxSpot;
}

      if (price == null) {
        const row = fb.get(nome);
        if (row) {
          if (row.preco_unitario != null) {
            price = Number(row.preco_unitario);
          } else if (row.valor_total != null && a.qtd > 0) {
            price = Number(row.valor_total) / a.qtd; // fallback proporcional
          }
        }
      }

      const atual = Number((a.qtd > 0 && isFinite(price)) ? (a.qtd * price) : 0).toFixed(2) * 1;

      if (!estrutura[a.classe]) {
        estrutura[a.classe] = { nome: a.classe, investido: 0, atual: 0, subclasses: {} };
      }
      if (!estrutura[a.classe].subclasses[a.subclasse]) {
        estrutura[a.classe].subclasses[a.subclasse] = { nome: a.subclasse, investido: 0, atual: 0, ativos: [] };
      }
      estrutura[a.classe].subclasses[a.subclasse].ativos.push({
        nome, investido: a.investido, atual,
        rentabilidade: a.investido > 0 ? ((atual - a.investido) / a.investido) * 100 : null,
      });
      estrutura[a.classe].subclasses[a.subclasse].investido += a.investido;
      estrutura[a.classe].subclasses[a.subclasse].atual += atual;
      estrutura[a.classe].investido += a.investido;
      estrutura[a.classe].atual += atual;
    }

 const resposta = Object.values(estrutura)
   .map(cl => {
     const subclassesRaw = Object.values(cl.subclasses).filter(sub => (sub.ativos?.length ?? 0) > 0);

     // ⬇️ rentabilidade ponderada por peso (valor atual) dos ATIVOS dentro da SUBCLASSE
     const subclasses = subclassesRaw.map(sub => {
       const ativosValidos = (sub.ativos || []).filter(a => Number.isFinite(Number(a.rentabilidade)) && (Number(a.atual) || 0) > 0);
       const somaAtual = ativosValidos.reduce((s, a) => s + (Number(a.atual) || 0), 0);
       let rentPond = null;
       if (somaAtual > 0) {
         const acc = ativosValidos.reduce((s, a) => {
           const w = (Number(a.atual) || 0) / somaAtual;
           const r = Number(a.rentabilidade) || 0;
           return s + w * r;
         }, 0);
         rentPond = Number(acc.toFixed(2));
       } else if (sub.investido > 0) {
         rentPond = Number((((sub.atual - sub.investido) / sub.investido) * 100).toFixed(2));
       }
       return { ...sub, rentabilidade: rentPond };
     });

     // ⬇️ rentabilidade ponderada por peso (valor atual) das SUBCLASSES dentro da CLASSE
     const investido = subclasses.reduce((s, x) => s + (Number(x.investido) || 0), 0);
     const atual     = subclasses.reduce((s, x) => s + (Number(x.atual) || 0), 0);
     let rentClasse = null;
     const subsValidas = subclasses.filter(sub => Number.isFinite(Number(sub.rentabilidade)) && (Number(sub.atual) || 0) > 0);
     const somaAtualClasse = subsValidas.reduce((s, sub) => s + (Number(sub.atual) || 0), 0);
     if (somaAtualClasse > 0) {
       const acc = subsValidas.reduce((s, sub) => {
         const w = (Number(sub.atual) || 0) / somaAtualClasse;
         const r = Number(sub.rentabilidade) || 0;
         return s + w * r;
       }, 0);
       rentClasse = Number(acc.toFixed(2));
     } else if (investido > 0) {
       rentClasse = Number((((atual - investido) / investido) * 100).toFixed(2));
     }
     return subclasses.length ? {
       nome: cl.nome,
       investido,
       atual,
       rentabilidade: rentClasse,
       subclasses
     } : null;
   })
   .filter(Boolean);

    res.json(resposta);
  } catch (e) {
    console.error('Erro rota rentabilidade-hierarquica', e.stack || e.message);
    res.status(500).json({ erro: 'Erro ao buscar rentabilidade hierárquica' });
  }
});

// 📈 Rentabilidade DIÁRIA agregada da carteira (close→close)
router.get('/rentabilidade-diaria', (req, res) => {
  const usuarioId = req.user.id;
const { periodo = 'ano', tradingDays = '1', accumulate = '1', onlyAtivos = '' } = req.query;
  const filtroAtivos = String(onlyAtivos || '')
    .split(',').map(s => s.trim()).filter(Boolean).map(s => s.toUpperCase());
  const { startISO, endISO } = rangeFromPeriodo(periodo);
  const startInt = Number(startISO.replaceAll('-', ''));
  const endInt   = Number(endISO.replaceAll('-', ''));

  // 1) Busca compras e valores atualizados (até endISO)
  db.all(`
       SELECT 
         nome_investimento,
         date(data_operacao) AS data_operacao,
         quantidade,
         valor_unitario,
         valor_total,
         COALESCE(subcategoria,'') AS subcategoria,
         LOWER(COALESCE(tipo_operacao,'')) AS tipo_operacao
       FROM investimentos
       WHERE usuario_id = ?
       ORDER BY date(data_operacao) ASC
     `, [usuarioId], (err, compras) => {
    if (err) {
      console.error('❌ Erro ao buscar compras:', err.message);
      return res.json([]);
    }
    db.all(`
      SELECT nome_investimento, date(data_referencia) AS data_referencia, 
             valor_total, preco_unitario
      FROM valores_atuais
      WHERE usuario_id = ?
        AND date(data_referencia) <= date(?)
      ORDER BY date(data_referencia) ASC
    `, [usuarioId, endISO], (err2, valores) => {
      if (err2) {
        console.error('❌ Erro ao buscar valores_atuais:', err2.message);
        return res.json([]);
      }

      // Indexa por ativo
      const porAtivo = new Map();
      const ensure = (nome) => {
        if (!porAtivo.has(nome)) porAtivo.set(nome, { compras: [], valores: [] });
        return porAtivo.get(nome);
      };
      (compras || []).forEach(c => {
        const a = ensure(c.nome_investimento);
        const op   = String(c.tipo_operacao || '').toLowerCase();
        const quant= Math.abs(Number(c.quantidade) || 0);
        const pu   = Number(c.valor_unitario) || 0;
        const vt   = Number(c.valor_total) || 0; // $ do fluxo no dia
        let tipo = 'outro', qtd = quant, flow = true, cash = 0;
        if (op.includes('compra') || op.includes('buy') || op.includes('aplic')) {
          tipo = 'compra';  qtd = +quant; flow = true;  cash = +vt;
        } else if (
          op.includes('vende') || op.includes('venda') || op.includes('sell') ||
          op.includes('resgat') || op.includes('resgate') || op.includes('amortiz')
        ) {
          tipo = 'venda';   qtd = -quant; flow = true;  cash = -vt;
        } else if (op.includes('transfer') && (op.includes('entrada') || op.includes('in'))) {
          tipo = 'transfer_in';  qtd = +quant; flow = false; cash = 0; // não entra no TWR
        } else if (op.includes('transfer') && (op.includes('saida') || op.includes('saída') || op.includes('out'))) {
          tipo = 'transfer_out'; qtd = -quant; flow = false; cash = 0; // não entra no TWR
        } else if (op.includes('bonif')) {
          tipo = 'bonificacao';  qtd = +quant; flow = false; cash = 0; // evento não monetário
        }
        a.compras.push({
          date: c.data_operacao,
          dateInt: Number(c.data_operacao.replaceAll('-', '')),
          qtd, pu, tipo, flow,
          cash,                           // 💰 valor do fluxo (±)
          subclasse: c.subcategoria || '' // útil para depuração/identificação
        });
      });
      (valores || []).forEach(v => {
        const a = ensure(v.nome_investimento);
        a.valores.push({
          date: v.data_referencia,
          dateInt: Number(v.data_referencia.replaceAll('-', '')),
          valor_total: v.valor_total != null ? Number(v.valor_total) : null,
          preco_unitario: v.preco_unitario != null ? Number(v.preco_unitario) : null
        });
      });
      // Ordena
      for (const a of porAtivo.values()) {
        a.compras.sort((x,y)=> x.dateInt - y.dateInt);
        a.valores.sort((x,y)=> x.dateInt - y.dateInt);
      }

      // Filtro opcional por ativo (útil no debug)
      if (filtroAtivos.length) {
       for (const nome of Array.from(porAtivo.keys())) {
          if (!filtroAtivos.includes(String(nome).toUpperCase())) porAtivo.delete(nome);
        }
      }

      // === PREÇOS DIÁRIOS DE MERCADO (ex.: VALE3 -> VALE3.SA) ===
      const equities = [];
      for (const [nome] of porAtivo.entries()) {
        const yf = toYahoo(nome);
        if (yf) equities.push({ nome, yf });
      }
      (async () => {
      // Padrão: Total Return (Adj Close) para incluir dividendos/splits no TWR
      const priceSeries = await buildPriceSeriesFor(equities, startISO, endISO, /*padDays*/15, 'adj');
      // 🧭 Mapa 'nome' -> ticker Yahoo (para detectar ativos fora da B3)
      const nomeToYf = new Map(equities.map(e => [e.nome, e.yf]));
      // 📈 FX histórico USDBRL para converter não-.SA (USD→BRL)
      const fxUSDBRL = await buildFXSeriesUSDBRL(startISO, endISO, 15);
      // Converte TODAS as séries que não terminam com ".SA"
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
      console.log('[rentab] FX aplicado a não-.SA:', equities.filter(e => e.yf && !e.yf.endsWith('.SA')).length);
        // --- PU diário para Tesouro Direto (marcação a mercado no dia) ---
  const tesouros = [];
  for (const [nome, obj] of porAtivo.entries()) {
    const sub = String(obj.subclasse || '').toLowerCase();
    if (sub.includes('tesouro')) {
      tesouros.push({ nome, titulo: normTituloTesouro(nome) });
    }
  }
  // evita chamadas repetidas para o mesmo título
  const vistosPU = new Set();
  for (const t of tesouros) {
    if (vistosPU.has(t.titulo)) continue;
    vistosPU.add(t.titulo);
    try {
      // garante PU no banco para o intervalo necessário (idempotente)
      await ensureTesouroPU(t.titulo, startISO, endISO);
      // carrega PU e injeta na series de preços do ativo
      const r = await fetch(
        `/api/indices/tesouro/pu?nome=${encodeURIComponent(t.titulo)}&inicio=${encodeURIComponent(startISO)}&fim=${encodeURIComponent(endISO)}`
      );
      const j = await r.json().catch(() => ({ items: [] }));
      const mp = new Map((j.items || []).map(it => [String(it.data), Number(it.pu)]));
      if (mp.size) {
        const prev = priceSeries.get(t.nome);
        if (prev && prev.size) {
          for (const [k, v] of mp) if (!prev.has(k)) prev.set(k, v); // mantém preços já existentes
        } else {
          priceSeries.set(t.nome, mp);
        }
      }
      console.log('[rentab] PU Tesouro carregado:', t.nome, mp.size, 'dias');
    } catch (e) {
      console.log('[rentab] Falha PU Tesouro', t.nome, e?.message);
    }
  }

      // 3) Define o calendário de dias:
      //    - tradingDays=1 => apenas dias de pregão (adj close) + dias com FLUXO
      //    - para ativos SEM série de mercado (ex.: fundos), também considera dias de NAV
      let days = [];
      if (String(tradingDays).toLowerCase() === '1' || String(tradingDays).toLowerCase() === 'true') {
        const diasTradingSet = new Set();    // chaves vindas de priceSeries (pregão)
        const flowDaysSet    = new Set();    // dias com aportes/retiradas
        const navDaysNonEq   = new Set();    // dias de valores_atuais APENAS p/ ativos sem série de mercado

        // dias de pregão (qualquer ativo com preço de mercado) — somente dias úteis
        for (const mp of priceSeries.values()) {
          for (const d of mp.keys()) {
if (d >= startISO && d <= endISO) diasTradingSet.add(d);
          }
        }
        // dias com fluxo → reindexa para PRÓXIMO pregão (ou anterior se não houver)
        for (const [_nome, a] of porAtivo.entries()) {
          for (const tr of a.compras) {
            if (!tr.flow) continue;
            if (tr.dateInt < startInt || tr.dateInt > endInt) continue;
            const iso = tr.date;
            const trg = diasTradingSet.has(iso)
              ? iso
              : (nextTrading(diasTradingSet, iso) || prevTrading(diasTradingSet, iso) || iso);
            flowDaysSet.add(trg);
            // guarda a "data de pregão" efetiva do fluxo (para somar F_d em dinheiro)
            tr.dateTrade = trg;
            tr.dateTradeInt = Number(trg.replaceAll('-', ''));
          }
        }
        // NAV de não-equities → reindexa para ÚLTIMO pregão anterior (não cria “sábado”)
        for (const [nome, a] of porAtivo.entries()) {
          if (!!toYahoo(nome)) continue;
          for (const v of a.valores) {
            if (v.dateInt < startInt || v.dateInt > endInt) continue;
            const trg = prevTrading(diasTradingSet, v.date) || v.date;
            navDaysNonEq.add(trg);
          }
        }
        const setDias = new Set([...diasTradingSet, ...flowDaysSet, ...navDaysNonEq]);
        days = Array.from(setDias).sort().map(iso => ({ iso, int: Number(iso.replaceAll('-', '')) }));
                // 💰 Índice de fluxo em dinheiro por dia de pregão (F_d para TWR)
        var flowCashByDay = new Map();
        for (const [_n, a] of porAtivo.entries()) {
          for (const tr of a.compras) {
            if (!tr.flow || !tr.dateTrade) continue;
            const k = tr.dateTrade;
            flowCashByDay.set(k, (flowCashByDay.get(k) || 0) + (Number(tr.cash) || 0));
          }
        }
      } else {
        // calendário completo (com fins de semana/feriados)
        let cur = new Date(startISO);
        const end = new Date(endISO);
        while (cur <= end) {
          const iso = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate()))
            .toISOString().slice(0,10);
          days.push({ iso, int: Number(iso.replaceAll('-', '')) });
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }

      // 4) Percorre dias agregando valor total com:
      //    - carry-forward de preço
      //    - custo médio (WAC) como fallback antes da 1ª cotação
      //    - TWR: remove efeito de fluxos (aportes/retiradas)
      const state = new Map(); // nome -> { qi, pi, cumQtd, avgCostNum, lastPrice, lastValRow, comp, vals }
      const dbg = { 
        params: { periodo, startISO, endISO, tradingDays: String(tradingDays), priceMode: 'adj', onlyAtivos: filtroAtivos },
        anchors: { prevVInit: null, perAtivo: {} },
        perAtivo: {}, // nome -> [{...}]
        portfolio: [] // [{date, V_prev, F_total, V_total, r_port, f_cum}]
      };
      for (const [nome, data] of porAtivo.entries()) {
        const ps = priceSeries.get(nome);
        const prevPx = prevMarketPrice(ps, startISO); // << PREÇO ANTERIOR AO INÍCIO
        state.set(nome, {
          qi: 0, pi: 0,
          cumQtd: 0,
          avgCostNum: 0, // soma (q * pu) com ajuste por venda a custo médio
          lastPrice: prevPx ?? null,
          lastValRow: null,
          comp: data.compras, vals: data.valores,
        });
      }
      // === PRE-ÂNCORA: V_{t-1} no ÚLTIMO pregão ANTES do primeiro dia do período ===
      let prevVInit = null;
      if (days.length) {
        const firstInt = days[0].int;
        for (const [nome, st] of state.entries()) {
          // avança ordens até a véspera
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
          // avança valores_atuais até a véspera
          while (st.pi < st.vals.length && st.vals[st.pi].dateInt < firstInt) {
            st.lastValRow = st.vals[st.pi]; st.pi++;
          }
          // preço do último pregão anterior (ou fallbacks)
          const ps = priceSeries.get(nome);
          let pPrev = ps ? prevMarketPrice(ps, days[0].iso) : null;
          if (pPrev == null && st.lastValRow) {
            pPrev = st.lastValRow.preco_unitario != null
              ? Number(st.lastValRow.preco_unitario)
              : (st.cumQtd > 0 ? Number(st.lastValRow.valor_total) / st.cumQtd : null);
          }
          if (pPrev == null && st.cumQtd > 0 && st.avgCostNum > 0) {
            pPrev = st.avgCostNum / st.cumQtd; // WAC como último recurso
          }
          if (pPrev != null) {
            st.lastPrice = pPrev;
            prevVInit = (prevVInit ?? 0) + st.cumQtd * pPrev;
          }
        }
      }
      dbg.anchors.prevVInit = prevVInit ?? 0;
 // 🔎 ANCORAGEM do período (valor total na véspera do 1º pregão)
      const serieValor = [];
      let prevV = null; // V_{t-1}
      let fCum = 1;     // fator acumulado da carteira
      const out = [];   // retornos diários (%), neutros a fluxos
      for (const d of days) {
        let total = 0;
        // 🔧 F_d em DINHEIRO (aportes/resgates agregados no dia de pregão)
        let fluxoDia = Number((flowCashByDay && flowCashByDay.get(d.iso)) || 0);
        if (fluxoDia !== 0) {
          try { console.log('[rentab][F_cash]', d.iso, Number(fluxoDia).toFixed(2)); } catch {}
        }
        for (const [nome, st] of state.entries()) {
          // atualiza quantidade/custo acumulados (e guarda Δq do DIA somente de fluxos)
          let deltaQtdFlowHoje = 0;
          while (st.qi < st.comp.length && st.comp[st.qi].dateInt <= d.int) {
            const tr = st.comp[st.qi];
            // não somamos mais F_d via Δq*preço: neutralização ocorre via flowCashByDay
            if (tr.dateTradeInt === d.int && tr.flow) { /* marcador de fluxo no dia */ }
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
          // atualiza último valor conhecido até o dia
          while (st.pi < st.vals.length && st.vals[st.pi].dateInt <= d.int) {
            st.lastValRow = st.vals[st.pi];
            st.pi++;
          }

          const r = st.lastValRow;
          // Preço do dia: mercado do dia > último mercado anterior > valores_atuais > WAC
          // 👉 Guarda o preço "de referência" do dia ANTERIOR para valorar fluxo
          const prevPriceForFlow = st.lastPrice;
          let priceToday = st.lastPrice;
          const ps = priceSeries.get(nome);
          if (ps && ps.has(d.iso)) {
            priceToday = ps.get(d.iso);
            st.lastPrice = priceToday;
          } else if (r) {
            let p = null;
            if (r.preco_unitario != null) {
              p = Number(r.preco_unitario);
            } else if (r.valor_total != null) {
              p = (st.cumQtd > 0) ? (Number(r.valor_total) / st.cumQtd) : null;
            }
            if (p && isFinite(p)) {
              // Detecta desdobro/inplit e ajusta posição
              if (st.lastPrice) {
                const k = detectSplitFactor(st.lastPrice, p);
                if (k !== 1) {
                  st.cumQtd *= k;
                }
              }
              priceToday = p;
              st.lastPrice = p;
            }
          }

          // Valor do ativo
          let valAtivo = 0;
          if (priceToday != null) {
            valAtivo = st.cumQtd * priceToday;
          } else {
            // fallback final: WAC (avg cost)
            valAtivo = st.avgCostNum;
          }
          total += (isFinite(valAtivo) ? valAtivo : 0);

        }
        serieValor.push({ date: d.iso, total });
        // 4) TWR diário: r_d = (V_d - V_{d-1} - F_d) / V_{d-1}
        if (prevV === null) {
          // 1º pregão do período: usa V_{t-1} da PRE-ÂNCORA para retorno real do dia
          prevV = (prevVInit ?? total);
          let r0 = (prevV > 0) ? ((total - prevV - fluxoDia) / prevV) * 100 : 0;
          if (Math.abs(r0) < 1e-10) r0 = 0;
          out.push({ date: d.iso, valor: Number(r0.toFixed(6)) });
          const rd0 = Number(r0.toFixed(6));
          fCum *= (1 + rd0 / 100);
          const cumPct = Number(((fCum - 1) * 100).toFixed(6));
          prevV = total;
        } else {
          let rd;
          if (prevV > 0) {
            let r = ((total - prevV - fluxoDia) / prevV) * 100;
            if (Math.abs(r) < 1e-10) r = 0;
            rd = Number(r.toFixed(6));            // usa o r do DIA
          } else {
            rd = 0;
          }
          out.push({ date: d.iso, valor: rd });   // guarda o mesmo rd
          fCum *= (1 + rd / 100);                 // acumula com o rd correto
          const cumPct = Number(((fCum - 1) * 100).toFixed(6));
      const ym = d.iso.slice(0, 7);
      const next = days.find(x => x.iso > d.iso)?.iso || null;
      const isEOM = !next || next.slice(0, 7) !== ym;
      if (isEOM) {
        const pct = Number(((fCum - 1) * 100).toFixed(4));
      }
          prevV = total;
        }
      }
      // 🔪 Corta DIAS anteriores ao NASCIMENTO da carteira dentro do período (primeiro total > 0)
      let firstIdx = serieValor.findIndex(x => Number(x.total) > 0);
      if (firstIdx < 0) firstIdx = 0; // sem posição no período → não corta
      let outCropped = out.slice(firstIdx);

      // Se quiser a série acumulada pronta, recalcula ACUMULADO após o corte
      if (String(req.query.accumulate) === '1') {
        let f = 1; // fator acumulado
        const withCum = outCropped.map(d => {
          f *= (1 + (Number(d.valor) || 0) / 100);
          const cum = Number(((f - 1) * 100).toFixed(4));
          return { date: d.date, valor: d.valor, valor_cum: cum, carteira_cum: cum };
        });
        return res.json(withCum);
      }
      // Série diária (não acumulada), já cortada
      return res.json(outCropped);
      })(); // fim bloco async preços de mercado
    });
  });
});

// Helpers
const norm = (s) => String(s || '').toUpperCase().replace(/-/g, '');
const sanitizeB3 = s => String(s||'').normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]/g, '');

// GET /investimentos/inspector?ativo=XPML11
router.get('/inspector', async (req, res) => {
  const usuario_id = req.user.id;
  const ativoRaw = req.query.ativo;
  if (!ativoRaw) return res.status(400).json({ erro: 'Parâmetro "ativo" obrigatório' });

  try {
    // 1) Busca operações do ativo (usuário) para calcular posição e PM
    const oper = await new Promise((resolve, reject) => {
      db.all(
        `SELECT nome_investimento, categoria, subcategoria, tipo_operacao, quantidade, valor_unitario, valor_total, date(data_operacao) as data_operacao
           FROM investimentos
          WHERE usuario_id = ? AND UPPER(REPLACE(nome_investimento,'-','')) = UPPER(REPLACE(?, '-', ''))
          ORDER BY date(data_operacao) ASC`,
        [usuario_id, ativoRaw],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
    if (!oper.length) return res.status(404).json({ erro: 'Ativo não encontrado para o usuário' });
    const isRF = String(oper[0]?.categoria || '').toLowerCase().includes('renda fixa');

    // 2) Quantidade líquida e valor aplicado (só compras)
    // 2) Quantidade líquida, custo e PM pelo padrão de mercado
let qtd = 0;
let custo = 0; // custo total em aberto (base de PM)
let categoria = oper[0].categoria || 'Outros';
let subcategoria = oper[0].subcategoria || 'Outros';

for (const o of oper) {
   const q = Math.abs(Number(o.quantidade || 0));
   const vt = Number(o.valor_total || 0);
const tipo = String(o.tipo_operacao || '').toLowerCase().normalize('NFKD');
const isAjuste = tipo.includes('ajuste') && tipo.includes('bonific');   // ajuste_bonificacao
const isBonus  = tipo.includes('bonific') && !isAjuste;                 // bonificação “pura”
const isCompra = tipo.includes('compra') || tipo.includes('buy') || tipo.includes('aplic');
const isVenda  = tipo.includes('vend') || tipo.includes('sell') || tipo.includes('resgat')
              || tipo.includes('saida') || tipo.includes('saída')
              || tipo.includes('leilao') || tipo.includes('leilão');

   if (isCompra) {
     qtd += q;
     custo += vt;
   } else if (isVenda) {
     const pmAtual = qtd > 0 ? (custo / qtd) : 0;
     qtd -= q;
     custo -= pmAtual * q;
     if (Math.abs(qtd) < 1e-9) { qtd = 0; custo = 0; }
  } else if (isAjuste) {
    // ajuste de bonificação: NÃO altera estoque; a fração será baixada na venda (leilão)
    // qtd += 0;
   } else if (isBonus) {
     // evento não monetário: reduz quantidade, custo não muda
     qtd += q;
   }
 }

const precoMedio = qtd > 0 ? (custo / qtd) : 0;
let valorAplicado;
if (isRF) {
  // Para RF: aplicado por FLUXO (aportes - resgates), independe de PM/quantidade
  let aplicadoFluxo = 0;
  for (const o of oper) {
    const tipo = String(o.tipo_operacao || '').toLowerCase().normalize('NFKD');
    const vt   = Number(o.valor_total || 0);
    const isCompra = tipo.includes('compra') || tipo.includes('buy') || tipo.includes('aplic');
    const isVenda  = tipo.includes('vend') || tipo.includes('sell') || tipo.includes('resgat')
                  || tipo.includes('saida') || tipo.includes('saída')
                  || tipo.includes('leilao') || tipo.includes('leilão');
    if (isCompra) aplicadoFluxo += vt;
    else if (isVenda) aplicadoFluxo -= vt;
  }
  valorAplicado = aplicadoFluxo > 0 ? Number(aplicadoFluxo.toFixed(2)) : 0;
} else {
  // Mantém o comportamento padrão para ações/FIIs etc.
  valorAplicado = custo < 0 ? 0 : Number(custo.toFixed(2));
}

    // 3) Última cotação (Yahoo)
    const yfTicker = toYahoo(ativoRaw);
    let ultimaCotacao = null;

    if (yfTicker) {
      const yahooFinance = (await import('yahoo-finance2')).default;
      try {
        const q = await yahooFinance.quote(yfTicker);
        const p = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice;
        if (p != null && isFinite(p)) ultimaCotacao = Number(p);
      } catch (_) { /* cai pro histórico */ }
      if (ultimaCotacao == null) {
        try {
          const end = new Date();
          const start = new Date(); start.setDate(start.getDate() - 20);
          const hist = await yahooFinance.historical(yfTicker, {
            period1: start.toISOString().slice(0,10),
            period2: end.toISOString().slice(0,10),
            interval: '1d'
          });
          const last = (hist || []).filter(r => (r.adjClose ?? r.close)).pop();
          if (last) ultimaCotacao = Number(last.adjClose ?? last.close);
        } catch (_) {}
      }
    }

    // 4) Monta métricas
    const saldoBruto = (qtd > 0 && ultimaCotacao != null) ? qtd * ultimaCotacao : 0;
    const resultado = saldoBruto - valorAplicado;
    const rentSobrePM = (precoMedio > 0 && ultimaCotacao != null)
      ? ((ultimaCotacao / precoMedio) - 1) * 100
      : null;

    return res.json({
      ativo: sanitizeB3(ativoRaw),
      categoria, subcategoria,
      quantidade: Number(qtd.toFixed(6)),
      preco_medio: Number(precoMedio.toFixed(6)),
      ultima_cotacao: (ultimaCotacao != null ? Number(ultimaCotacao.toFixed(6)) : null),
      valor_aplicado: Number(valorAplicado.toFixed(2)),
      saldo_bruto: Number(saldoBruto.toFixed(2)),
      resultado: Number(resultado.toFixed(2)),
      rent_sobre_preco_medio: (rentSobrePM != null ? Number(rentSobrePM.toFixed(4)) : null)
    });
  } catch (err) {
    console.error('Erro /investimentos/inspector:', err);
    res.status(500).json({ erro: 'Erro ao calcular posição do ativo' });
  }
});

module.exports = router;