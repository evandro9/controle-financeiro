const express = require('express');
const router = express.Router();

// GET /autocomplete/yahoo?q=PETR
router.get('/autocomplete/yahoo', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ ok: true, items: [] });
    // Yahoo Finance Search API pública
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return res.status(502).json({ ok: false, erro: 'Yahoo indisponível' });
    const j = await r.json();
    const items = (j?.quotes || []).map(x => ({
      symbol: x.symbol,
      name: x.shortname || x.longname || x.symbol,
      exch: x.exchDisp || x.exchange || '',
      type: x.typeDisp || x.quoteType || '',
      currency: x.currency || null
    }));
    res.json({ ok: true, items });
  } catch (e) {
    console.error('autocomplete/yahoo error:', e);
    res.status(500).json({ ok: false, erro: 'Falha no autocomplete Yahoo' });
  }
});

module.exports = router;