// backend/routes/patrimonioMoedaRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../database/db');

router.use(auth);

const PAR = 'USDBRL';
const YF_SYMBOL = 'USDBRL=X';

function endOfMonthUTC(y, m) {
  // m é 1..12
  return new Date(Date.UTC(Number(y), Number(m), 0));
}

function isoUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0,10);
}

// lê do cache
function getCacheAno(ano) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT mes, close, data_ref FROM fx_cotacoes_mensais WHERE par=? AND ano=?`,
      [PAR, ano],
      (err, rows) => err ? reject(err) : resolve(rows || [])
    );
  });
}

// grava/atualiza mês no cache
function upsertMes(ano, mes, close, data_ref) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO fx_cotacoes_mensais (par, ano, mes, close, data_ref)
         VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(par, ano, mes) DO UPDATE SET close=excluded.close, data_ref=excluded.data_ref`,
      [PAR, ano, mes, close, data_ref],
      (err) => err ? reject(err) : resolve()
    );
  });
}

router.get('/usd-mensal', async (req, res) => {
  try {
    const { ano } = req.query;
    const y = Number(ano || new Date().getFullYear());

    // 1) Lê o cache existente
    const cached = await getCacheAno(y);
    const tem = new Map(cached.map(r => [Number(r.mes), { close: Number(r.close), data_ref: r.data_ref }]));

    // 2) Identifica meses faltantes
    const faltantes = [];
    const limiteMes = (y === new Date().getUTCFullYear()) ? (new Date().getUTCMonth()+1) : 12;
    for (let m = 1; m <= limiteMes; m++) {
      if (!tem.has(m)) faltantes.push(m);
    }

    // 3) Se faltar, busca do Yahoo de uma vez e preenche
    if (faltantes.length) {
      const yahooFinance = (await import('yahoo-finance2')).default;
      const period1 = new Date(Date.UTC(y, 0, 1)).toISOString().slice(0,10);
      const period2 = endOfMonthUTC(y, 12).toISOString().slice(0,10);
      const hist = await yahooFinance.historical(YF_SYMBOL, { period1, period2, interval: '1d' });

      // último pregão de cada mês do ano
      const bestByMonth = {};
      (hist || []).forEach(r => {
        const d = new Date(r.date);
        const iso = isoUTC(d);
        const [yy, mm] = iso.split('-').map(Number);
        if (yy !== y) return;
        const ym = `${yy}-${String(mm).padStart(2,'0')}`;
        const close = (r.close ?? r.adjClose);
        if (close == null) return;
        if (!bestByMonth[ym] || iso > bestByMonth[ym].dateISO) {
          bestByMonth[ym] = { dateISO: iso, close: Number(close) };
        }
      });

      for (const m of faltantes) {
        const ym = `${y}-${String(m).padStart(2,'0')}`;
        const obj = bestByMonth[ym];
        if (obj && Number.isFinite(obj.close)) {
          await upsertMes(y, m, obj.close, obj.dateISO);
          tem.set(m, { close: obj.close, data_ref: obj.dateISO });
        }
      }
    }

    // 4) Monta resposta uniforme 1..12 (mesmo ano corrente)
    const porMes = {};
    for (let m = 1; m <= 12; m++) {
      porMes[m] = tem.get(m)?.close ?? null;
    }
    res.json({ ano: y, usd_brl_por_mes: porMes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Falha ao obter cotações USD/BRL' });
  }
});

module.exports = router;