const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth');

// Util: extrai metadados de um nome TD (heurística)
function parseTDName(nome) {
  const n = String(nome || '');
  let indexador = null;
  if (/IPCA/i.test(n)) indexador = 'IPCA';
  else if (/SELIC/i.test(n)) indexador = 'SELIC';
  else if (/Prefixado|Pré/i.test(n)) indexador = 'PRE';
  else if (/Renda\+/i.test(n)) indexador = 'IPCA'; // Renda+ é IPCA com fluxo diferido
  const yearMatch = n.match(/20\d{2}/);
  const vencimento = yearMatch ? yearMatch[0] : null;
  return { indexador, vencimento, base_dias: 252, ir_regra: 'regressivo' };
}

// GET /catalogo/search?tipo=TD|RF_PRIVADA&q=ipca
router.get('/catalogo/search', autenticar, (req, res) => {
  const tipo = String(req.query.tipo || '').toUpperCase();
  const q = `%${String(req.query.q || '').trim()}%`;
  if (!tipo) return res.json({ ok: true, items: [] });
  db.all(
    `SELECT id, tipo, nome_display, codigo_externo, indexador, percentual_cdi, vencimento, base_dias, ir_regra
       FROM catalogo_ativos WHERE tipo=? AND nome_display LIKE ? ORDER BY nome_display ASC`,
    [tipo, q],
    (e, rows) => e ? res.status(500).json({ ok:false, erro:'Falha ao buscar catálogo' }) : res.json({ ok:true, items: rows || [] })
  );
});

// POST /catalogo/upsert  (permite cadastrar RF privada como template)
// body: { tipo: 'RF_PRIVADA', nome_display, indexador, percentual_cdi?, vencimento, base_dias, ir_regra }
router.post('/catalogo/upsert', autenticar, (req, res) => {
  const b = req.body || {};
  const tipo = String(b.tipo || '').toUpperCase();
  if (!tipo || !b.nome_display) return res.status(400).json({ ok:false, erro:'Dados insuficientes' });
  const now = new Date().toISOString();
  const { indexador, percentual_cdi, vencimento, base_dias, ir_regra } = b;
  db.run(
    `INSERT INTO catalogo_ativos (tipo, nome_display, codigo_externo, indexador, percentual_cdi, vencimento, base_dias, ir_regra, fonte, updated_at)
       VALUES (?,?,?,?,?,?,?,?, 'manual', ?)`,
    [tipo, b.nome_display, b.codigo_externo || null, indexador || null,
     (indexador==='CDI' ? Number(percentual_cdi)||null : null),
     vencimento || null, Number(base_dias)||252, ir_regra || null, now],
    function (e) {
      if (e) return res.status(500).json({ ok:false, erro:'Falha ao inserir catálogo' });
      res.json({ ok:true, id: this.lastID });
    }
  );
});

// POST /catalogo/sync/td  ? baixa a página pública e extrai nomes (metadata)
router.post('/catalogo/sync/td', autenticar, async (req, res) => {
  try {
    const now = new Date().toISOString();
    // Página pública com a tabela de títulos (sem depender de endpoint JSON de preços)
    const url = 'https://www.tesourodireto.com.br/titulos/precos-e-taxas.htm';
    let html = '';
    try {
      const r = await fetch(url, {
        headers: {
          // alguns servidores rejeitam “clients” sem UA/idioma
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        }
      });
      if (r.ok) {
        html = await r.text();
      }
    } catch (e) {
      // segue para fallback sem lançar
      console.warn('catalogo/sync/td: fetch falhou, usando fallback.', e?.message || e);
    }
    // Heurística simples: pega strings "Tesouro .... 20xx"
    const nomes = Array.from((html||'').matchAll(/Tesouro\s+[A-ZÀ-ú\+\s]+20\d{2}/g)).map(m => m[0].replace(/\s+/g,' ').trim());
    // inclui Renda+ (nem sempre aparece igual no HTML)
    if (!nomes.some(n=>/Renda\+/.test(n))) {
      const renda = Array.from(html.matchAll(/Renda\+\s*20\d{2}/gi)).map(m=>`Tesouro Renda+ ${m[0].match(/20\d{2}/)?.[0]||''}`.trim());
      nomes.push(...renda);
    }
    // fallback mínimo (evita catálogo vazio)
    const fallback = [
      'Tesouro Selic 2027', 'Tesouro Selic 2030',
      'Tesouro Prefixado 2029', 'Tesouro Prefixado 2033',
      'Tesouro IPCA+ 2035', 'Tesouro IPCA+ 2045',
      'Tesouro Renda+ 2055', 'Tesouro Renda+ 2065'
    ];
    const lista = (nomes && nomes.length ? nomes : fallback);
    // upsert no catálogo
    const up = db.prepare(`INSERT INTO catalogo_ativos
      (tipo, nome_display, codigo_externo, indexador, percentual_cdi, vencimento, base_dias, ir_regra, fonte, updated_at)
      VALUES ('TD', ?, NULL, ?, NULL, ?, 252, 'regressivo', ?, ?)
      ON CONFLICT(tipo, nome_display) DO UPDATE
         SET indexador=excluded.indexador,
             vencimento=excluded.vencimento,
             updated_at=excluded.updated_at,
             fonte=excluded.fonte`);
    for (const n of lista) {
      const meta = parseTDName(n);
      up.run([n, meta.indexador, meta.vencimento, (nomes.length?'td_site':'fallback'), now]);
    }
    up.finalize();
    res.json({ ok:true, itens: lista.length, fonte: (nomes && nomes.length ? 'td_site' : 'fallback') });
  } catch (e) {
    console.error('catalogo/sync/td error:', e);
    // mesmo no catch final, devolve fallback para não travar o fluxo
    try {
      const now = new Date().toISOString();
      const fallback = [
        'Tesouro Selic 2027', 'Tesouro Selic 2030',
        'Tesouro Prefixado 2029', 'Tesouro Prefixado 2033',
        'Tesouro IPCA+ 2035', 'Tesouro IPCA+ 2045',
        'Tesouro Renda+ 2055', 'Tesouro Renda+ 2065'
      ];
      const up = db.prepare(`INSERT INTO catalogo_ativos
        (tipo, nome_display, codigo_externo, indexador, percentual_cdi, vencimento, base_dias, ir_regra, fonte, updated_at)
        VALUES ('TD', ?, NULL, ?, NULL, ?, 252, 'regressivo', 'fallback', ?)
        ON CONFLICT(tipo, nome_display) DO UPDATE
           SET indexador=excluded.indexador,
               vencimento=excluded.vencimento,
               updated_at=excluded.updated_at,
               fonte=excluded.fonte`);
      for (const n of fallback) {
        const meta = parseTDName(n);
        up.run([n, meta.indexador, meta.vencimento, now]);
      }
      up.finalize();
      res.json({ ok:true, itens: fallback.length, fonte: 'fallback' });
    } catch {
      res.status(500).json({ ok:false, erro:'Falha ao sincronizar Tesouro Direto' });
    }
  }
});

module.exports = router;