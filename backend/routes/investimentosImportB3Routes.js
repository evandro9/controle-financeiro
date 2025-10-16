// routes/investimentosImportB3Routes.js (Postgres)
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer();

const { parseB3Negociacao, importHash, baseTicker } = require('../utils/importacaoB3Utils');
const db = require('../database/db');

router.use(auth);

// Helpers PG
const q   = async (text, params = []) => (await db.query(text, params)).rows;
const one = async (text, params = []) => (await db.query(text, params)).rows[0] || null;

/**
 * PREVIEW de importação B3
 * POST /investimentos/b3  (form-data: arquivo=CSV/XLSX da B3 - Negociação)
 */
router.post('/b3', upload.single('arquivo'), async (req, res) => {
  try {
    const usuario_id = req.user.id;

    if (!req.file) return res.status(400).json({ erro: 'Arquivo não enviado' });
    const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
    if (!['csv', 'xlsx'].includes(ext)) {
      return res.status(400).json({ erro: 'Formato não suportado. Envie um arquivo CSV ou XLSX da B3.' });
    }

    let items, meta;
    try {
      ({ items, meta } = await parseB3Negociacao(req.file.buffer, req.file.originalname));
    } catch {
      return res.status(400).json({ erro: 'Arquivo inválido. Use o CSV/XLSX exportado pela B3 (Negociação).' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ erro: 'Arquivo sem registros válidos para importação.' });
    }

    const preview = [];
    for (const it of items) {
      const hash   = importHash(it, usuario_id);
      const ticker = baseTicker(it.nome_investimento);

      // duplicidade (match por campos principais)
      const dup = await one(
        `SELECT 1
           FROM investimentos
          WHERE usuario_id = $1
            AND nome_investimento = $2
            AND tipo_operacao = $3
            AND quantidade = $4
            AND ROUND(valor_unitario::numeric, 4) = ROUND($5::numeric, 4)
            AND (data_operacao::date) = ($6::date)
          LIMIT 1`,
        [usuario_id, ticker, it.tipo_operacao, it.quantidade, it.valor_unitario, it.data_operacao]
      ).then(r => !!r);

      // sugestão de classe/subclasse via mapa salvo
      const mapa = await one(
        `SELECT classe_id, subclasse_id
           FROM investimento_ticker_map
          WHERE usuario_id = $1 AND ticker = $2
          LIMIT 1`,
        [usuario_id, ticker]
      ) || {};

      preview.push({
        ...it,
        nome_investimento: ticker,
        import_hash: hash,
        duplicado: dup,
        incluir: !dup,
        classe_id: mapa.classe_id || null,
        subclasse_id: mapa.subclasse_id || null,
      });
    }

    res.json({ preview, meta, usuario_id });
  } catch (e) {
    console.error('[/investimentos/b3][preview] erro:', e);
    res.status(500).json({ erro: 'Falha ao processar arquivo da B3' });
  }
});

/**
 * CONFIRMAR importação
 * POST /investimentos/b3/confirmar
 * body: { linhas: [...] }  (mesmo objeto do preview, com incluir=true)
 */
router.post('/b3/confirmar', async (req, res) => {
  try {
    const usuario_id = req.user.id;

    let { linhas } = req.body || {};
    if (!Array.isArray(linhas)) linhas = [];
    linhas = linhas.filter(l => l && l.incluir);

    const getNomeClasse = async (id) => id ? (await one(`SELECT nome FROM investimento_classes WHERE id=$1`, [id]))?.nome || null : null;
    const getNomeSub    = async (id) => id ? (await one(`SELECT nome FROM investimento_subclasses WHERE id=$1`, [id]))?.nome || null : null;

    let ok = 0, falhas = 0;

    for (const l of linhas) {
      try {
        // categoria/subcategoria compatíveis com NOT NULL (categoria) / NULL (subcategoria)
        const catNome = l.categoria ?? (await getNomeClasse(l.classe_id)) ?? 'Investimentos';
        const subNome = l.subcategoria ?? (await getNomeSub(l.subclasse_id)) ?? null;

        const total = l.valor_total ?? (Number(l.quantidade || 0) * Number(l.valor_unitario || 0));

        // INSERT investimento
        await db.query(
          `INSERT INTO investimentos (
             usuario_id, categoria, subcategoria, nome_investimento,
             tipo_operacao, quantidade, valor_unitario, valor_total,
             data_operacao, observacao, classe_id, subclasse_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            usuario_id,
            catNome,
            subNome,
            l.nome_investimento,
            l.tipo_operacao,
            Number(l.quantidade || 0),
            Number(l.valor_unitario || 0),
            Number(total || 0),
            l.data_operacao,
            l.observacao || 'Importado B3',
            l.classe_id || null,
            l.subclasse_id || null,
          ]
        );
        ok++;

        // upsert do mapa de ticker (update -> insert if not exists)
        const upd = await db.query(
          `UPDATE investimento_ticker_map
              SET classe_id=$1, subclasse_id=$2
            WHERE usuario_id=$3 AND ticker=$4`,
          [l.classe_id || null, l.subclasse_id || null, usuario_id, l.nome_investimento]
        );
        if (upd.rowCount === 0) {
          await db.query(
            `INSERT INTO investimento_ticker_map (usuario_id, ticker, classe_id, subclasse_id)
             SELECT $1,$2,$3,$4
             WHERE NOT EXISTS (
               SELECT 1 FROM investimento_ticker_map WHERE usuario_id=$1 AND ticker=$2
             )`,
            [usuario_id, l.nome_investimento, l.classe_id || null, l.subclasse_id || null]
          );
        }
      } catch (e) {
        console.error('INSERT investimentos falhou:', e, l);
        falhas++;
      }
    }

    return res.json({ ok: true, importados: ok, falhas });
  } catch (e) {
    console.error('[/investimentos/b3/confirmar] erro:', e);
    res.status(500).json({ erro: 'Falha ao confirmar importação' });
  }
});

/**
 * PREVIEW de remapeamento de ticker
 * GET /investimentos/remap-ticker/preview?ticker=ITUB4&escopo=null_only|all&desde=YYYY-MM-DD
 */
router.get('/remap-ticker/preview', async (req, res) => {
  try {
    const uid = req.user.id;
    const { ticker, escopo = 'null_only', desde } = req.query;
    if (!ticker) return res.status(400).json({ erro: 'ticker obrigatório' });

    const where = ['usuario_id=$1', 'nome_investimento=$2'];
    const args = [uid, ticker];

    if (escopo === 'null_only') where.push('(classe_id IS NULL OR subclasse_id IS NULL)');
    if (desde) { where.push('(data_operacao::date) >= ($' + (args.length + 1) + '::date)'); args.push(desde); }

    const r = await one(
      `SELECT COUNT(1) AS n FROM investimentos WHERE ${where.join(' AND ')}`,
      args
    );
    res.json({ afetados: Number(r?.n || 0) });
  } catch (e) {
    console.error('[/investimentos/remap-ticker/preview] erro:', e);
    res.status(500).json({ erro: 'Falha ao calcular preview' });
  }
});

/**
 * REMAP de ticker (aplica classe/subclasse e atualiza mapa)
 * POST /investimentos/remap-ticker
 * body: { ticker, to_classe_id, to_subclasse_id, escopo: 'null_only'|'all', desde?: 'YYYY-MM-DD' }
 */
router.post('/remap-ticker', async (req, res) => {
  const client = await db.connect();
  try {
    const uid = req.user.id;
    const { ticker, to_classe_id, to_subclasse_id, escopo = 'null_only', desde } = req.body || {};
    if (!ticker || !to_classe_id) return res.status(400).json({ erro: 'ticker e to_classe_id são obrigatórios' });

    // nomes para preencher categoria/subcategoria (categoria é NOT NULL no schema)
    const catNome = (await one(`SELECT nome FROM investimento_classes WHERE id=$1`, [to_classe_id]))?.nome || 'Investimentos';
    const subNome = to_subclasse_id ? (await one(`SELECT nome FROM investimento_subclasses WHERE id=$1`, [to_subclasse_id]))?.nome || null : null;

    const where = ['usuario_id=$1', 'nome_investimento=$2'];
    const args  = [uid, ticker];

    if (escopo === 'null_only') where.push('(classe_id IS NULL OR subclasse_id IS NULL)');
    if (desde) { where.push('(data_operacao::date) >= ($' + (args.length + 1) + '::date)'); args.push(desde); }

    await client.query('BEGIN');

    const upd = await client.query(
      `UPDATE investimentos
          SET classe_id=$1,
              subclasse_id=$2,
              categoria=$3,
              subcategoria=$4
        WHERE ${where.join(' AND ')}`,
      [to_classe_id, to_subclasse_id || null, catNome, subNome, ...args]
    );

    // Atualiza/insere o mapa padrão
    const updMap = await client.query(
      `UPDATE investimento_ticker_map
          SET classe_id=$1, subclasse_id=$2
        WHERE usuario_id=$3 AND ticker=$4`,
      [to_classe_id, to_subclasse_id || null, uid, ticker]
    );
    if (updMap.rowCount === 0) {
      await client.query(
        `INSERT INTO investimento_ticker_map (usuario_id, ticker, classe_id, subclasse_id)
         SELECT $1,$2,$3,$4
         WHERE NOT EXISTS (
           SELECT 1 FROM investimento_ticker_map WHERE usuario_id=$1 AND ticker=$2
         )`,
        [uid, ticker, to_classe_id, to_subclasse_id || null]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, atualizados: upd.rowCount });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[/investimentos/remap-ticker] erro:', e);
    res.status(500).json({ erro: 'Falha ao remapear investimentos' });
  } finally {
    client.release();
  }
});

module.exports = router;