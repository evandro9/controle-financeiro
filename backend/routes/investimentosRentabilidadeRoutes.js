// backend/routes/investimentosRentabilidadeRoutes.js  (Postgres)
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');

// 🔁 Helpers compartilhados (tiram ~600+ linhas do arquivo)
const {
  // datas
  dateInt, iso, lastBusinessDayOfMonthUTC, addDaysISO, diasEntre, isBizDay, prevTrading, nextTrading, weekdaysBetween, rangeFromPeriodo,
  // normalização/cálculo
  calcularRentabilidade, normTituloTesouro, comeCotasBetween, fatorPRE,
  // índices
  ensureCDI, produtoCDIEntre, ensureSelic, produtoSelicEntre, fatorIPCAmais, ensureTesouroPU, valorRFnaData,
  // yahoo/fx
  toYahoo, buildPriceSeriesFor, buildFXSeriesUSDBRL, fxOnOrBefore, prevMarketPrice, lastPxOnOrBefore,
  // twr
  agregaMensalTWR, gerarSerieDiaria
} = require('../utils/invest-helpers')

// Garante auth em todas as rotas abaixo
router.use(auth);


// ---------------- Boot de índices on-demand ----------------
const lastIndexRefreshByUser = new Map(); // userId -> ts
// 🔑 Passa o req para podermos usar o Authorization do usuário
async function doBootIndices(req, usuarioId, { throttleMs = 10*60*1000 } = {}) {
  const now = Date.now();
  const last = lastIndexRefreshByUser.get(usuarioId) || 0;
  if (now - last < throttleMs) {
    return { ok: true, skipped: 'throttled' };
  }

  // Header Authorization do usuário que chamou a rota
  const authHeader = req.headers?.authorization || '';
  const BASE = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  // Helper DRY pra chamadas internas autenticadas
  const postInternal = (path, payload) => fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(payload),
  });

  // 1) intervalo [inicio, fim]
  const rMin = await db.query(
    `SELECT MIN((data_operacao)::date) AS min_data
       FROM investimentos
      WHERE usuario_id = $1`,
    [usuarioId]
  );
  const minData = rMin.rows?.[0]?.min_data;
  const toISO = (d) => {
    const dt = new Date(d);
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()))
      .toISOString().slice(0,10);
  };
  const hojeISO = toISO(new Date());
  const inicio  = minData ? toISO(minData)
                          : toISO(new Date(Date.UTC(new Date().getUTCFullYear()-2, new Date().getUTCMonth(), new Date().getUTCDate())));
  const fim     = hojeISO;

  // 2) títulos do Tesouro do usuário (para PU)
  const rTD = await db.query(
    `SELECT DISTINCT TRIM(nome_investimento) AS nome
       FROM investimentos
      WHERE usuario_id = $1
        AND (
          UPPER(categoria)    LIKE '%TESOURO%' OR
          UPPER(subcategoria) LIKE '%TESOURO%' OR
          UPPER(nome_investimento) LIKE 'TESOURO %'
        )`,
    [usuarioId]
  );
  const titulosTesouro = (rTD.rows || [])
    .map(r => normTituloTesouro(r.nome || ''))
    .filter(Boolean);

  // 3) garante CDI/SELIC (helpers locais → sem depender de HTTP)
  const out = { ok: true, range: { inicio, fim } };
  try {
    await ensureCDI(inicio, fim, { authHeader }); // logs saem do helper
    out.cdi = { ok: true, info: 'ver [ensureCDI] no console' };
  } catch (e) {
    out.cdi = { ok: false, erro: String(e?.message || e) };
  }
  try {
    await ensureSelic(inicio, fim, { authHeader });
    out.selic = { ok: true, info: 'ver [ensureSelic] no console' };
  } catch (e) {
    out.selic = { ok: false, erro: String(e?.message || e) };
  }

  // 4) tenta IPCA via rota (se existir); ignora erro
  out.ipca = { ok: false, skipped: true };
  try {
    // usa a chamada interna autenticada (mesmo token do usuário)
    const r = await postInternal('/indices/ipca/sync', { inicio, fim });
    out.ipca = { ok: r.ok, status: r.status };
  } catch {}

  // 5) garante PU do Tesouro por título
  out.tesouro_pu = { ok: true, titulos: [], erros: [] };
  for (const nome of titulosTesouro) {
    try {
      await ensureTesouroPU(nome, inicio, fim, { authHeader });
      out.tesouro_pu.titulos.push(nome);
    } catch (e) {
      out.tesouro_pu.ok = false;
      out.tesouro_pu.erros.push({ nome, erro: String(e?.message || e) });
    }
  }

  lastIndexRefreshByUser.set(usuarioId, now);
  return out;
}

// ---------------------------------------------------------------------------
// 🔄 Boot rápido de índices (chamado pelo front quando abre a tela)
// Atualiza CDI diária, SELIC diária, IPCA mensal e PU de Tesouro Direto
// Intervalo: da primeira operação do usuário até hoje (UTC)
// ---------------------------------------------------------------------------
router.get('/atualizar-cotacoes', auth, async (req, res) => {
  try {
    const out = await doBootIndices(req, req.user.id, { throttleMs: 0 });
    return res.json(out);
  } catch (e) {
    console.error('❌ /investimentos/atualizar-cotacoes:', e);
    return res.status(500).json({ ok:false, erro:'Falha ao atualizar índices' });
  }
});

// 📊 Rota 1: Rentabilidade DETALHADA por ativo e subclasse (usada pela tabela)
router.get('/rentabilidade-detalhada', async (req, res) => {
  const { ano, subclasse } = req.query;
  const usuario_id = req.user.id;

  if (!ano) return res.status(400).json({ erro: 'Ano é obrigatório.' });

  try {
    // garante índices antes de processar (throttle 10min)
    await doBootIndices(req, usuario_id).catch(e => console.warn('[boot on-demand][detalhada]', e?.message || e));
    // Compras por ativo (soma)
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
      WHERE i.usuario_id = $1
    `;
    if (subclasse) {
      query += ' AND i.subcategoria ILIKE $2';
      params.push(`%${subclasse}%`);
    }
    query += ' GROUP BY i.nome_investimento, i.subcategoria';

    const comprasRes = await db.query(query, params);
    const compras = comprasRes.rows || [];

    const comprasMap = {};
    compras.forEach(c => {
      comprasMap[c.nome_investimento] = Number(c.valor_compra) || 1;
    });

    // valores_atuais no ano
    const valoresParams = [usuario_id, Number(ano)];
    let valoresQuery = `
      SELECT
        EXTRACT(MONTH FROM (va.data_referencia)::date)::int AS mes,
        (va.data_referencia)::date AS data_referencia,
        i.subcategoria AS subclasse,
        i.nome_investimento AS ativo,
        va.valor_total AS valor_atual
      FROM valores_atuais va
      JOIN investimentos i 
        ON i.usuario_id = va.usuario_id
       AND UPPER(TRANSLATE(REPLACE(REPLACE(TRIM(i.nome_investimento),'-',''),' ',''), 
             'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 
             'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
        = UPPER(TRANSLATE(REPLACE(REPLACE(TRIM(va.nome_investimento),'-',''),' ',''), 
             'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 
             'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
      WHERE va.usuario_id = $1
        AND EXTRACT(YEAR FROM (va.data_referencia)::date)::int = $2
    `;
    if (subclasse) {
      valoresQuery += ' AND i.subcategoria ILIKE $3';
      valoresParams.push(`%${subclasse}%`);
    }
    valoresQuery += ' ORDER BY i.subcategoria, i.nome_investimento, (va.data_referencia)::date';

    const rows = (await db.query(valoresQuery, valoresParams)).rows || [];

    const agrupado = {};
    rows.forEach(r => {
      const chave = `${r.subclasse}||${r.ativo}`;
      if (!agrupado[chave]) agrupado[chave] = {
        valor_compra: comprasMap[r.ativo] || 1,
        historico: []
      };
      agrupado[chave].historico.push({
        mes: parseInt(r.mes, 10),
        valor: Number(r.valor_atual),
        data: r.data_referencia
      });
    });

    const resultado = [];
    for (const chave in agrupado) {
      const [subclasseNome, ativo] = chave.split('||');
      const { valor_compra, historico } = agrupado[chave];
      historico.sort((a, b) => a.mes - b.mes);
      for (let i = 0; i < historico.length; i++) {
        const atual = historico[i].valor;
        const mes = historico[i].mes;
        let base = i === 0 ? valor_compra : historico[i - 1].valor;
        const rentabilidade = calcularRentabilidade(atual, base);
        resultado.push({
          mes,
          subclasse: subclasseNome,
          ativo,
          rentabilidade_pct: rentabilidade,
          valor_investido: base
        });
      }
    }

    res.json(Array.isArray(resultado || []) ? resultado || [] : []);
  } catch (e) {
    console.error('Erro /rentabilidade-detalhada:', e);
    res.status(500).json({ erro: 'Erro ao buscar rentabilidade.' });
  }
});

// 📈 Rentabilidade Mensal Geral — responde no formato { totalGeral }
router.get("/rentabilidade-mensal/:ano", async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const ano = Number(req.params.ano);
    const periodo = String(req.query.periodo || 'ano');
    // garante índices antes de processar (throttle 10min)
    await doBootIndices(req, usuarioId).catch(e => console.warn('[boot on-demand][mensal]', e?.message || e));

    // Janela: para 'ano', prende no ano solicitado; senão usa range do período e filtra pelo ano
    let startISO, endISO;
    if (periodo === 'ano') {
      const hoje = new Date();
      const todayISO = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()))
                        .toISOString().slice(0,10);
      startISO = `${ano}-01-01`;
      endISO   = (hoje.getUTCFullYear() === ano) ? todayISO : `${ano}-12-31`;
    } else {
      ({ startISO, endISO } = rangeFromPeriodo(periodo));
    }

    const dailyAll = await gerarSerieDiaria(usuarioId, { ...req.query, periodo, authHeader: req.headers.authorization });
    const daily = (dailyAll || []).filter(d => d.date >= startISO && d.date <= endISO);

    // Agrega (∏(1+r_d)−1) por mês e FILTRA pelo ano solicitado
    let mensal = agregaMensalTWR(daily).filter(m => m.ano_mes.startsWith(String(ano)));
    // (o front já limita meses futuros; manter só o shape esperado aqui)

    const totalGeral = {};
    for (const m of mensal) {
      totalGeral[m.mes] = m.rentabilidade_pct;
      totalGeral[String(m.mes).padStart(2, '0')] = m.rentabilidade_pct;
    }
    return res.json({ totalGeral });
  } catch (e) {
    console.error('❌ Erro /rentabilidade-mensal:', e);
    return res.json({ totalGeral: {} });
  }
});

// ======================================================================
// ROTA CURTA: /investimentos/rentabilidade-subclasse-ativo/:ano
// ======================================================================
// Supõe que as helpers abaixo já existam no arquivo (reuso!):
// - db (pool PG) e auth (middleware)
// - toYahoo, buildPriceSeriesFor, lastPxOnOrBefore
// - buildFXSeriesUSDBRL, fxOnOrBefore  (para converter US -> BRL quando preciso)
// - ensureTesouroPU  (carrega PUs do Tesouro)
// - produtoCDIEntre, ensureCDI
// - produtoSelicEntre, ensureSelic
// - fatorPRE, fatorIPCAmais
// - lastBusinessDayOfMonthUTC
// Se alguma delas não existir no seu arquivo, me avisa que eu injeto versões mínimas.

router.get('/rentabilidade-subclasse-ativo/:ano', auth, async (req, res) => {
  const usuarioId = req.user.id;
  const ano = Number(req.params.ano);
  const DEBUG = String(req.query.debug || '') === '0';
  if (!ano || ano < 1900 || ano > 2100) return res.status(400).json({ erro: 'Ano inválido' });

  // Limite: até o mês corrente (se for o ano atual) ou 12 (anos passados)
  const hoje = new Date();
  const mesLimite = (ano === hoje.getFullYear()) ? (hoje.getMonth() + 1) : 12;

  // Helpers de data (UTC)
  const monthBoundsUTC = (y, m) => {
    // m: 1..12  => retorna [ini do mês, fim do mês] em string 'YYYY-MM-DD'
    const di = new Date(Date.UTC(y, m - 1, 1));
    const df = new Date(Date.UTC(y, m, 0)); // último dia do mês
    const toISO = (d) => d.toISOString().slice(0, 10);
    return [toISO(di), toISO(df)];
  };

  const firstOnOrAfter = (map, isoDay) => {
    if (!map || !map.size) return null;
    // procura >= isoDay; se não achar, volta no último <= isoDay
    let after = null, before = null;
    for (const [d, v] of map.entries()) {
      if (d < isoDay) before = v;
      if (d >= isoDay) { after = v; break; }
    }
    return after ?? before ?? null;
  };

  const eomPrev = (y, m) => { // último dia útil do mês anterior
    const d = (m === 1) ? lastBusinessDayOfMonthUTC(y - 1, 12)
                        : lastBusinessDayOfMonthUTC(y, m - 1);
    return d.toISOString().slice(0, 10);
  };
  const eom = (y, m) => { // último dia útil do mês m
    const d = lastBusinessDayOfMonthUTC(y, m);
    return d.toISOString().slice(0, 10);
  };

  // 🔒 Garante 'YYYY-MM-DD' para qualquer valor vindo do PG (Date, texto, etc.)
  const toISOdate = (v) => {
    if (!v) return null;
    if (v instanceof Date) {
      return iso(v); // helper importada
    }
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d) ? s.slice(0,10) : iso(d);
  };  

    const pad2 = (n) => String(n).padStart(2, '0');
  const monthStartISO = (y, m) => `${y}-${pad2(m)}-01`;
  const monthEndISO   = (y, m) => {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${pad2(m)}-${pad2(last)}`;
  };

  // quantidade acumulada ATÉ (inclusive) uma data ISO
  const qtdAteInclusivo = (ops, isoDay) => {
    let q = 0;
    for (const o of ops) {
      if (o.data > isoDay) break;
      const tipo = o.tipo;
      const qabs = Math.abs(o.quantidade || 0);
      const isCompra = /compra|buy|aplic/i.test(tipo);
      const isVenda  = /vend|sell|resgat|saida|saída|leilao|leilão/i.test(tipo);
      const isBonus  = /bonific/i.test(tipo) && !/ajuste/i.test(tipo);
      if (isCompra) q += qabs;
      else if (isVenda) q -= qabs;
      else if (isBonus) q += qabs;
    }
    return q;
  };
  // primeira data do mês em que a posição (quantidade) fica > 0
  // retorna a PRIMEIRA data do mês em que a posição passa de 0 → >0
  // se já havia posição no EOM-1, retorna null (não "nasceu" no mês)
  const primeiraDataComPosicaoNoMes = (ops, y, m) => {
    const ini = monthStartISO(y, m);
    const fim = monthEndISO(y, m);
    const basePrev = eomPrev(y, m); // último dia útil do mês anterior
    let q = qtdAteInclusivo(ops, basePrev);
    if (q > 0) return null; // já existia posição ao abrir o mês
    for (const o of ops) if (o.data >= ini && o.data <= fim) {
      const isCompra = /compra|buy|aplic/i.test(o.tipo);
      const isBonus  = /bonific/i.test(o.tipo) && !/ajuste/i.test(o.tipo);
      const isVenda  = /vend|sell|resgat|saida|saída|leilao|leilão/i.test(o.tipo);
      if (isCompra || isBonus) q += Math.abs(o.quantidade || 0);
      else if (isVenda) q -= Math.abs(o.quantidade || 0);
      if (q > 0) return o.data; // "nasceu" neste dia
    }
    return null;
  };

  // -------------------------------------------------------------
  // 1) Base: lista de ativos do usuário (com subclasse) + operações
  // -------------------------------------------------------------
  const base = (await db.query(`
    SELECT
      i.nome_investimento           AS ativo,
      COALESCE(isc.nome,'Outros')   AS subclasse,
      (i.data_operacao)::date       AS data,
      LOWER(i.tipo_operacao)        AS tipo,
      COALESCE(i.quantidade,0)      AS quantidade,
      COALESCE(i.valor_total,0)     AS valor_total,
      -- campos de RF (quando existirem na linha mais recente daquele ativo)
      i.indexador, i.taxa_anual, i.percentual_cdi, i.base_dias,
      i.come_cotas, i.aliquota_comecotas
    FROM investimentos i
    LEFT JOIN investimento_subclasses isc
      ON isc.id = i.subclasse_id
     AND (isc.usuario_id = i.usuario_id OR isc.usuario_id IS NULL)
    WHERE i.usuario_id = $1
  `, [usuarioId])).rows;

  if (!base.length) {
    return res.json({ dados: [], totalGeral: {} });
  }

  // Normalização e agrupamento por ativo
  const porAtivo = new Map();
  for (const r of base) {
    const ativoRaw = String(r.ativo || '').trim();
    if (!ativoRaw) continue;
    if (!porAtivo.has(ativoRaw)) {
      porAtivo.set(ativoRaw, {
        subclasse: r.subclasse || 'Outros',
        operacoes: [],
        cfgRF: null // preenchido abaixo se RF
      });
    }
    porAtivo.get(ativoRaw).operacoes.push({
      data: toISOdate(r.data), // ✅ normaliza p/ 'YYYY-MM-DD'
      tipo: String(r.tipo || '').normalize('NFKD'),
      quantidade: Number(r.quantidade || 0),
      valor_total: Number(r.valor_total || 0)
    });
  }

  // Detectores simples
  const isTesouro = (nome) => /tesouro|ntn|ltn|lft|ntnb/i.test(nome);
  const isProvavelRF = (nome, subclasse) =>
    /renda\s*f(ixa|ixada)|cdb|lci|lca|debênt|debent|cri|cra/i.test(`${nome} ${subclasse||''}`);

  // Carrega config de RF (último cadastro com indexador não nulo por ativo)
  for (const [ativo] of porAtivo) {
    const cfg = (await db.query(
      `SELECT indexador, taxa_anual, percentual_cdi, base_dias, come_cotas, aliquota_comecotas
         FROM investimentos
        WHERE usuario_id = $1
          AND nome_investimento = $2
          AND indexador IS NOT NULL
     ORDER BY id DESC LIMIT 1`,
      [usuarioId, ativo]
    )).rows?.[0] || null;
    if (cfg) porAtivo.get(ativo).cfgRF = {
      indexador: String(cfg.indexador || '').toUpperCase(),
      taxa_anual: (cfg.taxa_anual != null ? Number(cfg.taxa_anual) : null),
      percentual_cdi: (cfg.percentual_cdi != null ? Number(cfg.percentual_cdi) : null),
      base_dias: (cfg.base_dias || 252),
      come_cotas: !!cfg.come_cotas,
      aliquota_comecotas: (cfg.aliquota_comecotas != null ? Number(cfg.aliquota_comecotas) : 0)
    };
  }

  // -------------------------------------------------------------
  // 2) Precificação: Yahoo (equities) e PU (Tesouro)
  // -------------------------------------------------------------
  // Yahoo: histórico único cobrindo o ano (e um pouco antes) para todos os tickers
  const equities = [];
  for (const [ativo] of porAtivo) {
    const yf = toYahoo(ativo);
    if (yf) equities.push({ nome: ativo, yf });
  }
  const startISO = new Date(Date.UTC(ano - 1, 11, 1)).toISOString().slice(0, 10);
  const endISO   = new Date(Date.UTC(ano + 1, 0, 31)).toISOString().slice(0, 10);
  const priceSeries = await buildPriceSeriesFor(equities, startISO, endISO, 10, 'close');

  // FX USDBRL (se tiver ticker em USD) + conversão da série para BRL
  const needFX = equities.some(e => !/\.SA$/i.test(e.yf));
  const fxUSDBRL = needFX ? await buildFXSeriesUSDBRL(startISO, endISO, 10) : null;
  if (needFX && fxUSDBRL) {
    for (const { nome, yf } of equities) {
      if (yf && !/\.SA$/i.test(yf)) {
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
  }

  // Tesouro: PUs do ano (direto do banco) — inclui PU_COMPRA e ordena por data
  const puTesouro = (await db.query(
    `SELECT (data)::date AS data_iso, nome, pu, pu_compra
       FROM indices_tesouro_pu
      WHERE (data)::date BETWEEN $1::date AND $2::date
      ORDER BY (data)::date ASC`,
    [`${ano-1}-12-01`, `${ano+1}-01-31`]
  )).rows;

  // Mapa de PU com aliases (nome "cru" e nome normalizado tipo "Tesouro Renda+ 2065")
  const puMap = new Map();        // chave canônica -> [{data, pu, pu_compra}]
  const aliasIndex = new Map();   // alias UPPER -> chave canônica
  for (const r of puTesouro) {
    const nomeRaw  = String(r.nome || '').trim();
    const nomeNorm = normTituloTesouro(nomeRaw);
    const keyRaw   = nomeRaw.toUpperCase();
    const keyNorm  = nomeNorm.toUpperCase();
    // escolhe/abre a série canônica
    const canon = aliasIndex.get(keyNorm) || aliasIndex.get(keyRaw) || keyNorm;
    if (!puMap.has(canon)) puMap.set(canon, []);
    // aponta aliases para a chave canônica
    aliasIndex.set(keyNorm, canon);
    aliasIndex.set(keyRaw,  canon);
    puMap.get(canon).push({
      // ✅ garanta 'YYYY-MM-DD' para comparações lexicográficas confiáveis
      data: toISOdate(r.data_iso),
      pu: Number(r.pu),
      pu_compra: (r.pu_compra != null ? Number(r.pu_compra) : null),
    });
  }
  // procura chave usando alias normalizado e nome cru
  const findPuKey = (titulo) => {
    const kRaw  = String(titulo || '').trim().toUpperCase();
    const kNorm = normTituloTesouro(titulo || '').toUpperCase();
    return aliasIndex.get(kNorm) || aliasIndex.get(kRaw) || null;
  };
  const getPuOnOrNear = (titulo, dataISO, { preferCompra = false } = {}) => {
    const key = findPuKey(titulo);
    const arr = key ? puMap.get(key) : [];
    if (!arr || !arr.length) return null;
    const want = toISOdate(dataISO); // ✅ normaliza alvo
    // 1) tenta exatamente no dia
    const ex = arr.find(x => x.data === want);
    if (ex) {
      const v = preferCompra ? (ex.pu_compra ?? ex.pu) : ex.pu;
      if (isFinite(v) && v > 0) return v;
    }
    // 2) onOrAfter
    for (const x of arr) {
      if (x.data >= want) {
        const v = preferCompra ? (x.pu_compra ?? x.pu) : x.pu;
        if (isFinite(v) && v > 0) return v;
        // não faz break: segue procurando um próximo válido
        break;
      }
    }
    // 3) onOrBefore
    let best = null;
    for (const x of arr) {
      if (x.data <= want) best = x;
      else break;
    }
    const v = best ? (preferCompra ? (best.pu_compra ?? best.pu) : best.pu) : null;
    return (isFinite(v) && v > 0) ? v : null;
  };

    // 🔢 Deriva UNIDADES (qtd) a partir de fluxos até uma data (±valor_total / PU_no_dia).
  // - Compras: preferir PU_COMPRA (se existir); Vendas: PU base.
  // - Usa a mesma resolução de PU do getPuOnOrNear (exato, on/after, on/before).
  const unidadesAtePorFluxo = (ativo, ops, ateISO) => {
    let u = 0;
    const ate = String(ateISO);
    for (const o of ops) {
      if (o.data > ate) break;
      const tipo = String(o.tipo || '');
      const isVenda  = /vend|sell|resgat|saida|saída|leilao|leilão/i.test(tipo);
      const isCompra = /compra|buy|aplic/i.test(tipo);
      if (!isVenda && !isCompra) continue;
      const vt = Math.abs(Number(o.valor_total || 0));
      if (!(vt > 0)) continue;
      const puFlow = getPuOnOrNear(ativo, o.data, { preferCompra: isCompra });
      if (puFlow && isFinite(puFlow) && puFlow > 0) {
        const delta = (isVenda ? -1 : +1) * (vt / puFlow);
        u += delta;
      }
    }
    return u;
  };

    // ⚠️ Para TESOURO: primeira data do mês em que a posição cruza 0→>0
  // Usa os FLUXOS (±valor_total/PU_do_dia) e NÃO a coluna quantidade.
  const primeiraDataComPosicaoNoMesPorFluxoTD = (ativo, ops, y, m) => {
    const ini = monthStartISO(y, m);
    const fim = monthEndISO(y, m);
    const basePrev = eomPrev(y, m); // EOM-1 (mês anterior)
    let u = unidadesAtePorFluxo(ativo, ops, basePrev);
    if (u > 0) return null; // já havia posição ao abrir o mês
    for (const o of ops) {
      if (o.data < ini || o.data > fim) continue;
      const tipo = String(o.tipo || '');
      const isVenda  = /vend|sell|resgat|saida|saída|leilao|leilão/i.test(tipo);
      const isCompra = /compra|buy|aplic/i.test(tipo);
      const vt = Math.abs(Number(o.valor_total || 0));
      if (!(vt > 0)) continue;
      const puFlow = getPuOnOrNear(ativo, o.data, { preferCompra: isCompra });
      if (!puFlow || !isFinite(puFlow) || puFlow <= 0) continue;
      const delta = (isVenda ? -1 : +1) * (vt / puFlow);
      u += delta;
      if (u > 0) return o.data; // nasceu aqui
    }
    return null;
  };

  // -------------------------------------------------------------
  // 3) Quantidade no EOM-1 por ativo (para peso Vprev)
  // -------------------------------------------------------------
  const qtdAte = (ops, dataISO) => {
    let q = 0;
    for (const o of ops) {
      if (o.data > dataISO) break;
      const tipo = o.tipo;
      const qabs = Math.abs(o.quantidade || 0);
      const isCompra = /compra|buy|aplic/i.test(tipo);
      const isVenda  = /vend|sell|resgat|saida|saída|leilao|leilão/i.test(tipo);
      const isBonus  = /bonific/i.test(tipo) && !/ajuste/i.test(tipo);
      if (isCompra) q += qabs;
      else if (isVenda) q -= qabs;
      else if (isBonus) q += qabs;
    }
    return q;
  };

  // -------------------------------------------------------------
  // 4) Fator de RF entre datas (independe de fluxo) para a rentabilidade
  // -------------------------------------------------------------
async function rfFatorEntre(di, df, cfg) {
  if (!cfg || !cfg.indexador) return null;
  const idx = cfg.indexador.toUpperCase();

  if (idx.includes('CDI')) {
    await ensureCDI(di, df, { authHeader: req.headers.authorization });
    const prod = await produtoCDIEntre(di, df);
    const p = Number(String(cfg.percentual_cdi ?? 100).toString().replace(',','.')) / 100;
    return Math.pow(prod, p || 1);
  }
  if (idx.includes('SELIC')) {
    await ensureSelic(di, df, { authHeader: req.headers.authorization });
    return await produtoSelicEntre(di, df);
  }
  if (idx.includes('PRE')) {
    const taxa = Number(String(cfg.taxa_anual || 0).toString().replace(',','.')) || 0;
    const base = Number(cfg.base_dias || 252);
    return fatorPRE(taxa, diasEntre(di, df), base);
  }
  if (idx.includes('IPCA')) {
    const rAA = Number(String(cfg.taxa_anual || 0).toString().replace(',','.')) || 0;
    return await fatorIPCAmais(rAA, di, df, { authHeader: req.headers.authorization });
  }
  return null;
}

  // -------------------------------------------------------------
  // 5) Loop mensal: calcula rentabilidade dos ativos e médias
  // -------------------------------------------------------------
  const dados = [];
  const totalGeral = {}; // {1..12: pct}
  const LOG = [];
  console.time('[rent-subclasse-ativo]');
  if (!DEBUG) console.log(`[rent-subclasse-ativo] ano=${ano} user=${usuarioId} ativos=${porAtivo.size} eq=${equities.length} puKeys=${puMap.size}`);
  else {
    // Amostra rápida p/ validar datas normalizadas
    const sample = Array.from(porAtivo.entries()).slice(0,3).map(([nome,info]) => ({
      ativo: nome,
      ops_head: (info.operacoes || []).slice(0,3)
    }));
    console.log('[rent-subclasse-ativo][sample_ops]', sample);
  }  

  for (let m = 1; m <= mesLimite; m++) {
    const di = eomPrev(ano, m);   // último dia útil do mês anterior
    const df = eom(ano, m);       // último dia útil do mês atual
    const iniMes = monthStartISO(ano, m);
    const fimMes = monthEndISO(ano, m);    

    // Pesos e fatores por ativo
    const pesos = new Map();  // ativo -> Vprev (em BRL)
    const fatores = new Map(); // ativo -> fator do mês (1+retorno)

    for (const [ativo, info] of porAtivo) {
      const sub = info.subclasse || 'Outros';
      const ops = info.operacoes.sort((a,b) => a.data.localeCompare(b.data));
      const tkr = toYahoo(ativo);
      const isT = isTesouro(ativo) || /tesouro/i.test(sub);
      const isRF = !isT && (info.cfgRF && info.cfgRF.indexador) || (!tkr && isProvavelRF(ativo, sub));

      // Vprev (peso)
      let Vprev = 0;    // valor da posição na "base" do mês
      let F = null;     // fator do mês (1+r)
      let baseISO = di; // por padrão, EOM-1

      // identifica se a posição NASCEU no mês
      // • TD: usa FLUXO (±valor_total/PU) — evita atrasos/ruídos da coluna quantidade
      // • outros: mantém lógica original pela quantidade
      let bornISO = null;
      if (isTesouro(ativo) || /tesouro/i.test(sub)) {
        bornISO = primeiraDataComPosicaoNoMesPorFluxoTD(ativo, ops, ano, m);
      } else {
        bornISO = primeiraDataComPosicaoNoMes(ops, ano, m);
      }
      if (bornISO) baseISO = bornISO;

      if (tkr && !isT && !isRF) {
        // Renda variável via Yahoo (em BRL; USD já convertido acima)
        const mp = priceSeries.get(ativo);
        // preço base: se nasceu no mês, pega >= baseISO; senão <= di
        const px0 = (baseISO > di) ? firstOnOrAfter(mp, baseISO) : lastPxOnOrBefore(mp, di);
        const px1 = lastPxOnOrBefore(mp, df);
        // quantidade: se nasceu no mês, considera posição APÓS os fluxos do dia base
        const q0 = (baseISO > di) ? qtdAteInclusivo(ops, baseISO) : qtdAte(ops, di);
        if (q0 > 0 && px0 != null && px1 != null) {
          Vprev = q0 * px0;
          F = px1 / px0;
        }
      } else if (isT) {
        // Tesouro Direto — TWR mensal com âncora correta:
        // 1) Peso (Vprev) = unidades até a BASE * PU_anchor
        //    - Se nasceu no mês ⇒ PU_anchor = PU_COMPRA do dia de entrada (nosso preço)
        //    - Senão           ⇒ PU_anchor = PU base no EOM-1 (marcação)
        // 2) Fator (F) = PU_fim / PU_anchor  (neutro a fluxos intra-mês)
        const bornInMonth = !!bornISO; // agora é verdade apenas se nasceu no mês (0→>0)
        // Quantidade derivada por FLUXO até a data-base
        const q0 = unidadesAtePorFluxo(ativo, ops, baseISO);
        // PU âncora (compra no 1º mês; base no EOM-1 nos demais)
        const pu0 = bornInMonth
          ? getPuOnOrNear(ativo, baseISO, { preferCompra: true })   // preço pago
          : getPuOnOrNear(ativo, di,      { preferCompra: false }); // marcação do EOM-1
        // PU no fim do mês (sempre PU base)
        const pu1 = getPuOnOrNear(ativo, df, { preferCompra: false });
        if ((q0 > 0) && (pu0 != null) && (pu1 != null)) {
          Vprev = q0 * pu0;
          F = pu1 / pu0;
          // 🔊 LOGS SEMPRE LIGADOS PARA TD (independem de ?debug)
          try {
            console.log('[SUBC][TD]', {
              mes: m, ativo, subclasse: sub,
              anchor: bornInMonth ? 'PU_COMPRA' : 'PU_BASE',
              bornISO, di, baseISO, df,
              q0: Number(q0.toFixed(6)),
              pu0, pu1,
              rent_pct: Number(((F - 1) * 100).toFixed(4))
            });
          } catch {}
        } else if (DEBUG) {
          LOG.push({
            mes: m, ativo, subclasse: sub, motivo: 'td_sem_anchor_ou_qtd',
            bornISO, di, baseISO, df, q0, pu0, pu1
          });
        }
      } else if (isRF) {
        // RF: fator entre di..df a partir do cadastro (sem olhar fluxo)
        const f = await rfFatorEntre(baseISO, df, info.cfgRF);
        if (f != null) {
          // Peso = "caixa" acumulado até a BASE do mês
          let caixa = 0;
          for (const o of ops) {
            if (o.data > baseISO) break;
            const tipo = o.tipo;
            const vt = Number(o.valor_total || 0);
            const isAplica = /compra|buy|aplic/i.test(tipo);
            const isResg   = /vend|sell|resgat|saida|saída|leilao|leilão/i.test(tipo);
            if (isAplica) caixa += vt;
            else if (isResg) caixa -= vt;
          }
          Vprev = Math.max(0, caixa);
          F = f;
        }
      }

      if (Vprev > 0 && F != null && isFinite(F)) {
        pesos.set(ativo, Vprev);
        fatores.set(ativo, F);
        // Linha do ativo
        dados.push({
          tipo: 'ativo',
          subclasse: sub,
          ativo,
          mes: m,
          rentabilidade_pct: (F - 1) * 100
        });
      } else if (DEBUG) {
        LOG.push({
          mes: m, ativo, subclasse: sub,
          baseISO, motivo: 'sem_base_ou_preco',
          Vprev, F
        });        
      }
    }

    // Média ponderada por subclasse
    const porSub = new Map(); // sub -> {num, den}
    for (const [ativo, Vprev] of pesos) {
      const sub = (porAtivo.get(ativo)?.subclasse) || 'Outros';
      const F = fatores.get(ativo);
      if (!porSub.has(sub)) porSub.set(sub, { num: 0, den: 0 });
      const acc = porSub.get(sub);
      acc.num += Vprev * (F - 1);
      acc.den += Vprev;
    }
    for (const [sub, { num, den }] of porSub) {
      if (den > 0) {
        dados.push({
          tipo: 'subclasse',
          subclasse: sub,
          mes: m,
          rentabilidade_pct: (num / den) * 100
        });
      }
    }

    // Total geral (toda a carteira)
    const denTG = Array.from(pesos.values()).reduce((a,b)=>a+b,0);
    const numTG = Array.from(pesos.entries()).reduce((acc,[ativo,V]) => {
      const F = fatores.get(ativo);
      return acc + V * (F - 1);
    }, 0);
    totalGeral[m] = (denTG > 0) ? (numTG / denTG) * 100 : null;

    if (!DEBUG) {
      console.log(`[rent-subclasse-ativo][${ano}-${pad2(m)}] ativos=${pesos.size} subcls=${porSub.size} totalGeral=${totalGeral[m] ?? 'null'}`);
    } else {
      LOG.push({ _mesResumo: { mes: m, ativos: pesos.size, subcls: porSub.size, totalGeral: totalGeral[m] } });
    }
  }

  console.timeEnd('[rent-subclasse-ativo]');
  return res.json(DEBUG ? { dados, totalGeral, debug: LOG } : { dados, totalGeral });
});

// 📊 Rota: Rentabilidade Hierárquica por Classe > Subclasse > Ativo (usada pela TabelaRentabilidadeHierarquica)
router.get('/rentabilidade-hierarquica', auth, async (req, res) => {
  const usuario_id = req.user.id;

  try {
    // garante índices antes de processar (throttle 10min)
    await doBootIndices(req, usuario_id).catch(e => console.warn('[boot on-demand][hierarquica]', e?.message || e));
    // 1) Traga investido (BRL) e quantidade total por ativo
    const base = (await db.query(`
      WITH quantidades_finais AS (
        SELECT
          i.nome_investimento,
          SUM(
            CASE
              WHEN LOWER(i.tipo_operacao) ~ '(vend|sell|resgat|saida|saída|leilao|leilão)'
                THEN -ABS(i.quantidade)
              WHEN LOWER(i.tipo_operacao) LIKE '%ajuste_bonificacao%'
                OR (LOWER(i.tipo_operacao) LIKE '%ajuste%' AND LOWER(i.tipo_operacao) LIKE '%bonific%')
                THEN 0
              ELSE ABS(i.quantidade)
            END
          ) AS quantidade_total
        FROM investimentos i
        WHERE i.usuario_id = $1
        GROUP BY i.nome_investimento
      ),
      investimentos_com_valor AS (
        SELECT
          i.nome_investimento,
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
        WHERE i.usuario_id = $1
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
    `, [usuario_id])).rows || [];

    // 2) Mapa por ativo
    const porAtivo = new Map();
    for (const r of base) {
      porAtivo.set(r.ativo, {
        classe: r.classe || 'Outros',
        subclasse: r.subclasse || 'Outros',
        investido: Number(r.investido) || 0,
        qtd: Number(r.quantidade) || 0,
      });
    }

    // 3) Preços de mercado (Yahoo)
    const equities = [];
    for (const [nome] of porAtivo.entries()) {
      const yf = toYahoo(nome);
      if (yf) equities.push({ nome, yf });
    }
    const nomeToYf = new Map(equities.map(e => [e.nome, e.yf]));
    const today = new Date();
    const endISO = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0,10);
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - 30);
    const startISO = start.toISOString().slice(0,10);
    const yahooFinance = (await import('yahoo-finance2')).default;

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

    const priceSeries = await buildPriceSeriesFor(equities, startISO, endISO, 15, 'close');

    let fxSpot = null;
    try {
      const qfx = await yahooFinance.quote('USDBRL=X');
      fxSpot = qfx?.regularMarketPrice ?? qfx?.postMarketPrice ?? qfx?.preMarketPrice ?? null;
    } catch {}
    if (fxSpot == null) {
      try {
        const end = new Date();
        const s = new Date(); s.setUTCDate(s.getUTCDate() - 10);
        const fxHist = await yahooFinance.historical('USDBRL=X', {
          period1: s.toISOString().slice(0,10),
          period2: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())).toISOString().slice(0,10),
          interval: '1d'
        });
        const last = (fxHist || []).filter(r => (r.adjClose ?? r.close)).pop();
        fxSpot = last ? Number(last.adjClose ?? last.close) : null;
      } catch {}
    }

    // 4) Fallback: último valor em valores_atuais
    const fallbackRows = (await db.query(`
      SELECT va.nome_investimento, va.preco_unitario, va.valor_total
      FROM valores_atuais va
      JOIN (
        SELECT nome_investimento, MAX((data_referencia)::date) AS data_max
        FROM valores_atuais
        WHERE usuario_id = $1
        GROUP BY nome_investimento
      ) uv ON uv.nome_investimento = va.nome_investimento
         AND (va.data_referencia)::date = uv.data_max
      WHERE va.usuario_id = $1
    `, [usuario_id])).rows || [];
    const fb = new Map(fallbackRows.map(r => [r.nome_investimento, r]));

    // 5) Estrutura de saída
    const estrutura = {};
    for (const [nome, a] of porAtivo.entries()) {
          // --- TESOURO (marcação a mercado por PU) ---
    const isTesouroBySub = String(a.subclasse||'').toLowerCase().includes('tesouro');
    const isTesouroByNome= /^TESOURO\s/.test(String(nome||'').toUpperCase());
    if (isTesouroBySub || isTesouroByNome) {
      try {
        const hojeISO = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
                        .toISOString().slice(0,10);
        const titulo = normTituloTesouro(nome);
        const titulo1 = titulo;
        const titulo2 = titulo.replace(/\s+/g,' ').replace(/\+/g,' + ').replace(/\s+/g,' ').trim();   // ex.: 'Renda+ 2065' ~ 'Renda + 2065'
        const titulo3 = titulo.replace(/\+/g,'Mais'); 
      // NORMALIZA o nome do ativo (ignora case e hífens) — igual ao /inspector
        const flowsRows = (await db.query(
          `SELECT (data_operacao)::date::text AS data, valor_total, LOWER(tipo_operacao) AS tipo
             FROM investimentos
            WHERE usuario_id=$1
              AND UPPER(TRANSLATE(REPLACE(REPLACE(TRIM(nome_investimento),'-',''),' ',''), 
                    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 
                    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) =
                  UPPER(TRANSLATE(REPLACE(REPLACE(TRIM($2),'-',''),' ',''), 
                    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 
                    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
            ORDER BY (data_operacao)::date ASC`,
          [usuario_id, nome]
        )).rows || [];
        // Garante série de PU e lê DIRETO DO BANCO (robusto)
        // garante PU desde ~45 dias antes do 1º fluxo
        const iniPU = addDaysISO(flowsRows[0]?.data || hojeISO, -45);
        await ensureTesouroPU(titulo, iniPU, hojeISO, { authHeader: req.headers.authorization });
        const tituloSemExtra = normTituloTesouro(nome); // já vem sem o sufixo e com 1 espaço
        const like1 = `%${titulo1}%`;
        const like2 = `%${tituloSemExtra}%`;
        const like3 = `%${titulo2}%`;
        const like4 = `%${titulo3}%`;
        const puRows = (await db.query(
          `SELECT (data)::date AS data, pu, pu_compra, nome
             FROM indices_tesouro_pu
            WHERE ( (nome = $1) OR (nome = $2) OR (nome ILIKE $3) OR (nome ILIKE $4) OR (nome ILIKE $5) OR (nome ILIKE $6) )
              AND (data)::date <= $7::date
            ORDER BY (data)::date ASC`,
          [titulo1, tituloSemExtra, like1, like2, like3, like4, hojeISO]
        )).rows || [];
        const puEnd = puRows.length ? Number(puRows[puRows.length-1].pu) : null;
        // Helpers para buscar PU (base ou compra) próximos à data
        const getPuOnOrNear = (iso, { useCompra = false } = {}) => {
          const field = useCompra ? 'pu_compra' : 'pu';
          // 1) tenta exatamente no dia
          const ex = puRows.find(r => String(r.data) === iso);
          if (ex) {
            const v = Number(ex[field]);
            if (isFinite(v) && v > 0) return v;
          }
          // 2) onOrBefore
          let val = null;
          for (const r of puRows) {
            const d = String(r.data);
            if (d <= iso) val = Number(r[field]);
            else break;
          }
          if (val != null && isFinite(val) && val > 0) return val;
          // 3) onOrAfter
          for (const r of puRows) {
            const d = String(r.data);
            if (d >= iso) {
              const v = Number(r[field]);
              if (isFinite(v) && v > 0) return v;
              break;
            }
          }
          return null;
        };
        let units = 0;
        for (const f of flowsRows) {
          const tipo = String(f.tipo||'');
          const isVenda  = /vend|sell|resgat|saida|saída|leilao|leilão/i.test(tipo);
          const isCompra = /compra|buy|aplic/i.test(tipo);
          const sinal = isVenda ? -1 : +1;
          const vtAbs = Math.abs(Number(f.valor_total)||0);
          if (vtAbs === 0) continue;
          // ⚠️ Regra: COMPRA usa PU_COMPRA do próprio dia (ou vizinho); demais usam PU (base)
          const puFlow = getPuOnOrNear(String(f.data), { useCompra: isCompra });
          if (puFlow && isFinite(puFlow) && puFlow > 0) {
            const deltaUnits = (sinal * vtAbs) / puFlow;
            units += deltaUnits;
          } else {
          }
        }
        const atualTD = (puEnd && isFinite(puEnd)) ? Number((units * puEnd).toFixed(2)) : 0;

        if (!estrutura[a.classe]) estrutura[a.classe] = { nome: a.classe, investido: 0, atual: 0, subclasses: {} };
        if (!estrutura[a.classe].subclasses[a.subclasse]) {
          estrutura[a.classe].subclasses[a.subclasse] = { nome: a.subclasse, investido: 0, atual: 0, ativos: [] };
        }
        estrutura[a.classe].subclasses[a.subclasse].ativos.push({
          nome, investido: a.investido, atual: atualTD,
          rentabilidade: a.investido > 0 ? ((atualTD - a.investido) / a.investido) * 100 : null
        });
        estrutura[a.classe].subclasses[a.subclasse].investido += a.investido;
        estrutura[a.classe].subclasses[a.subclasse].atual     += atualTD;
        estrutura[a.classe].investido += a.investido;
        estrutura[a.classe].atual     += atualTD;
        continue; // já tratamos Tesouro — pula para o próximo ativo
      } catch (e) {
        console.warn('[hierarquica][TD] falha PU para', nome, e?.message || e);
        // cai para RF/Não-RF abaixo (melhor que zerar)
      }
    }

      // Busca a ÚLTIMA config de RF para o ativo, normalizando o nome
      const cfgRow = (await db.query(
        `SELECT indexador, taxa_anual, percentual_cdi, base_dias,
                subcategoria, nome_investimento, come_cotas, aliquota_comecotas, vencimento
           FROM investimentos
          WHERE usuario_id=$1
            AND UPPER(TRANSLATE(REPLACE(REPLACE(TRIM(nome_investimento),'-',''),' ',''), 
                  'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 
                  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) =
                UPPER(TRANSLATE(REPLACE(REPLACE(TRIM($2),'-',''),' ',''), 
                  'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 
                  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
            AND COALESCE(indexador,'') <> ''
          ORDER BY id DESC LIMIT 1`,
        [usuario_id, nome]
      )).rows?.[0] || null;

      if (cfgRow && cfgRow.indexador) {
        const flowsRows = (await db.query(
          `SELECT (data_operacao)::date AS data, valor_total, LOWER(tipo_operacao) AS tipo
             FROM investimentos
            WHERE usuario_id=$1
              AND UPPER(TRANSLATE(REPLACE(REPLACE(TRIM(nome_investimento),'-',''),' ',''), 
                    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 
                    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) =
                  UPPER(TRANSLATE(REPLACE(REPLACE(TRIM($2),'-',''),' ',''), 
                    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 
                    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))`,
          [usuario_id, nome]
        )).rows || [];
        const toISO = (v) => {
          if (!v) return null;
          if (v instanceof Date) return iso(v);
          const s = String(v);
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // já está em ISO
          const d = new Date(s);
          if (!isNaN(d)) return iso(d);                // converte "Fri Sep ..." -> ISO
          return s.slice(0,10);                        // fallback
        };
        const arr = flowsRows.map(f => ({
          data: toISO(f.data),
          valor_total: Number(f.valor_total) || 0,
          sinal: /vend|sell|resgat|saida|saída|leilao|leilão/.test(String(f.tipo||'')) ? -1 : +1
        }));
        // data de avaliação (hoje, em UTC)
        const hojeISO = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
                          .toISOString().slice(0,10);                       
        // RF (não-Tesouro): calcular pelo modelo (cadastro), sem override de valores_atuais
        let atualRF = 0;
        try {
          // ordem correta: (cfg, flows, alvoISO, overrideManual, ctx)
          atualRF = await valorRFnaData(
            { ...cfgRow, subcategoria: a.subclasse, nome_investimento: nome },
            arr,
            hojeISO,
            null
          );
        } catch (e) {
          console.warn('[hierarquica][RF] falha no cálculo para', nome, e?.message || e);
          // fallback conservador: não derruba a rota
          atualRF = Number(a.investido) || 0;
        }
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
        continue;
      }

      let price = null;
      if (quotesMap.has(nome)) {
        price = quotesMap.get(nome);
      }
      if (price == null) {
        const ps = priceSeries.get(nome);
        if (ps && ps.size) {
          const lastPrice = Array.from(ps.values()).at(-1);
          if (isFinite(lastPrice)) price = Number(lastPrice);
        }
      }
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
            price = Number(row.valor_total) / a.qtd;
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

    // 🔎 Filtro de alocação: não expor itens zerados na distribuição
    const resposta = Object.values(estrutura)
      .map(cl => {
        // só mantemos subclasses que tenham algum ativo com valor atual > 0
        const subclassesRaw = Object.values(cl.subclasses)
          .filter(sub => (sub.ativos?.some(a => (Number(a.atual) || 0) > 0)));

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
        })
        // garante que nenhuma subclasse com atual <= 0 passe adiante
        .filter(sub => (Number(sub.atual) || 0) > 0);

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
        // só devolve a classe se houver alguma subclasse com valor atual > 0
        return (subclasses.length && (atual > 0)) ? {
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
router.get('/rentabilidade-diaria', auth, async (req, res) => {
  try {
    const data = await gerarSerieDiaria(req.user.id, { ...req.query, authHeader: req.headers.authorization });
    return res.json(data);
  } catch (err) {
    console.error('❌ Erro /rentabilidade-diaria:', err);
    return res.json([]);
  }
});

// Helpers
const norm = (s) => String(s || '').toUpperCase().replace(/-/g, '');
const sanitizeB3 = s => String(s||'').normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]/g, '');

// GET /investimentos/inspector?ativo=XPML11
// GET /investimentos/inspector?ativo=XPML11
router.get('/inspector', async (req, res) => {
  const usuario_id = req.user.id;
  const ativoRaw = String(req.query.ativo || '').trim();
  if (!ativoRaw) return res.status(400).json({ erro: 'Parâmetro "ativo" obrigatório' });

  // helper local pra ISO YYYY-MM-DD
  const toISO = (v) => {
    if (!v) return null;
    if (v instanceof Date) return iso(v);
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d) ? s.slice(0, 10) : iso(d);
  };

  try {
    // 🔎 Operações + classe/subclasse por JOIN (não usa mais as colunas "categoria"/"subcategoria" da tabela investimentos)
    const oper = (await db.query(
      `SELECT 
         i.nome_investimento,
         (i.data_operacao)::date       AS data_operacao,
         LOWER(i.tipo_operacao)        AS tipo_operacao,
         COALESCE(i.quantidade,0)      AS quantidade,
         COALESCE(i.valor_unitario,0)  AS valor_unitario,
         COALESCE(i.valor_total,0)     AS valor_total,
         COALESCE(ic.nome,'Outros')    AS classe,
         COALESCE(isc.nome,'Outros')   AS subclasse
       FROM investimentos i
       LEFT JOIN investimento_classes ic
         ON ic.id = i.classe_id
        AND (ic.usuario_id = i.usuario_id OR ic.usuario_id IS NULL)
       LEFT JOIN investimento_subclasses isc
         ON isc.id = i.subclasse_id
        AND (isc.usuario_id = i.usuario_id OR isc.usuario_id IS NULL)
      WHERE i.usuario_id = $1
        AND UPPER(REPLACE(TRIM(i.nome_investimento),'-','')) = UPPER(REPLACE($2,'-',''))
      ORDER BY (i.data_operacao)::date ASC`,
      [usuario_id, ativoRaw]
    )).rows || [];

    if (!oper.length) {
      return res.status(404).json({ erro: 'Ativo não encontrado para o usuário' });
    }

    // 📌 Metadados de RF/Tesouro: pega o último cadastro com indexador preenchido
    const cfgRow = (await db.query(
      `SELECT indexador, taxa_anual, percentual_cdi, base_dias, come_cotas, aliquota_comecotas, vencimento,
              subcategoria, nome_investimento
         FROM investimentos
        WHERE usuario_id = $1
          AND UPPER(REPLACE(TRIM(nome_investimento),'-','')) = UPPER(REPLACE($2,'-',''))
        ORDER BY
          CASE WHEN COALESCE(indexador,'') <> '' THEN 0 ELSE 1 END,
          id DESC
        LIMIT 1`,
      [usuario_id, ativoRaw]
    )).rows?.[0] || null;

    const classe = oper[0].classe;
    const subclasse = oper[0].subclasse;
    const nomeUp = ativoRaw.toUpperCase();
    const isTesouro = /tesouro/i.test(subclasse) || nomeUp.startsWith('TESOURO ');
    const hasIndexador = !!(cfgRow && String(cfgRow.indexador || '').trim());
    const ehRF = isTesouro || hasIndexador;

    // 🧾 Agrega quantidade / custo para RV (útil para preço médio)
    let qtd = 0;
    let custo = 0;
    for (const o of oper) {
      const q = Math.abs(Number(o.quantidade || 0));
      const vt = Number(o.valor_total || 0);
      const tipo = String(o.tipo_operacao || '').toLowerCase().normalize('NFKD');
      const isAjuste = tipo.includes('ajuste') && tipo.includes('bonific');
      const isBonus  = tipo.includes('bonific') && !isAjuste;
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
      } else if (isBonus) {
        qtd += q;
      }
    }
    const precoMedio = qtd > 0 ? (custo / qtd) : 0;

    // 💸 Valor aplicado por fluxos (compra/aplic + ; venda/resgate -)
    let valorAplicado = 0;
    for (const o of oper) {
      const vt = Number(o.valor_total || 0);
      const tipo = String(o.tipo_operacao || '').toLowerCase().normalize('NFKD');
      const isCompra = tipo.includes('compra') || tipo.includes('buy') || tipo.includes('aplic');
      const isVenda  = tipo.includes('vend') || tipo.includes('sell') || tipo.includes('resgat')
                    || tipo.includes('saida') || tipo.includes('saída')
                    || tipo.includes('leilao') || tipo.includes('leilão');
      if (isCompra) valorAplicado += vt;
      else if (isVenda) valorAplicado -= vt;
    }
    valorAplicado = valorAplicado > 0 ? Number(valorAplicado.toFixed(2)) : 0;

    // ➕ Série de fluxos para helpers (RF/TD)
    const flows = oper.map(o => ({
      data: toISO(o.data_operacao),
      valor_total: Number(o.valor_total) || 0,
      tipo: String(o.tipo_operacao || '').toLowerCase()
    }));

    const hojeISO = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))
                      .toISOString().slice(0,10);

    let tipo = 'rv';
    let ultimaCotacao = null;
    let saldoBruto = 0;
    let rentSobrePM = null;

    if (ehRF) {
      // 🧮 RF/TD: usa o helper unificado -> valor no "hojeISO"
      const cfg = {
        ...(cfgRow || {}),
        subcategoria: subclasse,             // ajuda a detectar Tesouro
        nome_investimento: ativoRaw
      };
      try {
        saldoBruto = await valorRFnaData(cfg, flows, hojeISO, null, { authHeader: req.headers.authorization });
      } catch (e) {
        // fallback conservador
        saldoBruto = valorAplicado;
      }
      tipo = isTesouro ? 'td' : 'rf';
      ultimaCotacao = null;        // não faz sentido exibir "cotação" para RF
      rentSobrePM = null;          // idem "Rentabilidade sobre PM" para RF
    } else {
      // 📈 RV: usa Yahoo (mantém a lógica que já funcionava)
      const yfTicker = toYahoo(ativoRaw);
      if (yfTicker) {
        const yahooFinance = (await import('yahoo-finance2')).default;
        try {
          const q = await yahooFinance.quote(yfTicker);
          const p = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice;
          if (p != null && isFinite(p)) ultimaCotacao = Number(p);
        } catch (_) { /* tenta histórico abaixo se necessário */ }
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
      saldoBruto = (qtd > 0 && ultimaCotacao != null) ? qtd * ultimaCotacao : 0;
      rentSobrePM = (precoMedio > 0 && ultimaCotacao != null)
        ? ((ultimaCotacao / precoMedio) - 1) * 100
        : null;
    }

    const resultado = saldoBruto - valorAplicado;

    // 📤 resposta unificada + metadados RF para o front decidir o layout
    return res.json({
      ativo: ativoRaw,
      classe, subclasse,
      tipo,                             // 'rv' | 'rf' | 'td'
      quantidade: Number(qtd.toFixed(6)),
      preco_medio: Number(precoMedio.toFixed(6)),
      ultima_cotacao: (ultimaCotacao != null ? Number(ultimaCotacao.toFixed(6)) : null),
      valor_aplicado: Number(valorAplicado.toFixed(2)),
      saldo_bruto: Number(saldoBruto.toFixed(2)),
      resultado: Number(resultado.toFixed(2)),
      rent_sobre_preco_medio: (rentSobrePM != null ? Number(rentSobrePM.toFixed(4)) : null),
      rf: (ehRF ? {
        indexador: cfgRow?.indexador ?? null,
        taxa_anual: (cfgRow?.taxa_anual != null ? Number(cfgRow.taxa_anual) : null),
        percentual_cdi: (cfgRow?.percentual_cdi != null ? Number(cfgRow.percentual_cdi) : null),
        base_dias: (cfgRow?.base_dias || null),
        come_cotas: !!cfgRow?.come_cotas,
        aliquota_comecotas: (cfgRow?.aliquota_comecotas != null ? Number(cfgRow.aliquota_comecotas) : null),
        vencimento: (cfgRow?.vencimento ? toISO(cfgRow.vencimento) : null)
      } : null)
    });
  } catch (err) {
    console.error('Erro /investimentos/inspector:', err);
    res.status(500).json({ erro: 'Erro ao calcular posição do ativo' });
  }
});

module.exports = router;