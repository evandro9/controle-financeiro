const express = require('express');
const router = express.Router();
const multer = require('multer');
const Papa = require('papaparse'); // ou csv-parse
const db = require('../../database/db');

const upload = multer({ storage: multer.memoryStorage() });

// POST /investimentos/proventos/importar-b3  (Postgres)
router.post('/importar-b3', upload.single('arquivo'), (req, res) => {
  const usuarioId = req.user?.id || req.usuario_id || req.headers['x-usuario-id'];
  if (!usuarioId) return res.status(401).json({ error: 'unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'missing_file' });

  const csv = req.file.buffer.toString('utf8');

  // utils de conversão (pt-BR)
  const brToNumber = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim();
    if (!s) return 0;
    return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
  };
  const toISO = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    // dd/mm/aaaa -> aaaa-mm-dd
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    // já está em ISO?
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // tenta Date()
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    return null;
  };

  Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => String(h || '').trim().toLowerCase(),
    complete: async (result) => {
      try {
        const rows = Array.isArray(result.data) ? result.data : [];

        // normaliza e filtra linhas válidas
        const itens = [];
        for (const r of rows) {
          const dataISO = toISO(r['data do pagamento'] ?? r['data pagamento'] ?? r['data']);
          const ticker  = String(r['código do ativo'] ?? r['codigo do ativo'] ?? r['ativo'] ?? '').trim().toUpperCase();
          const tipo    = String(r['tipo'] ?? 'DIVIDENDO').trim().toUpperCase();
          const qtd     = brToNumber(r['quantidade']);
          const bruto   = brToNumber(r['valor bruto'] ?? r['valor']);
          const imposto = brToNumber(r['imposto']);
          const nome    = (r['nome do ativo'] ?? r['descricao'] ?? r['descrição'] ?? '').trim() || null;
          const obs     = (r['observacao'] ?? r['observação'] ?? r['histórico'] ?? r['historico'] ?? '').trim() || null;

          if (!ticker || !dataISO) continue;
          // aceita valor bruto 0 (algumas corretoras separam "imposto" do "bruto"); ajuste se preferir > 0
          itens.push([usuarioId, ticker, nome, tipo, dataISO, (qtd || null), bruto, (imposto || 0), obs]);
        }

        if (!itens.length) {
          return res.status(400).json({ error: 'no_valid_rows' });
        }

        // monta multinsert parametrizado
        const cols = ['usuario_id','ticker','nome_ativo','tipo','data','quantidade','valor_bruto','imposto','observacao'];
        const placeholders = [];
        const flatParams = [];
        itens.forEach((row, i) => {
          const base = i * cols.length;
          placeholders.push('(' + cols.map((_, j) => `$${base + j + 1}`).join(', ') + ')');
          flatParams.push(...row);
        });

        await db.query('BEGIN');
        await db.query(
          `INSERT INTO proventos (${cols.join(', ')}) VALUES ${placeholders.join(', ')}`,
          flatParams
        );
        await db.query('COMMIT');

        return res.json({ ok: true, inseridos: itens.length });
      } catch (err) {
        try { await db.query('ROLLBACK'); } catch (_) {}
        console.error('[/proventos/importar-b3] erro', err);
        return res.status(500).json({ error: 'db_error' });
      }
    },
    error: (e) => res.status(400).json({ error: 'parse_error', detail: e.message })
  });
});

module.exports = router;