// backend/routes/importacoesRoutes.js  (Postgres)
const express = require('express');
const router = express.Router();

const {
  normStr, parseValorBR, toISODate, addMonthsClamp,
  hashDedupe, detectParcelado, detectRecorrente,
  aplicaRegras, parseCSV, parseOFX, parseFaturaCsv, parseFaturaOfx,
  computeCardDueDate, computeCardInstallmentDueDate, shiftToNextBusinessDay,
  detectDocTypeFromBuffer
} = require('../utils/importacaoUtils');

const db = require('../database/db');
const auth = require('../middleware/auth');

const multer = require('multer');
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 }, storage: multer.memoryStorage?.() });

// ---------- helpers ----------
function inferirOrigem(nome = '') {
  const lower = (nome || '').toLowerCase();
  if (lower.endsWith('.ofx')) return 'ofx';
  if (lower.endsWith('.csv')) return 'csv';
  return null;
}

// pega a primeira propriedade que existir no objeto dado um conjunto de aliases (com normalização)
const pick = (obj, candidates) => {
  // 1) tentativa direta
  for (const k of candidates) {
    if (obj?.[k] != null && String(obj[k]).trim() !== '') return obj[k];
  }
  // 2) normalizada (sem acento/underscore/espaço)
  const idx = {};
  for (const k of Object.keys(obj || {})) {
    idx[normStr(String(k)).replace(/[\s_]/g, '')] = k;
  }
  for (const want of candidates) {
    const nk = normStr(String(want)).replace(/[\s_]/g, '');
    const realKey = idx[nk];
    if (realKey && obj[realKey] != null && String(obj[realKey]).trim() !== '') {
      return obj[realKey];
    }
  }
  return undefined;
};

// Cria lote e grava itens de preview a partir de conteúdo (csv/ofx)
async function criarLoteEPreviewsPG({ usuarioId, origem, nomeArquivo, conteudo, autoRules = true, tipoDoc = 'extrato', forceTipo = false }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // cria lote
    const insLote = await client.query(
      `INSERT INTO import_lotes (usuario_id, origem, nome_arquivo, status)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [usuarioId, origem, nomeArquivo || null, 'validando']
    );
    const loteId = insLote.rows[0].id;

    // regras do usuário
    const regrasQ = await client.query(
      `SELECT * FROM regras_categorizacao WHERE usuario_id = $1 ORDER BY prioridade ASC`,
      [usuarioId]
    );
    const regras = regrasQ.rows || [];

    // --- DETECTAR tipo do arquivo a partir do conteúdo ---
    let autoSwitched = false;
    try {
      const det = detectDocTypeFromBuffer(Buffer.from(conteudo || '', 'utf8'), nomeArquivo || '');
      const tipoUser = (tipoDoc || '').toLowerCase(); // 'extrato' | 'fatura'
      const mismatch =
        (det.tipo === 'fatura' && tipoUser === 'extrato') ||
        (det.tipo === 'extrato' && tipoUser === 'fatura');

      // Auto-switch com confiança altíssima (≥ 0.90)
      if (!forceTipo && mismatch && det.confidence >= 0.90) {
        tipoDoc = det.tipo; // usa o detectado
        autoSwitched = true;
      }

      if (!forceTipo && mismatch && det.confidence >= 0.75) {
        // aborta e remove o lote criado
        await client.query(`DELETE FROM import_lotes WHERE id = $1`, [loteId]);
        await client.query('COMMIT');
        return {
          status: 'mismatch',
          detected_tipo_doc: det.tipo,
          confidence: det.confidence,
          block: true,
          message: `Arquivo parece ser de ${det.tipo.toUpperCase()}, não ${tipoUser.toUpperCase()}.`
        };
      }
    } catch (_) {
      // heurística falhou -> segue com tipo informado
    }

    // parse
    let registros = [];
    try {
      if (tipoDoc === 'fatura') {
        if ((nomeArquivo || '').toLowerCase().endsWith('.csv') || origem === 'csv') {
          registros = parseFaturaCsv({ csvText: conteudo, cartaoId: null, diaVencimento: 1 });
        } else {
          registros = parseFaturaOfx({ ofxText: conteudo, cartaoId: null, diaVencimento: 1 });
        }
      } else {
        registros = origem === 'csv' ? parseCSV(conteudo)
                                     : origem === 'ofx' ? parseOFX(conteudo)
                                     : [];
      }
    } catch (e) {
      throw e;
    }
    if (!registros?.length) throw new Error('Nenhum registro detectado');

    // inserir itens de preview
    const insertItem = async ({ raw, preview, validado, motivo_erro }) => {
      await client.query(
        `INSERT INTO import_itens (lote_id, raw, preview_json, validado, motivo_erro)
         VALUES ($1, $2, $3, $4, $5)`,
        [loteId, JSON.stringify(raw), JSON.stringify(preview), validado ? 1 : 0, motivo_erro || null]
      );
    };

    // builders
    const montarCSV = async (row) => {
      const desc = pick(row, [
        'descricao','Descrição','DESC','desc','historico','Histórico','HISTORICO','memo','MEMO','name','Name','payee','Payee'
      ]) ?? Object.values(row)[0];
      const val  = pick(row, ['valor','Valor','AMOUNT','Valor__c']);
      const dtL  = pick(row, [
        'data','Data','DATA','date','DTPOSTED',
        'data_lancamento','Data Lancamento','Data Lançamento','DATA_LANCAMENTO','Data_Lancamento','DataLancamento'
      ]);
      const dtV  = pick(row, [
        'vencimento','Vencimento','Data Vencimento','DATA_VENCIMENTO','data_vencimento','Data_Vencimento'
      ]);
      const tipo = pick(row, ['tipo','Tipo','TYPE','D/C','DC','debito_credito']) || '';

      const data_lancamento = toISODate(dtL);
      const data_vencimento = toISODate(dtV) || data_lancamento; // extrato: venc = lançamento
      const valor = parseValorBR(val);
      const descricao = String(desc || '').trim();

      const tipoNorm =
        normStr(tipo).includes('cred') ? 'credito' :
        normStr(tipo).includes('deb')  ? 'debito'  :
        (valor < 0 ? 'debito' : 'credito');

      const categ = autoRules ? (aplicaRegras(descricao, valor, regras) || {}) : {};
      const hash  = hashDedupe({ data_lancamento, data_vencimento, valor, descricao });
      const parc  = detectParcelado(descricao);
      const reco  = detectRecorrente(descricao);

      await insertItem({
        raw: { ...row, __tipoDoc: 'extrato' },
        preview: {
          origem,
          external_id: null,
          data_lancamento,
          data_vencimento,
          valor,
          descricao,
          tipo: tipoNorm,
          categoria_id: autoRules ? (categ.categoria_id || null) : null,
          subcategoria_id: autoRules ? (categ.subcategoria_id || null) : null,
          hash_dedupe: hash,
          detect_parcela: parc,
          detect_recorrente: reco
        },
        validado: !!(data_lancamento && !isNaN(valor) && descricao),
        motivo_erro: (!data_lancamento || isNaN(valor) || !descricao) ? 'Campos essenciais ausentes' : null
      });
    };

    const montarOFX = async (r) => {
      const data_lancamento =
        toISODate(r.date) ||
        toISODate(r.DTPOSTED) ||
        toISODate(String(r.DTPOSTED || r.date || '').replace(/[^\d]/g, '').slice(0, 8));
      const valor = parseFloat(r.amount);
      const descricao = (r.memo || '').trim();

      const tipo =
        normStr(r.type).includes('cred') ? 'credito' :
        normStr(r.type).includes('deb')  ? 'debito'  :
        (valor < 0 ? 'debito' : 'credito');

      const categ = autoRules ? (aplicaRegras(descricao, valor, regras) || {}) : {};
      const hash  = hashDedupe({ data_lancamento, data_vencimento: data_lancamento, valor, descricao });
      const parc  = detectParcelado(descricao);
      const reco  = detectRecorrente(descricao);

      await insertItem({
        raw: {
          ...r,
          __tipoDoc: 'extrato',
          // ajuda o front em qualquer fallback
          date: r.date || data_lancamento || null,
          DTPOSTED: r.DTPOSTED || (r.date ? String(r.date).replace(/-/g, '') : null)
        },
        preview: {
          origem,
          external_id: r.fitid || null,
          data_lancamento,
          data_vencimento: data_lancamento,   // extrato: venc = lançamento
          valor,
          descricao,
          tipo,
          categoria_id: autoRules ? (categ.categoria_id || null) : null,
          subcategoria_id: autoRules ? (categ.subcategoria_id || null) : null,
          hash_dedupe: hash,
          detect_parcela: parc,
          detect_recorrente: reco
        },
        validado: !!(data_lancamento && !isNaN(valor) && descricao),
        motivo_erro: (!data_lancamento || isNaN(valor) || !descricao) ? 'Campos essenciais ausentes' : null
      });
    };

    // Montagem para FATURA (registros já vêm {descricao, valor, preview})
    const montarFatura = async (it) => {
      const descricao = (it.descricao || '').trim();
      const valor = Number(it.valor) || 0;
      let data_lancamento = it.preview?.data_lancamento || null;
      const data_vencimento = it.preview?.data_vencimento || null;
      const tipo = it.preview?.tipo === 'receita' ? 'credito' : 'debito';
      const categ = autoRules ? (aplicaRegras(descricao, valor, regras) || {}) : {};
      const hash  = hashDedupe({ data_lancamento, data_vencimento, valor, descricao });

      // Base: data da compra (preferências comuns em CSVs de fatura)
      const dataCompraISO =
        toISODate(it.raw?.data_compra) ||
        toISODate(it.raw?.DATA_COMPRA) ||
        toISODate(it.preview?.data_compra) ||
        toISODate(it.preview?.data_lancamento) || // fallback
        toISODate(it.raw?.DTPOSTED) ||
        null;

      // Descobrir parcela atual
      let parcelaAtual = Number(
        it.preview?.detect_parcela?.atual ??
        it.preview?.parcela_atual ??
        (() => {
          const m = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(String(descricao).normalize('NFKD'));
          return m ? m[1] : NaN;
        })()
      );

      if (dataCompraISO && Number.isFinite(parcelaAtual) && parcelaAtual >= 1) {
        // Ex.: compra 10/05, parcela 3 => 10/08
        const ajustada = addMonthsClamp(dataCompraISO, parcelaAtual);
        if (ajustada) {
          data_lancamento = ajustada; // usa a variável do preview
        }
      }

      const detectParc = (() => {
        if (it.preview?.detect_parcela) return it.preview.detect_parcela;
        const atualNum = Number(it.preview?.parcela_atual);
        const totalNum = Number(it.preview?.parcela_total);
        if (Number.isFinite(totalNum) && totalNum > 0) {
          return { ehParcela: true, atual: (Number.isFinite(atualNum) && atualNum > 0) ? atualNum : 1, total: totalNum };
        }
        const m = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(String(descricao).normalize('NFKD'));
        return m ? { ehParcela: true, atual: Number(m[1]), total: Number(m[2]) } : null;
      })();

      const prev = {
        origem,
        external_id: it.preview?.fitid || null,
        data_lancamento,
        data_compra: dataCompraISO || null,
        data_vencimento,
        valor: Math.abs(valor),
        descricao,
        tipo,
        categoria_id: autoRules ? (categ.categoria_id || null) : null,
        subcategoria_id: autoRules ? (categ.subcategoria_id || null) : null,
        hash_dedupe: hash,
        detect_parcela: detectParc,
        detect_recorrente: null
      };

      await insertItem({
        raw: { ...it, __tipoDoc: 'fatura' },
        preview: prev,
        validado: !!(data_lancamento && !isNaN(prev.valor) && descricao),
        motivo_erro: (!data_lancamento || isNaN(prev.valor) || !descricao) ? 'Campos essenciais ausentes' : null
      });
    };

    if (tipoDoc === 'fatura') {
      for (const it of registros) await montarFatura(it);
    } else if (origem === 'csv') {
      for (const it of registros) await montarCSV(it);
    } else {
      for (const it of registros) await montarOFX(it);
    }

    await client.query(`UPDATE import_lotes SET status = $1 WHERE id = $2`, ['aguardando', loteId]);
    await client.query('COMMIT');
    return { loteId, auto_switched: !!autoSwitched, used_tipo: tipoDoc };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    try { client.release?.(); } catch {}
  }
}

// ---------- rotas ----------

router.use(auth);

// Preview do lote
router.get('/importacoes/:loteId/preview', async (req, res) => {
  const loteId = parseInt(req.params.loteId, 10);
  try {
    const { rows } = await db.query(
      `SELECT id, raw, preview_json, validado, motivo_erro
         FROM import_itens
        WHERE lote_id = $1
        ORDER BY id`,
      [loteId]
    );
    const itens = (rows || []).map(r => ({
      id: r.id,
      raw: r.raw ? JSON.parse(r.raw) : null,
      preview: r.preview_json ? JSON.parse(r.preview_json) : null,
      validado: !!r.validado,
      motivo_erro: r.motivo_erro || null
    }));
    res.json({ itens });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Cria lote a partir de texto (CSV/OFX colado)
router.post('/importacoes', async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { origem, nomeArquivo, conteudo, auto_regras, tipo_doc } = req.body || {};
    const autoRules = String(auto_regras ?? '1') === '1';
    if (!origem || !conteudo) return res.status(400).json({ erro: 'origem e conteudo são obrigatórios' });

    const ok = await criarLoteEPreviewsPG({
      usuarioId, origem, nomeArquivo, conteudo, autoRules,
      tipoDoc: (tipo_doc === 'fatura' ? 'fatura' : 'extrato'),
      forceTipo: !!req.body.force_tipo
    });
    if (ok && ok.status === 'mismatch') return res.status(200).json(ok);
    return res.json(ok);
  } catch (err) {
    res.status(400).json({ erro: err.message || String(err) });
  }
});

// Upload (multipart)
router.post('/importacoes/upload', upload.single('arquivo'), async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const origem = req.body?.origem || inferirOrigem(req.file?.originalname);
    const nomeArquivo = req.file?.originalname || null;
    const conteudo = req.file?.buffer?.toString('utf8') || '';
    const autoRules = String(req.body?.auto_regras ?? '1') === '1';
    const tipoDoc = req.body?.tipo_doc === 'fatura' ? 'fatura' : 'extrato';

    if (!origem || !conteudo) {
      return res.status(400).json({ erro: 'arquivo e origem são obrigatórios' });
    }

    const ok = await criarLoteEPreviewsPG({
      usuarioId, origem, nomeArquivo, conteudo, autoRules, tipoDoc,
      forceTipo: !!req.body.force_tipo
    });
    if (ok && ok.status === 'mismatch') return res.status(200).json(ok);
    return res.json(ok);
  } catch (err) {
    res.status(400).json({ erro: err.message || String(err) });
  }
});

// Reaplicar regras
router.post('/importacoes/:loteId/aplicar-regras', async (req, res) => {
  const loteId = parseInt(req.params.loteId, 10);
  const usuarioId = req.user.id;
  try {
    const regras = (await db.query(
      `SELECT * FROM regras_categorizacao WHERE usuario_id = $1 ORDER BY prioridade ASC`,
      [usuarioId]
    )).rows || [];

    const itens = (await db.query(
      `SELECT id, preview_json FROM import_itens WHERE lote_id = $1`,
      [loteId]
    )).rows || [];

    for (const it of itens) {
      const prev = it.preview_json ? JSON.parse(it.preview_json) : {};
      const categ = aplicaRegras(prev.descricao, prev.valor, regras) || {};
      prev.categoria_id = prev.categoria_id ?? categ.categoria_id ?? null;
      prev.subcategoria_id = prev.subcategoria_id ?? categ.subcategoria_id ?? null;
      await db.query(
        `UPDATE import_itens SET preview_json = $1 WHERE id = $2`,
        [JSON.stringify(prev), it.id]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Atualizar categoria/sub de um item de preview (persistir edição manual)
router.post('/importacoes/:loteId/itens/:itemId/categoria', async (req, res) => {
  const loteId = parseInt(req.params.loteId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const { categoria_id, subcategoria_id } = req.body || {};
  if (!loteId || !itemId || !categoria_id) {
    return res.status(400).json({ erro: 'loteId, itemId e categoria_id são obrigatórios' });
  }
  try {
    const rowQ = await db.query(
      `SELECT id, preview_json FROM import_itens WHERE id = $1 AND lote_id = $2`,
      [itemId, loteId]
    );
    const row = rowQ.rows?.[0];
    if (!row) return res.status(404).json({ erro: 'Item não encontrado neste lote' });
    const prev = row.preview_json ? JSON.parse(row.preview_json) : {};
    prev.categoria_id = Number(categoria_id);
    prev.subcategoria_id = subcategoria_id != null ? Number(subcategoria_id) : null;
    await db.query(
      `UPDATE import_itens SET preview_json = $1 WHERE id = $2`,
      [JSON.stringify(prev), itemId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Confirmar importação
router.post('/importacoes/:loteId/confirmar', async (req, res) => {
  const loteId = parseInt(req.params.loteId, 10);
  const usuarioId = req.user.id;
  const { selecionarIds, ignorarIds, forma_pagamento_padrao_id, id_pix } = req.body || {};

  const client = await db.connect();
  try {
    // pega todos os itens do lote
    const rowsQ = await client.query(
      `SELECT id, preview_json FROM import_itens WHERE lote_id = $1`,
      [loteId]
    );
    let rows = rowsQ.rows || [];

    // filtra conforme seleção
    if (Array.isArray(selecionarIds)) {
      const sel = new Set(selecionarIds.map(Number));
      rows = rows.filter(r => sel.has(r.id));
    } else if (selecionarIds === 'all' && Array.isArray(ignorarIds)) {
      const ign = new Set(ignorarIds.map(Number));
      rows = rows.filter(r => !ign.has(r.id));
    }

    // obter dia venc/fech da forma padrão (se houver)
    const formaId = Number(forma_pagamento_padrao_id) || null;
    let diaV = null, diaF = null;
    if (formaId) {
      const fpQ = await client.query(
        `SELECT dia_vencimento AS "diaV", dia_fechamento AS "diaF"
           FROM formas_pagamento
          WHERE id = $1`,
        [formaId]
      );
      diaV = fpQ.rows?.[0]?.diaV ?? null;
      diaF = fpQ.rows?.[0]?.diaF ?? null;
    }

    // Pré-processa previews: calcula data_vencimento quando não existir
    const alvosComPrev = rows.map(r => {
      const p = JSON.parse(r.preview_json || '{}');
      if ((!p.data_vencimento || p.data_vencimento === '') && diaV) {
        // tentar ANCORADO na compra + (parcelaAtual - 1)
        const atual = Number(p?.detect_parcela?.atual ?? p?.parcela_atual);
        const dataCompra =
          p?.data_compra ||
          p?.dataCompra ||
          null;
        let dvBase = null;
        if (dataCompra && Number.isFinite(atual) && atual >= 1) {
          dvBase = computeCardInstallmentDueDate(dataCompra, atual, diaV, diaF);
        }
        // fallback (sem dados de compra/parcela)
        if (!dvBase) dvBase = computeCardDueDate(p.data_lancamento, diaV, diaF);
        const dv = shiftToNextBusinessDay(dvBase);
        if (dv) p.data_vencimento = dv;
      }
      return { id: r.id, p };
    });

    await client.query('BEGIN');

    // Inserir em transacoes_externas (com dedupe manual, já que nem sempre há unique no schema)
    const insertedIds = [];
    for (const { id, p } of alvosComPrev) {
      // vencimento = mesma data do lançamento, se vier nulo
      const dataVenc = p.data_vencimento || p.data_lancamento || null;

      // forma de pagamento...
      const descLower = String(p.descricao || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const isPix = /\bpix\b/.test(descLower);
      const formaPgtoId = (p.forma_pagamento_id != null)
        ? Number(p.forma_pagamento_id)
        : (isPix && Number(id_pix)) ? Number(id_pix)
        : (Number(forma_pagamento_padrao_id) || null);

      // mapear crédito/débito -> receita/despesa
      const tRaw = String(p.tipo || p.dc || p.debito_credito || '')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
        .trim().toLowerCase();
      let tipo;
      if (['c','cr','cred','credito','credit','creditado'].includes(tRaw)) tipo = 'receita';
      else if (['d','db','deb','debito','debit','dr'].includes(tRaw)) tipo = 'despesa';
      else tipo = (Number(p.valor) >= 0 ? 'receita' : 'despesa');

      // dedupe manual (equivalente ao INSERT OR IGNORE)
      const dupQ = await client.query(
        `SELECT 1 FROM transacoes_externas
          WHERE usuario_id = $1
            AND (external_id = $2 OR hash_dedupe = $3)
          LIMIT 1`,
        [usuarioId, p.external_id || p.hash_dedupe || null, p.hash_dedupe || null]
      );
      if (dupQ.rowCount > 0) continue;

      const ins = await client.query(
        `INSERT INTO transacoes_externas
         (usuario_id, origem, external_id, conta_id, data_lancamento, data_vencimento, valor, descricao, tipo,
          categoria_id, subcategoria_id, forma_pagamento_id, hash_dedupe)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          usuarioId,
          p.origem || null,
          p.external_id || p.hash_dedupe || null,
          null,
          p.data_lancamento,
          dataVenc,
          p.valor,
          p.descricao,
          tipo, // receita/despesa
          p.categoria_id || null,
          p.subcategoria_id || null,
          formaPgtoId,
          p.hash_dedupe
        ]
      );
      insertedIds.push(ins.rows[0].id);
    }

    // Também cria lançamentos (tabela lancamentos) a partir dos previews válidos
    let lancCriados = 0;
    for (const { id, p } of alvosComPrev) {
      if (!p || !p.categoria_id || !p.subcategoria_id || !p.data_lancamento || p.valor == null) continue;

      const tRaw2 = String(p.tipo || p.dc || p.debito_credito || '')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
        .trim().toLowerCase();
      let tipo;
      if (['c','cr','cred','credito','credit','creditado'].includes(tRaw2)) tipo = 'receita';
      else if (['d','db','deb','debito','debit','dr'].includes(tRaw2)) tipo = 'despesa';
      else tipo = (Number(p.valor) >= 0 ? 'receita' : 'despesa');

      const valorAbs = Math.abs(Number(p.valor));
      const dataVenc = p.data_vencimento || p.data_lancamento || null;

      const descLower = String(p.descricao || '')
        .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
        .toLowerCase();
      const isPix = /\bpix\b/.test(descLower);
      const formaPgtoId = (p.forma_pagamento_id != null)
        ? Number(p.forma_pagamento_id)
        : (isPix && Number(id_pix)) ? Number(id_pix)
        : (Number(forma_pagamento_padrao_id) || null);

      await client.query(
        `INSERT INTO lancamentos (
           tipo, data_lancamento, data_vencimento, valor,
           categoria_id, subcategoria_id, forma_pagamento_id,
           observacao, status, parcela, total_parcelas, grupo_parcela_id, usuario_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          tipo,
          p.data_lancamento,
          dataVenc,
          valorAbs,
          p.categoria_id,
          p.subcategoria_id,
          formaPgtoId,
          p.descricao || null,
          'pago',
          null,
          null,
          null,
          usuarioId
        ]
      );
      lancCriados++;
    }

    await client.query(`UPDATE import_lotes SET status = $1 WHERE id = $2`, ['importado', loteId]);
    await client.query('COMMIT');
    // AUDITORIA: confirmação de importação
    req.audit({
      acao: 'imports.confirmar',
      entidade: 'import_lote',
      entidade_id: loteId,
      sucesso: true,
      detalhes: { transacoes_externas: insertedIds.length, lancamentos: lancCriados }
    });
    res.json({
      ok: true,
      totalInseridos: insertedIds.length,  // transacoes_externas
      lancamentosCriados: lancCriados,     // Movimentações
      insertedIds
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ erro: err.message });
  } finally {
    client.release?.();
  }
});

// Check duplicados
router.post('/importacoes/:loteId/check-duplicados', async (req, res) => {
  const loteId = parseInt(req.params.loteId, 10);
  const usuarioId = req.user.id;
  try {
    const itens = (await db.query(
      `SELECT id, preview_json FROM import_itens WHERE lote_id = $1`,
      [loteId]
    )).rows || [];

    const ext = (await db.query(
      `SELECT external_id, hash_dedupe FROM transacoes_externas WHERE usuario_id = $1`,
      [usuarioId]
    )).rows || [];

    const byExternal = new Set();
    const byHash = new Set();
    ext.forEach(x => {
      if (x.external_id) byExternal.add(String(x.external_id));
      if (x.hash_dedupe) byHash.add(String(x.hash_dedupe));
    });

    const result = {};
    itens.forEach(it => {
      const p = JSON.parse(it.preview_json || '{}');
      let status = 'ok', motivo = '';
      if (p.external_id && byExternal.has(String(p.external_id))) {
        status = 'duplicado_certo'; motivo = 'external_id já importado';
      } else if (p.hash_dedupe && byHash.has(String(p.hash_dedupe))) {
        status = 'duplicado_provavel'; motivo = 'hash_dedupe bate com transação existente';
      }
      result[it.id] = { status, motivo };
    });

    res.json({ duplicados: result });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Conciliação - sugerir
router.post('/conciliacao/sugerir', async (req, res) => {
  const usuarioId = req.user.id;
  const { ids = [] } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.json({ sugestoes: {} });

  try {
    const ext = (await db.query(
      `SELECT * FROM transacoes_externas WHERE usuario_id = $1 AND id = ANY($2::int[])`,
      [usuarioId, ids.map(Number)]
    )).rows || [];

    const datas = [...new Set(ext.map(e => e.data_lancamento))];
    if (datas.length === 0) return res.json({ sugestoes: {} });

    const lans = (await db.query(
      `SELECT id, data_lancamento, valor, observacao, descricao, categoria_id, subcategoria_id
         FROM lancamentos
        WHERE usuario_id = $1
          AND data_lancamento = ANY($2::date[])`,
      [usuarioId, datas]
    )).rows || [];

    const byDate = {};
    lans.forEach(l => { (byDate[l.data_lancamento] ||= []).push(l); });

    const norm = s => (s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const sugestoes = {};
    ext.forEach(e => {
      const ls = byDate[e.data_lancamento] || [];
      const descE = norm(e.descricao || '');
      const cand = ls.find(l => {
        if (Number(l.valor).toFixed(2) !== Number(e.valor).toFixed(2)) return false;
        const d1 = norm(l.descricao || '');
        const d2 = norm(l.observacao || '');
        return descE && (d1.includes(descE) || descE.includes(d1) || d2.includes(descE) || descE.includes(d2));
      });
      if (cand) sugestoes[e.id] = { lancamento_id: cand.id, motivo: 'data & valor & descricao similares' };
    });

    res.json({ sugestoes });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Conciliação - aplicar
router.post('/conciliacao/aplicar', async (req, res) => {
  const usuarioId = req.user.id;
  const { pairs = [] } = req.body || {};
  if (!Array.isArray(pairs) || pairs.length === 0) return res.json({ ok: true, atualizados: 0 });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let count = 0;
    for (const p of pairs) {
      const r = await client.query(
        `UPDATE transacoes_externas
            SET conciliado = 1, lancamento_id = $1
          WHERE id = $2 AND usuario_id = $3`,
        [p.lancamento_id, p.transacao_externa_id, usuarioId]
      );
      if (r.rowCount > 0) count++;
    }
    await client.query('COMMIT');
    res.json({ ok: true, atualizados: count });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
});

// Auxiliar: buscar transacoes_externas por ids (para o front casar sugestões)
router.get('/minhas-transacoes-externas', async (req, res) => {
  const usuarioId = req.user.id;
  const ids = (req.query.ids || '').split(',').map(s => parseInt(s, 10)).filter(Boolean);
  if (!ids.length) return res.json({ transacoes: [] });

  try {
    const { rows } = await db.query(
      `SELECT id, data_lancamento, data_vencimento, valor, descricao, external_id, hash_dedupe
         FROM transacoes_externas
        WHERE usuario_id = $1 AND id = ANY($2::int[])`,
      [usuarioId, ids]
    );
    res.json({ transacoes: rows || [] });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Marcar itens do preview como PARCELAS
router.post('/importacoes/:loteId/marcar-parcelas', async (req, res) => {
  const loteId = parseInt(req.params.loteId, 10);
  const { itens = [], nome = null, parcela_total = null } = req.body || {};
  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ erro: 'itens obrigatórios' });

  try {
    const rows = (await db.query(
      `SELECT id, preview_json FROM import_itens WHERE lote_id = $1 AND id = ANY($2::int[])`,
      [loteId, itens.map(Number)]
    )).rows || [];

    for (const r of rows) {
      const p = JSON.parse(r.preview_json || '{}');
      p.marcar_parcela = { nome, parcela_total, infer: p.detect_parcela || null };
      await db.query(
        `UPDATE import_itens SET preview_json = $1 WHERE id = $2`,
        [JSON.stringify(p), r.id]
      );
    }
    res.json({ ok: true, marcados: rows.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Marcar itens do preview como RECORRENTES
router.post('/importacoes/:loteId/marcar-recorrentes', async (req, res) => {
  const loteId = parseInt(req.params.loteId, 10);
  const { itens = [], nome = null } = req.body || {};
  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ erro: 'itens obrigatórios' });

  try {
    const rows = (await db.query(
      `SELECT id, preview_json FROM import_itens WHERE lote_id = $1 AND id = ANY($2::int[])`,
      [loteId, itens.map(Number)]
    )).rows || [];

    for (const r of rows) {
      const p = JSON.parse(r.preview_json || '{}');
      p.marcar_recorrente = { nome };
      await db.query(
        `UPDATE import_itens SET preview_json = $1 WHERE id = $2`,
        [JSON.stringify(p), r.id]
      );
    }
    res.json({ ok: true, marcados: rows.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;