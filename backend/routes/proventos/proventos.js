const express = require('express');
const router = express.Router();
const db = require('../../database/db');
const auth = require('../../middleware/auth');

// util: formata para 'YYYY-MM'
function ym(dateStr) {
  // espera 'YYYY-MM' ou 'YYYY-MM-DD'
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}$/.test(dateStr)) return dateStr;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : '';
}

// GET /investimentos/proventos/resumo  (Postgres)
router.get('/resumo', auth, async (req, res) => {
  try {
  const usuarioId = req.user.id; // mesmo padrão das outras rotas

    // filtros opcionais (placeholders alinhados com $1 = usuarioId)
    const { inicio, fim } = req.query || {};
    const paramsPeriodo = [usuarioId];
    const rangeClauses = [];
    if (inicio) { rangeClauses.push('(data::date) >= $' + (paramsPeriodo.length + 1)); paramsPeriodo.push(inicio); }
    if (fim)    { rangeClauses.push('(data::date) <= $' + (paramsPeriodo.length + 1)); paramsPeriodo.push(fim); }
    const whereRange = rangeClauses.length ? ' AND ' + rangeClauses.join(' AND ') : '';

    // Total "investido" (fluxo líquido aplicado): compra/aplic + ; venda/resg - .
    const qTotalInvestido = `
      SELECT COALESCE(SUM(
        CASE 
          WHEN LOWER(tipo_operacao) ~ '(compra|buy|aplic)' THEN valor_total
          WHEN LOWER(tipo_operacao) ~ '(vend|sell|resgat|saida|saída|leil)' THEN -valor_total
          ELSE 0
        END
      ), 0) AS total
      FROM investimentos
      WHERE usuario_id = $1
    `;
    const { rows: tRows } = await db.query(qTotalInvestido, [usuarioId]);
    const totalInvestido = Number(tRows?.[0]?.total || 0);

    // Renda acumulada no período
    const qRendaAcumulada = `
      SELECT COALESCE(SUM(valor_bruto), 0) AS renda
      FROM proventos
      WHERE usuario_id = $1
      ${whereRange}
    `;
    const { rows: rRows } = await db.query(qRendaAcumulada, paramsPeriodo);
    const rendaAcumulada = Number(rRows?.[0]?.renda || 0);

    // Média mensal (média dos meses com crédito)
    const qMedia = `
      SELECT AVG(mensal_total)::numeric AS media
      FROM (
        SELECT to_char((data::date),'YYYY-MM') AS ym, SUM(valor_bruto) AS mensal_total
        FROM proventos
        WHERE usuario_id = $1
        ${whereRange}
        GROUP BY ym
      ) t
    `;
    const { rows: mRows } = await db.query(qMedia, paramsPeriodo);
    const mediaMensal = Number(mRows?.[0]?.media || 0);

    const resultado = rendaAcumulada;
    const yieldOnCost = totalInvestido ? (rendaAcumulada / totalInvestido) * 100 : 0;

    return res.json({
      totalInvestido,
      rendaAcumulada,
      mediaMensal,
      resultado,
      yieldOnCost
    });
  } catch (err) {
    console.error('[/proventos/resumo] erro', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// GET /investimentos/proventos/historico
router.get('/historico', auth, async (req, res) => {
  try {
    const usuarioId = req.user.id;

    const { inicio, fim } = req.query || {};
    const clauses = ['usuario_id = $1'];
    const params = [usuarioId];
    if (inicio) { clauses.push('(data::date) >= $' + (params.length + 1)); params.push(inicio); }
    if (fim)    { clauses.push('(data::date) <= $' + (params.length + 1)); params.push(fim); }
    const where = 'WHERE ' + clauses.join(' AND ');

    const sql = `
      SELECT
        to_char((data::date),'YYYY-MM') AS ym,
        ticker,
        SUM(valor_bruto) AS total_ticker
      FROM proventos
      ${where}
      GROUP BY ym, ticker
      ORDER BY ym ASC
    `;
    const { rows } = await db.query(sql, params);

    const map = {};
    for (const r of (rows || [])) {
      const mes = ym(r.ym);
      if (!map[mes]) map[mes] = { mes, ativos: {}, total: 0 };
      map[mes].ativos[r.ticker] = Number(r.total_ticker || 0);
      map[mes].total += Number(r.total_ticker || 0);
    }
    const out = Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes));
    return res.json(out);
  } catch (err) {
    console.error('[/proventos/historico] erro', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// GET /investimentos/proventos/lista
router.get('/lista', auth, async (req, res) => {
  try {
    const usuarioId = req.user.id;

    let { inicio, fim, mes } = req.query || {};
    if (mes && (!inicio && !fim)) {
      mes = String(mes).slice(0, 7);
      const [y, m] = mes.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      inicio = `${y}-${String(m).padStart(2,'0')}-01`;
      fim    = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    }

    const clauses = ['usuario_id = $1'];
    const params = [usuarioId];
    if (inicio) { clauses.push('(data::date) >= $' + (params.length + 1)); params.push(inicio); }
    if (fim)    { clauses.push('(data::date) <= $' + (params.length + 1)); params.push(fim); }

    const sql = `
      SELECT id, ticker, nome_ativo, tipo, (data::date) AS data, quantidade, valor_bruto, imposto
      FROM proventos
      WHERE ${clauses.join(' AND ')}
      ORDER BY (data::date) ASC, valor_bruto DESC
    `;
    const { rows } = await db.query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error('[/proventos/lista] erro', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// GET /investimentos/proventos/distribuicao
router.get('/distribuicao', auth, async (req, res) => {
  try {
    const usuarioId = req.user.id;

    const { inicio, fim } = req.query || {};
    const clauses = ['usuario_id = $1'];
    const params = [usuarioId];
    if (inicio) { clauses.push('(data::date) >= $' + (params.length + 1)); params.push(inicio); }
    if (fim)    { clauses.push('(data::date) <= $' + (params.length + 1)); params.push(fim);   }

    const sql = `
      SELECT
        ticker,
        COALESCE(nome_ativo, '') AS nome_ativo,
        SUM(valor_bruto)        AS total
      FROM proventos
      WHERE ${clauses.join(' AND ')}
      GROUP BY ticker, nome_ativo
      HAVING SUM(valor_bruto) > 0
      ORDER BY total DESC
    `;
    const { rows } = await db.query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error('[/proventos/distribuicao] erro', err);
    res.status(500).json({ error: 'db_error' });
  }
});

module.exports = router;