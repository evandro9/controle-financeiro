// backend/routes/investimentosEvolucaoRoutes.js (Postgres)
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { normTituloTesouro, ensureTesouroPU, gerarSerieDiaria } = require('../utils/invest-helpers');
const { exigirRecurso } = require('../middleware/assinaturaRecursos');

router.use(auth);
// exige plano com recurso premium
router.use(exigirRecurso('investimentos_premium'));

 // classificador simples e direto para "compra" | "venda"
 const isCompra = (t) => String(t || '').toLowerCase().includes('compra');
 const isVenda  = (t) => String(t || '').toLowerCase().includes('venda');

// ================= Helpers gerais (seguros) =================
// Converte para 'YYYY-MM-DD' de forma segura (UTC) — sem estourar Invalid time value
const ymd = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.valueOf())) return null;
  const utc = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  return utc.toISOString().slice(0, 10);
};
const iso = ymd;
// Construtores de limites de mês (strings seguras 'YYYY-MM-DD')
const ymStart = (y, m) => {
  const yy = Number(y), mm = Number(m);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || yy <= 0 || mm <= 0) return null;
  return `${String(yy).padStart(4,'0')}-${String(mm).padStart(2,'0')}-01`;
};
const ymEnd = (y, m) => {
  const yy = Number(y), mm = Number(m);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || yy <= 0 || mm <= 0) return null;
  const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  return `${String(yy).padStart(4,'0')}-${String(mm).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
};
const diasEntre = (di, df) => {
  const a = new Date(di + 'T00:00:00Z'), b = new Date(df + 'T00:00:00Z');
  return Math.max(0, Math.round((b - a) / 86400000));
};
function rangeDias(iniISO, fimISO) {
  const out = [];
  const iniOk = iniISO && !Number.isNaN(new Date(iniISO).valueOf());
  const fimOk = fimISO && !Number.isNaN(new Date(fimISO).valueOf());
  if (!iniOk || !fimOk) return out;
  let d = new Date(iniISO + 'T00:00:00Z');
  const end = new Date(fimISO + 'T00:00:00Z');
  for (; d <= end; d = new Date(d.getTime() + 86400000)) out.push(ymd(d));
  return out;
}
const toYahoo = (name) => {
  const t = String(name || '').trim().toUpperCase();
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return `${t}.SA`; // B3
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t)) return t;   // EUA/ETFs etc.
  return null;
};
const endOfMonth = (y, m) => new Date(Date.UTC(Number(y), Number(m), 0));
const fatorPRE = (taxaAA = 0, dias = 0, base = 252) => {
  const r = Number(taxaAA || 0);
  if (!isFinite(r) || r <= 0 || dias <= 0) return 1;
  return Math.pow(1 + r, dias / Number(base || 252));
};
function comeCotasBetween(di, df) {
  // semestral: Maio/Novembro
  const out = [];
  const start = new Date(di + 'T00:00:00Z');
  const end = new Date(df + 'T00:00:00Z');
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
    for (const m of [4, 10]) { // 0-based: 4=mai, 10=nov
      const d = new Date(Date.UTC(y, m, m === 4 ? 31 : 30));
      if (d >= start && d <= end) out.push(iso(d));
    }
  }
  return out;
}

// ================= Índices (Postgres) =================
// Placeholder (seu projeto já deve manter as tabelas populadas)
async function ensureSelic() { return true; }

async function produtoCDIEntre(iniISO, fimISO) {
  // Produto (1+CDI_dia) entre ini..fim. Se não tiver dias, devolve 1.
  const { rows } = await db.query(
    `SELECT date(data) AS d, valor
       FROM indices_cdi_diaria
      WHERE date(data) BETWEEN $1::date AND $2::date
      ORDER BY date(data) ASC`,
    [iniISO, fimISO]
  );
  let prod = 1;
  for (const r of rows) {
    const v = Number(r.valor || 0) / 100;
    prod *= (1 + v);
  }
  return prod;
}

async function fatorIPCAmais(taxaRealAA = 0, iniISO, fimISO) {
  // Fator = (1+IPCA_acum) * (1+taxa_real)^(dias/252)
  const iniYM = iniISO.slice(0, 7); // 'YYYY-MM'
  const fimYM = fimISO.slice(0, 7);
  const { rows } = await db.query(
    `SELECT competencia AS ym, valor
       FROM indices_ipca_mensal
      WHERE competencia >= $1 AND competencia <= $2
      ORDER BY competencia ASC`,
    [iniYM, fimYM]
  );
  let prod = 1;
  for (const r of rows) prod *= (1 + Number(r.valor || 0) / 100);
  // pró-rata até a data fim do mês
  const dias = diasEntre(`${fimYM}-01`, fimISO);
  prod *= fatorPRE(Number(taxaRealAA || 0), dias, 252);
  return prod;
}

const lastOnOrBefore = (map, isoDay) => {
  if (!map) return null;
  if (map.has(isoDay)) return map.get(isoDay);
  let best = null;
  for (const [d, v] of map.entries()) if (d <= isoDay && (!best || d > best.d)) best = { d, v };
  return best ? best.v : null;
};
const lastTradingPriceInMonth = (ps, y, m) => {
  if (!ps || !ps.size) return null;
  const prefix = `${y}-${String(m).padStart(2, '0')}-`;
  let bestDay = null;
  for (const d of ps.keys()) if (d.startsWith(prefix) && (!bestDay || d > bestDay)) bestDay = d;
  return bestDay ? ps.get(bestDay) : null;
};
const prevYm = (ymStr) => {
  const [y, m] = ymStr.split('-').map(Number);
  const yy = m === 1 ? y - 1 : y;
  const mm = m === 1 ? 12 : (m - 1);
  return `${yy}-${String(mm).padStart(2, '0')}`;
};

// ================= Valorização RF diária/mesal =================
async function valorRFnoDia(cfg, fluxos, fimISO) {
  const base = Number(cfg.base_dias || 252);
  const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
  const flows = (fluxos || []).filter(f => f.data <= fimISO).sort((a, b) => a.data.localeCompare(b.data));
  let S = 0, last = flows[0]?.data || fimISO;
  const aplicarCome = cfg.come_cotas ? comeCotasBetween(last, fimISO) : [];
  const pontos = [...aplicarCome, fimISO].sort();
  for (const pt of pontos) {
    if (S > 0) {
      if (cfg.indexador === 'PRE') {
        S *= fatorPRE(Number(cfg.taxa_anual || 0), diasEntre(last, pt), base);
      } else if (cfg.indexador === 'CDI') {
        const p = await produtoCDIEntre(last, pt);
        S *= Math.pow(p, Number(cfg.percentual_cdi || 0) / 100);
      } else if (cfg.indexador === 'IPCA') {
        S *= await fatorIPCAmais(Number(cfg.taxa_anual || 0), last, pt);
      }
      if (cfg.come_cotas && pt !== fimISO) {
        const ganho = Math.max(0, S - S / 1); // fórmula já aplicada acima; efeito: S - S_old
        S = Math.max(0, S - ganho * ali);
      }
    }
    // aplica fluxos no ponto
    for (const f of flows) if (f.data === pt) S += Number(f.valor_total || 0);
    last = pt;
  }
  return Number((S || 0).toFixed(2));
}

async function valorRFnoMes(cfg, fluxosAtivo, ano, mes, overrideManual) {
  if (overrideManual != null) return Number(overrideManual);
  const ultimo = iso(new Date(Date.UTC(ano, mes, 0)));
  await ensureSelic((fluxosAtivo[0]?.data || ultimo), ultimo);
  let S = 0, last = (fluxosAtivo[0]?.data || ultimo);
  const flows = (fluxosAtivo || []).filter(f => f.data <= ultimo).sort((a, b) => a.data.localeCompare(b.data));
  for (const f of flows) {
    if (S !== 0) {
      if (cfg.indexador === 'PRE') {
        const eventos = (cfg.come_cotas ? comeCotasBetween(last, f.data) : []);
        let ini = last;
        for (const cc of eventos) {
          S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
          if (S > 0) {
            const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
            const ganho = S - S / fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
            S = Math.max(0, S - ganho * ali);
          }
          ini = cc;
        }
        S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, f.data), cfg.base_dias || 252);
      } else if (cfg.indexador === 'CDI') {
        const eventos = (cfg.come_cotas ? comeCotasBetween(last, f.data) : []);
        let ini = last;
        for (const cc of eventos) {
          const p1 = await produtoCDIEntre(ini, cc);
          S *= Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
          if (S > 0) {
            const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
            const ganho = S - S / Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
            S = Math.max(0, S - ganho * ali);
          }
          ini = cc;
        }
        const p2 = await produtoCDIEntre(ini, f.data);
        S *= Math.pow(p2, Number(cfg.percentual_cdi || 0) / 100);
      } else if (cfg.indexador === 'IPCA') {
        const eventos = (cfg.come_cotas ? comeCotasBetween(last, f.data) : []);
        let ini = last;
        for (const cc of eventos) {
          const p1 = await fatorIPCAmais(Number(cfg.taxa_anual || 0), ini, cc);
          S *= p1;
          if (S > 0) {
            const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
            const ganho = S - S / p1;
            S = Math.max(0, S - ganho * ali);
          }
          ini = cc;
        }
        const p2 = await fatorIPCAmais(Number(cfg.taxa_anual || 0), ini, f.data);
        S *= p2;
      }
    }
    // aplica fluxo do dia (aplicação/resgate)
    S = Math.max(0, S + Number(f.valor_total || 0));
    last = f.data;
  }
  // capitaliza do último fluxo até o fim do mês
  if (S > 0) {
    if (cfg.indexador === 'PRE') {
      const eventos = (cfg.come_cotas ? comeCotasBetween(last, ultimo) : []);
      let ini = last;
      for (const cc of eventos) {
        S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
        if (S > 0) {
          const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
          const ganho = S - S / fatorPRE(cfg.taxa_anual, diasEntre(ini, cc), cfg.base_dias || 252);
          S = Math.max(0, S - ganho * ali);
        }
        ini = cc;
      }
      S *= fatorPRE(cfg.taxa_anual, diasEntre(ini, ultimo), cfg.base_dias || 252);
    } else if (cfg.indexador === 'CDI') {
      const eventos = (cfg.come_cotas ? comeCotasBetween(last, ultimo) : []);
      let ini = last;
      for (const cc of eventos) {
        const p1 = await produtoCDIEntre(ini, cc);
        S *= Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
        if (S > 0) {
          const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
          const ganho = S - S / Math.pow(p1, Number(cfg.percentual_cdi || 0) / 100);
          S = Math.max(0, S - ganho * ali);
        }
        ini = cc;
      }
      const p2 = await produtoCDIEntre(ini, ultimo);
      S *= Math.pow(p2, Number(cfg.percentual_cdi || 0) / 100);
    } else if (cfg.indexador === 'IPCA') {
      const eventos = (cfg.come_cotas ? comeCotasBetween(last, ultimo) : []);
      let ini = last;
      for (const cc of eventos) {
        const p1 = await fatorIPCAmais(Number(cfg.taxa_anual || 0), ini, cc);
        S *= p1;
        if (S > 0) {
          const ali = Math.max(0, Number(cfg.aliquota_comecotas || 15)) / 100;
          const ganho = S - S / p1;
          S = Math.max(0, S - ganho * ali);
        }
        ini = cc;
      }
      const p2 = await fatorIPCAmais(Number(cfg.taxa_anual || 0), ini, ultimo);
      S *= p2;
    }
  }
  return Number((S || 0).toFixed(2));
}

// ================= ROTA =================
router.get('/', async (req, res) => {
  const usuario_id = req.user.id;
  const { periodo = 'ano', classe_id, subclasse_id, classe, subclasse } = req.query;
  const modo = String(req.query.modo || '');
  const TRACE_DIAS = new Set(String(req.query.trace_dias || '').split(',').map(s => s.trim()).filter(Boolean));

  try {
    // 1) Buscar investimentos do usuário (filtros opcionais)
    const where = ['usuario_id = $1'];
    const params = [usuario_id];
    if (classe_id) { where.push(`classe_id = $${params.length + 1}`); params.push(Number(classe_id)); }
    if (subclasse_id) { where.push(`subclasse_id = $${params.length + 1}`); params.push(Number(subclasse_id)); }
    if (!classe_id && classe) { where.push(`UPPER(categoria) = UPPER($${params.length + 1})`); params.push(String(classe)); }
    if (!subclasse_id && subclasse) { where.push(`UPPER(subcategoria) = UPPER($${params.length + 1})`); params.push(String(subclasse)); }

    const rInv = await db.query(
      `SELECT nome_investimento, data_operacao, tipo_operacao, quantidade, valor_total,
              indexador, taxa_anual, percentual_cdi, metodo_valorizacao, data_inicio, vencimento, base_dias,
              come_cotas, aliquota_comecotas
         FROM investimentos
        WHERE ${where.join(' AND ')}
        ORDER BY date(data_operacao) ASC`,
      params
    );
    const investimentos = rInv.rows;

    // 2) Fallback de valores registrados (para quem não tem ticker)
    const rVal = await db.query(
      `SELECT nome_investimento, date(data_referencia) AS data_referencia,
              preco_unitario, valor_total
         FROM valores_atuais
        WHERE usuario_id = $1
        ORDER BY date(data_referencia) ASC`,
      [usuario_id]
    );
    const valores = rVal.rows;

    // 3) Meses presentes (sempre no formato 'YYYY-MM')
    const mesesSet = new Set();
    // -> dos investimentos
    investimentos.forEach(inv => {
      const isoDia = ymd(inv.data_operacao); // garantimos 'YYYY-MM-DD'
      if (isoDia) mesesSet.add(isoDia.slice(0, 7)); // 'YYYY-MM'
    });
    // -> dos valores_atuais (fallback)
    valores.forEach(val => {
      const isoDia = ymd(val?.data_referencia); // pode vir Date; normalizamos
      if (isoDia) mesesSet.add(isoDia.slice(0, 7)); // 'YYYY-MM'
    });
    // sanitiza: aceita só 'YYYY-MM'
    const todosMeses = Array.from(mesesSet)
      .filter(k => /^\d{4}-\d{2}$/.test(k))
      .sort();
    if (!todosMeses.length) {
      return res.json([]);
    }

    // 4) Fallback por mês/ativo
    const ativosPermitidos = new Set(investimentos.map(i => i.nome_investimento));
   const fallbackPorMes = {}; // { 'AAAA-MM': { ATIVO: {preco_unitario?, valor_total?} } }
    valores.forEach(v => {
      if (!v || !v.data_referencia) return;
      if (ativosPermitidos.size && !ativosPermitidos.has(v.nome_investimento)) return;
      const isoRef = ymd(v.data_referencia);  // normaliza Date -> 'YYYY-MM-DD'
      if (!isoRef) return;
      const chave = isoRef.slice(0, 7);       // 'YYYY-MM'
      fallbackPorMes[chave] ||= {};
      // último do mês (já ordenado na query)
      fallbackPorMes[chave][v.nome_investimento] = {
        preco_unitario: v.preco_unitario != null ? Number(v.preco_unitario) : null,
        valor_total: v.valor_total != null ? Number(v.valor_total) : null,
      };
    });

    // 4.1) Série Yahoo (close) para Ações/FII/ETFs
    const [minYYYY, minMM] = todosMeses[0].split('-').map(Number);
    const [maxYYYY, maxMM] = todosMeses[todosMeses.length - 1].split('-').map(Number);
    const period1 = ymStart(minYYYY, minMM);      // 'YYYY-MM-01' (seguro)
    const period2 = ymEnd(maxYYYY, maxMM);        // fim do mês (seguro)
    if (!period1 || !period2) return res.json([]); // nada a calcular se inválido

    const ativosSet = new Set(investimentos.map(i => i.nome_investimento));
    const equities = [];
    for (const nome of ativosSet) {
      const yf = toYahoo(nome);
      if (yf) equities.push({ nome, yf });
    }
    const priceSeries = new Map(); // nome -> Map('YYYY-MM-DD'->close)
    if (equities.length) {
      const yahooFinance = (await import('yahoo-finance2')).default;
      await Promise.all(equities.map(async ({ nome, yf }) => {
        try {
          const hist = await yahooFinance.historical(yf, { period1, period2, interval: '1d' });
          const mp = new Map();
          (hist || []).forEach(r => {
            const d = new Date(r.date);
            const isod = ymd(d);
            if (!isod) return;
            const px = (r.close != null ? Number(r.close) : (r.adjClose != null ? Number(r.adjClose) : null));
            if (px && isFinite(px)) mp.set(isod, px);
          });
          priceSeries.set(nome, mp);
        } catch (_) { /* ignora ativo sem histórico */ }
      }));
    }

    // FX USDBRL para ativos internacionais
    const fxSeries = new Map(); // 'YYYY-MM-DD' -> fx close
    if (equities.some(e => !e.yf.endsWith('.SA'))) {
      const yahooFinance = (await import('yahoo-finance2')).default;
      try {
        const fxHist = await yahooFinance.historical('USDBRL=X', { period1, period2, interval: '1d' });
        (fxHist || []).forEach(r => {
          const d = new Date(r.date);
          const isod = ymd(d);
          if (!isod) return;
          const px = (r.close ?? r.adjClose);
          if (px != null && isFinite(px)) fxSeries.set(isod, Number(px));
        });
      } catch { /* sem fx */ }
    }
    const lastFxInMonth = (y, m) => {
      const prefix = `${y}-${String(m).padStart(2, '0')}-`;
      let best = null;
      for (const d of fxSeries.keys()) if (d.startsWith(prefix) && (!best || d > best)) best = d;
      if (best) return fxSeries.get(best);
      // fallback: último FX conhecido até o fim do mês
      const cutoff = `${y}-${String(m).padStart(2, '0')}-31`;
      let bestAny = null;
      for (const d of fxSeries.keys()) if (d <= cutoff && (!bestAny || d > bestAny)) bestAny = d;
      return bestAny ? fxSeries.get(bestAny) : null;
    };

    // Tesouro PU (marcação a mercado) — tolerante a nomes
    const tesouros = Array.from(ativosSet).filter(n => /^Tesouro/i.test(n));
    // chave normalizada -> Map(YYYY-MM-DD -> número)
    const tesouroPUbase  = new Map();   // PU (marcação)
    const tesouroPUcomp  = new Map();   // PU_COMPRA (preço de compra)
    if (tesouros.length) {
      // garante PU carregado (evita a “queda” no dia seguinte ao aporte)
      for (const nome of tesouros) {
        try { await ensureTesouroPU(normTituloTesouro(nome), period1, period2); } catch {}
      }
      // indexa TODAS as séries do período (sem filtrar por nome aqui)
      const { rows } = await db.query(
        `SELECT (data)::date AS data, nome, MAX(pu) AS pu, MAX(pu_compra) AS pu_compra
           FROM indices_tesouro_pu
          WHERE (data)::date BETWEEN $1::date AND $2::date
          GROUP BY (data)::date, nome
          ORDER BY (data)::date ASC`,
        [period1, period2]
      );
      for (const r of rows) {
        const key = normTituloTesouro(r.nome);
        if (!tesouroPUbase.has(key)) tesouroPUbase.set(key, new Map());
        if (!tesouroPUcomp.has(key)) tesouroPUcomp.set(key, new Map());
        const dia = ymd(r.data);
        if (dia) {
          if (r.pu != null && isFinite(Number(r.pu))) {
            tesouroPUbase.get(key).set(dia, Number(r.pu));
          }
          if (r.pu_compra != null && isFinite(Number(r.pu_compra))) {
            tesouroPUcomp.get(key).set(dia, Number(r.pu_compra));
          }
        }
      }
    }
    // match flexível ("Renda+" x "Renda Mais", com/sem "Aposentadoria Extra")
    const findPuMap = (ativoNome) => {
      const base = normTituloTesouro(ativoNome);
      const candidatos = [
        base,
        base.replace(/\bAposentadoria\s+Extra\b/i, '').replace(/\s{2,}/g,' ').trim(),
        base.replace(/\bRenda\s*\+\b/i, 'Renda Mais'),
        base.replace(/\bRenda\s+Mais\b/i, 'Renda+'),
      ];
      for (const k of candidatos) if (tesouroPUbase.has(k)) return k;
      for (const [k] of tesouroPUbase) {
        if (k.includes(base) || base.includes(k)) return k;
      }
      return null;
    };

        // Busca PU no/ao redor de uma data (exato → onOrBefore → onOrAfter)
    const getPuOnOrNearTD = (key, isoDay, { preferCompra = false } = {}) => {
      if (!key) return null;
      const mapBase = tesouroPUbase.get(key);
      const mapComp = tesouroPUcomp.get(key);
      const map = (preferCompra ? mapComp : mapBase) || mapBase;
      if (!map) return null;
      const want = String(isoDay);
      // 1) exato
      if (map.has(want)) {
        const v = Number(map.get(want));
        if (isFinite(v) && v > 0) return v;
      }
      // 2) onOrBefore
      let best = null;
      for (const [d, v] of map.entries()) {
        if (d <= want) best = [d, v];
        else break;
      }
      if (best && isFinite(Number(best[1])) && Number(best[1]) > 0) return Number(best[1]);
      // 3) onOrAfter
      for (const [d, v] of map.entries()) {
        if (d >= want && isFinite(Number(v)) && Number(v) > 0) return Number(v);
      }
      return null;
    };


   // 3.1) Fluxos por mês (aportes +, resgates −) considerando TODAS as classes
   //     (fora de qualquer modo; usado no retorno mensal)
   const flowsPorMes = new Map(); // 'YYYY-MM' -> { aportes, resgates }
   investimentos.forEach(inv => {
     const dISO = ymd(inv.data_operacao);
     if (!dISO) return;
     const ym = dISO.slice(0, 7);
     const cur = flowsPorMes.get(ym) || { aportes: 0, resgates: 0 };
     const valAbs = Math.abs(Number(inv.valor_total) || 0);
     if (isCompra(inv.tipo_operacao)) cur.aportes  += valAbs;   // sempre positivo
     if (isVenda(inv.tipo_operacao))  cur.resgates -= valAbs;   // sempre negativo
     flowsPorMes.set(ym, cur);
   });

    const dbg = Array.from(flowsPorMes.entries())
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([ym, v]) => [ym, {
        aportes:  Number((v.aportes  || 0).toFixed(2)),
        resgates: Number((v.resgates || 0).toFixed(2)),
        liquido:  Number(((v.aportes||0)+(v.resgates||0)).toFixed(2)),
      }]);
 
    // MODO RENTABILIDADE DIÁRIA: delega ao helper central (mantém logs de cobertura [COVER] apenas)
    if (modo === 'rent_diaria') {
      const serie = await gerarSerieDiaria(usuario_id, {
        periodo,
        authHeader: req.headers.authorization,
      });
      return res.json(serie);
    }

    // ===================== MODO MENSAL (investido x atual) =====================
    const resultado = [];
    for (const chave of todosMeses) {
      const [ano, mes] = chave.split('-'); // 'AAAA','MM'
      const dataLimite = endOfMonth(ano, mes);

      // Quantidade acumulada até o mês
      const qtdPorAtivo = {};
      investimentos.forEach(inv => {
        const data = new Date(inv.data_operacao);
        if (data <= dataLimite) {
          const tipo = String(inv.tipo_operacao || '').toLowerCase();
          if (!qtdPorAtivo[inv.nome_investimento]) qtdPorAtivo[inv.nome_investimento] = 0;
          const qAbs = Math.abs(Number(inv.quantidade) || 0);
          const isEntrada = tipo.includes('compra') || tipo.includes('buy') || tipo.includes('aplic') || tipo.includes('bonific');
          const isSaida = tipo.includes('venda') || tipo.includes('sell') || tipo.includes('resgat') || tipo.includes('saida') || tipo.includes('saída') || tipo.includes('leilao') || tipo.includes('leilão') || tipo.includes('ajuste_bonific') || (tipo.includes('ajuste') && tipo.includes('bonific'));
          if (isEntrada) qtdPorAtivo[inv.nome_investimento] += qAbs;
          else if (isSaida) qtdPorAtivo[inv.nome_investimento] -= qAbs;
        }
      });

      // Valor aplicado até o mês
      const aplicadoPorAtivo = new Map(); // ativo -> { qtd, custoPM, aplicadoFluxo, isRF }
      investimentos.forEach(inv => {
        const dt = new Date(inv.data_operacao);
        if (dt > dataLimite) return;
        const ativo = inv.nome_investimento;
        const tipo = String(inv.tipo_operacao || '').toLowerCase();
        const isRF = !!String(inv.indexador || '').trim();
        const reg = aplicadoPorAtivo.get(ativo) || { qtd: 0, custoPM: 0, aplicadoFluxo: 0, isRF };
        const qAbs = Math.abs(Number(inv.quantidade) || 0);
        const val = Math.abs(Number(inv.valor_total) || 0);
        const isCompra = tipo.includes('compra') || tipo.includes('buy') || tipo.includes('aplic');
        const isVenda = tipo.includes('venda') || tipo.includes('sell') || tipo.includes('resgat') || tipo.includes('saida') || tipo.includes('saída') || tipo.includes('leilao') || tipo.includes('leilão');
        if (isCompra) {
          reg.qtd += qAbs;
          if (!isRF) reg.custoPM += val;      // PM p/ ações/FII/ETF
          if (isRF) reg.aplicadoFluxo += val; // fluxo p/ RF
        } else if (isVenda) {
          if (!isRF) {
            if (reg.qtd > 0 && qAbs > 0) {
              const pm = reg.custoPM / reg.qtd;
              reg.qtd = Math.max(0, reg.qtd - qAbs);
              reg.custoPM = Math.max(0, reg.custoPM - pm * qAbs);
            }
          } else {
            reg.aplicadoFluxo = Math.max(0, reg.aplicadoFluxo - val);
            reg.qtd = Math.max(0, reg.qtd - qAbs);
          }
        } else if (tipo.includes('bonific')) {
          reg.qtd += qAbs;
        } else if (tipo.includes('ajuste_bonific') || (tipo.includes('ajuste') && tipo.includes('bonific'))) {
          reg.qtd = Math.max(0, reg.qtd - qAbs);
        }
        aplicadoPorAtivo.set(ativo, reg);
      });

      let totalInvestidoAteMes = 0;
      for (const [_, { qtd, custoPM, aplicadoFluxo, isRF }] of aplicadoPorAtivo.entries()) {
        if (qtd > 0) totalInvestidoAteMes += isRF ? aplicadoFluxo : custoPM;
      }

      // Valor atual do mês (Yahoo/FX → Tesouro PU → RF fórmula → fallback valores_atuais)
      let totalAtual = 0;
      const fbMes = fallbackPorMes[chave] || {};

      for (const [ativo, qtd] of Object.entries(qtdPorAtivo)) {
        if (qtd <= 0) continue;

        // (1) Preço de mercado
        const ps = priceSeries.get(ativo);
        const px = lastTradingPriceInMonth(ps, ano, Number(mes));
        if (px != null) {
          const yf = toYahoo(ativo);
          const isBR = yf && yf.endsWith('.SA');
          const fx = isBR ? 1 : (lastFxInMonth(ano, Number(mes)) || 0);
          const sub = Number((qtd * px * fx).toFixed(2));
          totalAtual += sub;
          continue;
        }

        // (2) Tesouro Direto – valor do mês = (UNIDADES por fluxo) * (PU base no fim do mês)
        if (/^Tesouro/i.test(ativo)) {
          const key = findPuMap(ativo); // chave normalizada encontrada
          if (key) {
            const fimMesISO = ymEnd(Number(ano), Number(mes));
            // PU de marcação no fim do mês (sempre PU base)
            const puEnd = getPuOnOrNearTD(key, fimMesISO, { preferCompra: false });
            // Deriva UNIDADES até o fim do mês a partir dos fluxos (±valor_total / PU_do_dia)
            let units = 0;
            const invsAtivo = investimentos
              .filter(i => i.nome_investimento === ativo)
              .sort((a,b) => ymd(a.data_operacao).localeCompare(ymd(b.data_operacao)));
            for (const i of invsAtivo) {
              const dia = ymd(i.data_operacao);
              if (!dia || dia > fimMesISO) break;
              const tipo = String(i.tipo_operacao || '').toLowerCase();
              const compra = tipo.includes('compra') || tipo.includes('buy') || tipo.includes('aplic');
              const venda  = tipo.includes('venda')  || tipo.includes('sell') || tipo.includes('resgat') || tipo.includes('saida') || tipo.includes('saída');
              if (!compra && !venda) continue;
              const vtAbs = Math.abs(Number(i.valor_total) || 0);
              if (!(vtAbs > 0)) continue;
              const puFlow = getPuOnOrNearTD(key, dia, { preferCompra: compra });
              if (puFlow && isFinite(puFlow) && puFlow > 0) {
                const sinal = venda ? -1 : +1;
                units += (sinal * vtAbs) / puFlow;
              }
            }
            if (units > 0 && puEnd != null) {
              const val = Number((units * puEnd).toFixed(2));
              totalAtual += val;
              continue;
            }
          }
          // se não conseguiu marcar via PU (sem série ou sem flows), cai no RF tradicional abaixo
        }

        // (3) RF tradicional (fórmula) - monta cfg/fluxos a partir do array `investimentos` já carregado
        const invsAtivo = investimentos.filter(i => i.nome_investimento === ativo);
        const first = invsAtivo.find(i => i.indexador);
        const cfgRF = first ? {
          indexador: String(first.indexador || '').toUpperCase(),
          taxa_anual: (first.taxa_anual != null ? Number(first.taxa_anual) : null),
          percentual_cdi: (first.percentual_cdi != null ? Number(first.percentual_cdi) : null),
          base_dias: Number(first.base_dias) || 252,
          come_cotas: !!first.come_cotas,
          aliquota_comecotas: (first.aliquota_comecotas != null ? Number(first.aliquota_comecotas) : 15),
        } : null;
        if (cfgRF && cfgRF.indexador) {
          const fim = ymEnd(Number(ano), Number(mes));
          const fluxos = invsAtivo.map(i => {
            const tipo = String(i.tipo_operacao || '').toLowerCase();
            const saida = tipo.includes('vend') || tipo.includes('resgat');
            return { data: ymd(i.data_operacao), valor_total: (saida ? -1 : +1) * (Number(i.valor_total) || 0) };
          }).filter(f => f.data && f.data <= fim).sort((a,b) => a.data.localeCompare(b.data));
          const vRF = await valorRFnoMes(cfgRF, fluxos, Number(ano), Number(mes), null);
          if (vRF > 0) {
            totalAtual += vRF;
            continue;
          }
        }

        // (4) Fallback valores_atuais
        const fb = fbMes[ativo];
        if (fb?.preco_unitario != null) {
          const sub = Number((qtd * fb.preco_unitario).toFixed(2));
          totalAtual += sub;
        } else if (fb?.valor_total != null) {
          totalAtual += fb.valor_total;
        }
      }

      const invMes = Number(totalInvestidoAteMes.toFixed(2));
      const atuMes = Number(totalAtual.toFixed(2));

      resultado.push({
        mes: `${String(mes).padStart(2, '0')}/${ano}`,
        investido: invMes,
        atual: atuMes,   
        // novos campos p/ gráfico de aportes:
        aportes_mes: Number(((flowsPorMes.get(chave)?.aportes)  ?? 0).toFixed(2)),
        resgates_mes: Number(((flowsPorMes.get(chave)?.resgates) ?? 0).toFixed(2)),
        liquido_mes: Number((
          ((flowsPorMes.get(chave)?.aportes) ?? 0) +
          ((flowsPorMes.get(chave)?.resgates) ?? 0)
        ).toFixed(2)),
      });    
    }

    // Ordena por data real (MM/AAAA → YYYY-MM)
    const parseKey = (m) => {
      const [mm, yyyy] = m.mes.split('/').map(x => x.trim());
      return `${yyyy}-${mm.padStart(2, '0')}`;
    };
    resultado.sort((a, b) => parseKey(a).localeCompare(parseKey(b)));

    // recortes
    let saida = [...resultado];
    if (periodo === '12m') saida = saida.slice(-12);
    else if (periodo === '24m') saida = saida.slice(-24);
    else if (periodo === 'ano') {
      const anoAtual = new Date().getFullYear();
      saida = saida.filter(r => String(r.mes).endsWith(`/${anoAtual}`));
      if (saida.length === 0) saida = resultado.slice(-12);
    }

    res.json(saida);
  } catch (err) {
    console.error('Erro ao calcular evolução:', err);
    res.status(500).json({ erro: 'Erro ao calcular evolução', detalhe: String(err?.message || err) });
  }
});

module.exports = router;
