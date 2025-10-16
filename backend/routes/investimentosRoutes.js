const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('../Controllers/investimentosController');

router.use(auth);

router.post('/', controller.criarInvestimento);
router.get('/', controller.listarInvestimentos);
router.get('/todos', controller.listarTodosInvestimentos);
// ⚠️ Hotfix: evitar erro "No data found" do Yahoo para ativos sem ticker (ex.: RF/Tesouro).
// As rotas de resumo/rentabilidade/posição já calculam preços on-demand.
router.get('/atualizar-cotacoes', async (req, res) => {
  res.json({ ok: true, message: 'Atualização de cotações ignorada (on-demand nas rotas de análise).' });
});
router.put('/:id', controller.editarInvestimento);
router.delete('/:id', controller.deletarInvestimento);
router.get('/ticker-map', controller.getTickerMap);

// ✅ Valida ticker no Yahoo: aceita B3 (PETR4 -> PETR4.SA) e EUA (AAPL, VOO, etc.)
router.get('/validar-ticker', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol || !String(symbol).trim()) {
      return res.status(400).json({ ok: false, error: 'Informe ?symbol=' });
    }
    const raw = String(symbol).trim().toUpperCase();

    // B3: 4 letras + 1-2 dígitos => .SA
    const isB3 = /^[A-Z]{4}\d{1,2}$/.test(raw);
    const yf = isB3 ? `${raw}.SA` : raw;

    const yahooFinance = (await import('yahoo-finance2')).default;
    const q = await yahooFinance.quote(yf);
    const price = q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice ?? null;

    if (!q || price == null) {
      return res.status(404).json({ ok: false, error: 'Ticker não encontrado ou sem preço' });
    }

    return res.json({
      ok: true,
      symbol: yf,
      currency: q.currency || null,
      shortName: q.shortName || q.longName || raw,
      price: (price != null ? Number(price) : null) // ← adiciona o preço (usaremos p/ USDBRL=X)
    });
  } catch (e) {
    return res.status(404).json({ ok: false, error: 'Ticker não encontrado' });
  }
});

module.exports = router;