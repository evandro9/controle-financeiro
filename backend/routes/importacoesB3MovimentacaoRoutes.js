// backend/routes/importacoesB3MovimentacaoRoutes.js  (Postgres)
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../database/db');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const XLSX = require('xlsx');

router.use(auth);

// ----------------------------- utils ------------------------------------

// normaliza string (sem acento, minúsculas, sem espaços/underscore)
function nk(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[\s_]/g, '');
}

function isLeilaoFracaoLike(mov) {
  const t = nk(mov);
  return t.includes('leilao') && (t.includes('fracao') || t.includes('fracaoemativos') || t.includes('fracaoemacoes'));
}

function isFractionLike(mov) {
  const t = nk(mov);
  // cobre: "Ajuste de Bonificação", "Ajuste Bonificação", "Fração em Ativos"
  return (t.includes('ajuste') && t.includes('bonific'))  // ajuste de bonificação
      || t.includes('fracaoemativos') || (t.includes('fracao') && t.includes('ativo'));
}

function parseMoneyLike(row) {
  const pu = pickNumber(
    pick(row, ['Preço Unitário','Preco Unitario','Preço','Preco','Preço Médio','Preco Medio'])
  ) || 0;
  const vt = pickNumber(
    pick(row, ['Valor da Operação','Valor Operação','Valor','Valor Líquido','Valor Liquido'])
  ) || 0;
  return { pu, vt };
}

function isCreditLike(v) {
  const s = nk(v);
  return s.includes('credito') || s === 'c' || s.includes('cr') || s.includes('credit');
}
function isDebitLike(v) {
  const s = nk(v);
  return s.includes('debito') || s === 'd' || s.includes('de') || s.includes('deb');
}

function isBonusLike(tipo) {
  if (!tipo) return false;
  const t = String(tipo).toLowerCase();
  return (
    t.includes('bonif') ||
    t.includes('boniç') ||
    t.includes('bônus') ||
    t.includes('bonus') ||
    t.includes('bonificacao em acoes') ||
    t.includes('bônus em acoes') ||
    t.includes('bonus em acoes') ||
    t.includes('Bonificação em Ativos') ||
    t.includes('Bonificacao em Ativos') ||
    t.includes('Bonificacao em ativos') ||
    t.includes('bonificacao em ativos')
  );
}

function readWorkbookFromBuffer(buf, filename) {
  const isCSV = /\.csv$/i.test(filename || '');
  if (isCSV) return XLSX.read(buf, { type: 'buffer', raw: false, codepage: 65001 });
  return XLSX.read(buf, { type: 'buffer', cellDates: true, raw: false });
}

function sheetToJsonFirst(wb) {
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

// pega a primeira propriedade que existir no objeto dado um conjunto de aliases
function pick(obj, aliases = []) {
  if (!obj) return undefined;
  const idx = {};
  for (const k of Object.keys(obj)) idx[nk(k)] = k;
  for (const a of aliases) {
    const real = idx[nk(a)];
    if (real != null && String(obj[real]).trim() !== '') return obj[real];
  }
  return undefined;
}

function normalizeDateBR(str) {
  if (!str) return null;
  const s = String(str).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  if (!isNaN(d)) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

// Converte string BR para number (ex.: "1.234,56" → 1234.56)
function toNumberBR(v) {
  if (typeof v === 'number') return v;
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, '');
  if (s === '') return null;
  if (s.includes('.') && s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (s.includes(',') && !s.includes('.')) return Number(s.replace(',', '.'));
  if (s.includes('.') && !s.includes(',')) {
    if (/^\d+\.\d{1,3}$/.test(s)) return Number(s);
    return Number(s.replace(/\./g, ''));
  }
  return Number(s);
}
function pickNumber(...vals) {
  for (const v of vals) {
    const n = toNumberBR(v);
    if (n != null) return n;
  }
  return 0;
}

// Busca todos os tickers mapeados do usuário
async function getUserTickers(usuario_id) {
  const { rows } = await db.query(
    'SELECT ticker FROM investimento_ticker_map WHERE usuario_id=$1',
    [usuario_id]
  );
  return (rows || []).map(r => String(r.ticker || '').toUpperCase());
}

// Extrai um ticker abreviado de uma string de “Produto”
async function extractTickerFromProduto(usuario_id, produto) {
  const raw = String(produto || '').trim().toUpperCase();
  if (!raw) return '';
  const prodNK = nk(raw);
  const known = await getUserTickers(usuario_id);
  for (const tk of known) {
    if (prodNK.includes(nk(tk))) return tk;
  }
  const tokens = raw.split(/[^A-Z0-9]+/).filter(Boolean);
  const cand = tokens.find(t => /^[A-Z]{2,8}\d{0,2}$/.test(t));
  return cand || tokens[0] || raw;
}

// Fundimos linhas que tenham mesmo ticker para herdar classe/subclasse iniciais do backend
function unifyMappingByTicker(rows) {
  const memo = {}; // ticker -> {classe_id, subclasse_id}
  rows.forEach(r => {
    const t = r.nome_investimento;
    if (!memo[t] && (r.classe_id || r.subclasse_id)) {
      memo[t] = {
        classe_id: r.classe_id ? String(r.classe_id) : '',
        subclasse_id: r.subclasse_id ? String(r.subclasse_id) : ''
      };
    }
  });
  return rows.map(r => {
    const t = r.nome_investimento;
    const base = memo[t] || {};
    return {
      ...r,
      classe_id: String(r.classe_id ?? base.classe_id ?? ''),
      subclasse_id: String(r.subclasse_id ?? base.subclasse_id ?? '')
    };
  });
}

// Heurística: identifica se a movimentação é de PROVENTO
function isProventoLike(mov) {
  const t = nk(mov);
  if (!t) return false;
  return (
    t.includes('dividen') ||
    t.includes('juros') || t.includes('jcp') || (t.includes('capital') && t.includes('proprio')) ||
    t.includes('rend')
  );
}
// Mapeia a movimentação para tipo salvo na tabela proventos
function mapProventoTipo(mov) {
  const t = nk(mov || '');
  if (t.includes('juros') || t.includes('jcp') || (t.includes('capital') && t.includes('proprio'))) return 'JCP';
  if (t.includes('rend')) return 'RENDIMENTO';
  return 'DIVIDENDO';
}

// Checa se já existe provento equivalente no BD (em `proventos` OU `investimentos`)
async function checkProventoDuplicado(usuario_id, ticker, tipoCanon, dataISO, valor) {
  // 1) proventos
  const r1 = await db.query(
    `SELECT 1 FROM proventos
      WHERE usuario_id=$1
        AND UPPER(ticker)=UPPER($2)
        AND UPPER(tipo)=UPPER($3)
        AND (data)::date = $4::date
        AND ABS(valor_bruto - $5) < 0.01
      LIMIT 1`,
    [usuario_id, ticker, tipoCanon, dataISO, valor]
  );
  if (r1.rowCount > 0) return true;
  // 2) investimentos (salvo como movimentação 'provento')
  const r2 = await db.query(
    `SELECT 1 FROM investimentos
      WHERE usuario_id=$1
        AND UPPER(nome_investimento)=UPPER($2)
        AND LOWER(tipo_operacao)='provento'
        AND (data_operacao)::date = $3::date
        AND ABS(valor_total - $4) < 0.01
      LIMIT 1`,
    [usuario_id, ticker, dataISO, valor]
  );
  return r2.rowCount > 0;
}

// ---------------- PREVIEW: /b3-movimentacao (e alias /b3-eventos) ----------------

async function buildBonusPreviewFromMov(req, res) {
  try {
    const usuario_id = req.user.id;
    const file = req.file;
    if (!file) return res.status(400).json({ erro: 'Arquivo não enviado' });

    const wb = readWorkbookFromBuffer(file.buffer, file.originalname);
    const rows = sheetToJsonFirst(wb);

    const norm = (s='') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
    const isProventoTipo = (mov) => {
      const x = norm(mov);
      return (
        x.includes('DIVIDENDO') ||
        x === 'JCP' || x.includes('JUROS SOBRE CAPITAL PROPRIO') ||
        x.includes('RENDIMENTO') ||
        x.includes('AMORTIZACAO') ||
        x.includes('BONUS EM DINHEIRO')
      );
    };

    const preview = [];         // bonificação/ajuste/leilão + provento normalizado
    const linhasProventos = []; // compat

    for (const r of rows) {
      const movimentacao = pick(r, ['Movimentação','Movimentacao','Tipo','Evento','Histórico','Historico','Descrição','Descricao']);
      const dcRaw        = pick(r, ['Entrada/Saída','Entrada/Saida','D/C','DC','Sinal']);
      const dcCredit     = isCreditLike(dcRaw);
      const dcDebit      = isDebitLike(dcRaw);

      // PROVENTO → bucket dedicado e também no preview normalizado
      if (isProventoTipo(movimentacao)) {
        const data = normalizeDateBR(
          pick(r, ['Data','Data do Movimento','Data Movimentação','Data Movimentacao','Data Liquidação','Data Liquidacao'])
        );
        const produto = r['Produto'] || r['Ativo'] || r['Papel'] || r['Código do Ativo'] || r.ticker || '';
        const ticker  = await extractTickerFromProduto(usuario_id, produto);
        if (!data || !ticker) continue;

        const valor_bruto =
          toNumberBR(pick(r, ['Valor Bruto','Provento','Valor do Provento'])) ||
          toNumberBR(pick(r, ['Valor Líquido','Valor Liquido'])) ||
          toNumberBR(pick(r, ['Valor','Valor da Operação','Valor Operação']));
        const quantidade = pickNumber(pick(r, ['Quantidade','Qtd.','Qtd','QTD','Quantidade Crédito','Quantidade Credito'])) || null;
        const instituicao = pick(r, ['Instituição','Instituicao','Corretora','Conta']) || null;

        const puRaw = pick(r, ['Preço unitário','Preço Unitário','Preco Unitario','Preço','Preco','Preço Médio','Preco Medio']);
        const vtRaw = pick(r, ['Valor da Operação','Valor Operação','Valor']);
        const puCSV = toNumberBR(puRaw);
        const vtCSV = toNumberBR(vtRaw);
        const valor_total = vtCSV > 0 ? vtCSV : valor_bruto;
        const valor_unitario = puCSV > 0 ? puCSV : (quantidade && quantidade > 0 ? (valor_total / quantidade) : 0);

        const linhaProvento = {
          incluir: true,
          data,
          ticker,
          tipo: norm(movimentacao),
          valor_bruto,
          quantidade,
          instituicao,
          valor_unitario,
          valor_total
        };
        linhasProventos.push(linhaProvento);

        const tipoCanon = mapProventoTipo(movimentacao);
        const valorParaDedupe = valor_total > 0 ? valor_total : valor_bruto;
        const duplicado = await checkProventoDuplicado(usuario_id, ticker, tipoCanon, data, valorParaDedupe);
        preview.push({
          incluir: !duplicado,
          duplicado,
          usuario_id,
          data_operacao: data,
          nome_investimento: ticker,
          tipo_operacao: 'provento',
          origem: 'provento',
          quantidade: quantidade ?? 0,
          valor_unitario,
          valor_total,
          tipo: linhaProvento.tipo,
          valor_bruto: linhaProvento.valor_bruto,
          ticker: linhaProvento.ticker,
          instituicao: linhaProvento.instituicao,
          classe_id: '',
          subclasse_id: '',
        });
        continue;
      }

      // bonificação/ajuste/leilão
      let tipo = null;
      if (isBonusLike(movimentacao) && dcCredit) tipo = 'bonificacao';
      else if (isFractionLike(movimentacao) && dcDebit) tipo = 'ajuste_bonificacao';
      else if (isLeilaoFracaoLike(movimentacao) && dcCredit) tipo = 'venda';
      if (!tipo) continue;

      const data = normalizeDateBR(
        pick(r, ['Data','Data do Movimento','Data Movimentação','Data Movimentacao','Data Liquidação','Data Liquidacao'])
      );
      const produto = r['Produto'] || r['Ativo'] || r['Papel'] || r['Código do Ativo'] || r.ticker || '';
      const ticker  = await extractTickerFromProduto(usuario_id, produto);

      let qtd = pickNumber(
        pick(r, [
          'Quantidade','Qtd.','Qtd','QTD',
          'Quantidade Crédito','Quantidade Credito',
          'Quantidade Evento','Qtd Evento','Qtde Evento','Qtde'
        ])
      );
      let { pu, vt } = parseMoneyLike(r);
      if (tipo === 'venda' && (!qtd || qtd === 0) && pu > 0 && vt > 0) {
        qtd = Number((vt / pu).toFixed(6));
      }
      if (!ticker || !data || !qtd) continue;

      const item = {
        incluir: true,
        usuario_id,
        data_operacao: data,
        nome_investimento: ticker,
        tipo_operacao: tipo,
        quantidade: qtd,
        valor_unitario: (tipo === 'venda') ? pu : 0,
        valor_total:   (tipo === 'venda') ? vt : 0,
        origem: isLeilaoFracaoLike(movimentacao) ? 'leilao_fracao' : null,
        classe_id: '',
        subclasse_id: '',
      };

      // sugere classe/subclasse (mapa) + duplicidade
      const mapaQ = await db.query(
        `SELECT classe_id, subclasse_id
           FROM investimento_ticker_map
          WHERE usuario_id=$1 AND UPPER(ticker)=UPPER($2)
          LIMIT 1`,
        [usuario_id, ticker]
      );
      const mapa = mapaQ.rows?.[0] || {};

      const tiposDup = (tipo === 'ajuste_bonificacao') ? ['ajuste_bonificacao','bonificacao'] : [tipo];
      const dupQ = await db.query(
        `SELECT 1 FROM investimentos
          WHERE usuario_id=$1
            AND UPPER(nome_investimento)=UPPER($2)
            AND tipo_operacao = ANY($3::text[])
            AND ${
              (tipo === 'ajuste_bonificacao')
                ? ` (data_operacao)::date BETWEEN ($4::date - INTERVAL '2 days') AND ($4::date + INTERVAL '2 days')`
                : ` quantidade=$4 AND (data_operacao)::date = $5::date`
            }
          LIMIT 1`,
        (tipo === 'ajuste_bonificacao')
          ? [usuario_id, ticker, tiposDup, data]
          : [usuario_id, ticker, tiposDup, qtd, data]
      );
      const duplicado = dupQ.rowCount > 0;

      item.classe_id = mapa?.classe_id ?? '';
      item.subclasse_id = mapa?.subclasse_id ?? '';
      item.duplicado = duplicado;
      item.incluir = !duplicado;
      preview.push(item);
    }

    // Coalescer ajuste + leilão de mesma fração
    function coalesceFractionAuction(items) {
      const byTk = new Map();
      items.forEach((it, i) => {
        const k = it.nome_investimento.toUpperCase();
        if (!byTk.has(k)) byTk.set(k, []);
        byTk.get(k).push({ it, i });
      });
      const removed = new Set();
      const nearDays = 15;
      for (const [, arr] of byTk) {
        const ajustes = arr.filter(x => x.it.tipo_operacao === 'ajuste_bonificacao');
        const leiloes = arr.filter(x => x.it.tipo_operacao === 'venda' && x.it.origem === 'leilao_fracao');
        for (const a of ajustes) {
          const ad = new Date(a.it.data_operacao);
          for (const l of leiloes) {
            const ld = new Date(l.it.data_operacao);
            const diff = Math.abs((ld - ad) / 86400000);
            const sameQty = Math.abs(Number(a.it.quantidade) - Number(l.it.quantidade)) <= 0.000001;
            if (diff <= nearDays && sameQty) {
              removed.add(a.i); break;
            }
          }
        }
      }
      return items.filter((_, idx) => !removed.has(idx));
    }
    const previewCoalescido = coalesceFractionAuction(preview);

    // Enriquecimento final (deixa igual estrutura anterior)
    const enriched = [];
    for (const it of preview) {
      const ticker = it.nome_investimento;
      const mapaQ = await db.query(
        `SELECT classe_id, subclasse_id
           FROM investimento_ticker_map
          WHERE usuario_id=$1 AND ticker=$2
          LIMIT 1`,
        [usuario_id, ticker]
      );
      const mapa = mapaQ.rows?.[0] || {};
      const dupQ = await db.query(
        `SELECT 1 FROM investimentos
          WHERE usuario_id=$1
            AND nome_investimento=$2
            AND tipo_operacao=$3
            AND quantidade=$4
            AND (data_operacao)::date = $5::date
          LIMIT 1`,
        [usuario_id, ticker, it.tipo_operacao, it.quantidade, it.data_operacao]
      );
      enriched.push({
        ...it,
        duplicado: dupQ.rowCount > 0,
        incluir: dupQ.rowCount === 0,
        classe_id: mapa.classe_id ?? it.classe_id ?? '',
        subclasse_id: mapa.subclasse_id ?? it.subclasse_id ?? '',
      });
    }

    const unified = unifyMappingByTicker(previewCoalescido);
    const allPreview = [...unified, ...preview.filter(p => p.tipo_operacao === 'provento')];

    return res.json({ preview: allPreview, linhas: linhasProventos });
  } catch (e) {
    console.error('Erro preview movimentacao/bonificacao:', e);
    return res.status(500).json({ erro: 'Falha ao processar arquivo' });
  }
}

router.post('/b3-movimentacao', upload.single('arquivo'), buildBonusPreviewFromMov);
router.post('/b3-eventos', upload.single('arquivo'), buildBonusPreviewFromMov); // alias

// ---------------- CONFIRMAR: /b3-movimentacao/confirmar -------------------

async function confirmBonusFromMov(req, res) {
  const client = await db.connect();
  try {
    const usuario_id = req.user.id;
    const { linhas } = req.body || {};
    if (!Array.isArray(linhas) || linhas.length === 0) {
      client.release();
      return res.status(400).json({ erro: 'Nenhuma linha enviada' });
    }

    let importados = 0;
    let falhas = 0;
    const tiposRecebidos = (linhas || []).reduce((acc, l) => {
      const t = String(l?.tipo || '').toUpperCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
      acc[t || '(VAZIO)'] = (acc[t || '(VAZIO)'] || 0) + 1;
      return acc;
    }, {});
    console.log('[CONFIRM MOV] total linhas:', linhas.length, 'por tipo:', tiposRecebidos);

    let motivos = { invalidos: 0, semQtd: 0, insertErro: 0 };
    let itens = Array.isArray(linhas) ? linhas.filter(l => l && l.incluir) : [];

    const getNomeClasse = async (id) => {
      if (!id) return null;
      const r = await client.query(`SELECT nome FROM investimento_classes WHERE id=$1`, [id]);
      return r.rows?.[0]?.nome || null;
    };
    const getNomeSub = async (id) => {
      if (!id) return null;
      const r = await client.query(`SELECT nome FROM investimento_subclasses WHERE id=$1`, [id]);
      return r.rows?.[0]?.nome || null;
    };

    await client.query('BEGIN');

    for (let i = 0; i < itens.length; i++) {
      const l = itens[i];
      try {
        const data_operacao = normalizeDateBR(l.data_operacao);
        const nome          = (await extractTickerFromProduto(usuario_id, l.nome_investimento)).toUpperCase();
        const qtd           = pickNumber(l.quantidade);
        const classe_id     = l.classe_id ? Number(l.classe_id) : null;
        const subclasse_id  = l.subclasse_id ? Number(l.subclasse_id) : null;

        let tipo = String(l.tipo_operacao || '').toLowerCase();
        if (!['bonificacao','ajuste_bonificacao','venda'].includes(tipo)) tipo = 'bonificacao';

        if (!data_operacao || !nome) {
          falhas++; motivos.invalidos++; 
          console.log(`[CONFIRM MOV][skip ${i}] inválido: data='${l.data_operacao}' nome='${l.nome_investimento}'`);
          continue;
        }
        if (!qtd || Number(qtd) === 0) {
          falhas++; motivos.semQtd++;
          console.log(`[CONFIRM MOV][skip ${i}] quantidade ausente/zero para ${nome} em ${data_operacao} (tipo=${tipo})`);
          continue;
        }

        const tiposDup = (tipo === 'ajuste_bonificacao') ? ['ajuste_bonificacao','bonificacao'] : [tipo];
        const dupQ = await client.query(
          `SELECT 1 FROM investimentos
            WHERE usuario_id=$1
              AND UPPER(nome_investimento)=UPPER($2)
              AND tipo_operacao = ANY($3::text[])
              AND ${
                (tipo === 'ajuste_bonificacao')
                  ? ` (data_operacao)::date BETWEEN ($4::date - INTERVAL '2 days') AND ($4::date + INTERVAL '2 days')`
                  : ` quantidade=$4 AND (data_operacao)::date = $5::date`
              }
            LIMIT 1`,
          (tipo === 'ajuste_bonificacao')
            ? [usuario_id, nome, tiposDup, data_operacao]
            : [usuario_id, nome, tiposDup, Number(qtd || 0), data_operacao]
        );
        if (dupQ.rowCount > 0) continue;

        const catNome = (await getNomeClasse(classe_id)) ?? 'Investimentos';
        const subNome = await getNomeSub(subclasse_id);

        await client.query(
          `INSERT INTO investimentos (
             usuario_id, categoria, subcategoria, nome_investimento,
             tipo_operacao, quantidade, valor_unitario, valor_total,
             data_operacao, observacao, classe_id, subclasse_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            usuario_id, catNome, subNome, nome,
            tipo,
            Number(qtd || 0),
            Number(l.valor_unitario || 0),
            Number(l.valor_total || 0),
            data_operacao,
            'Importado B3 (Movimentação)',
            classe_id, subclasse_id
          ]
        );

        // UPSERT do mapa (requer UNIQUE(usuario_id,ticker); se não houver, simplesmente manterá múltiplas linhas)
        await client.query(
          `INSERT INTO investimento_ticker_map (usuario_id, ticker, classe_id, subclasse_id)
           VALUES ($1, UPPER($2), $3, $4)
           ON CONFLICT (usuario_id, ticker) DO UPDATE
           SET classe_id = EXCLUDED.classe_id, subclasse_id = EXCLUDED.subclasse_id`,
          [usuario_id, nome, classe_id || null, subclasse_id || null]
        );

        importados++;
      } catch (err) {
        falhas++; motivos.insertErro++; 
        console.log(`[CONFIRM MOV][err ${i}]`, err?.message);
      }
    }

    await client.query('COMMIT');
    client.release();

    console.log('[CONFIRM MOV] resumo => importados:', importados, 'falhas:', falhas, 'motivos:', motivos);
    return res.json({ importados, falhas, motivos });
  } catch (e) {
    console.error('Erro confirmar movimentacao/bonificacao:', e);
    try { await db.query('ROLLBACK'); } catch {}
    return res.status(500).json({ erro: 'Falha ao confirmar importação' });
  }
}

router.post('/b3-movimentacao/confirmar', express.json(), confirmBonusFromMov);
router.post('/b3-eventos/confirmar', express.json(), confirmBonusFromMov); // alias

// ---------------- PROVENTOS (preview + confirmar) -------------------------

function extractTickerBasic(prod) {
  const raw = String(prod || '').trim();
  if (!raw) return '';
  const left = raw.split(' - ')[0].trim();
  const token = (left.match(/[A-Z]{2,8}\d{0,2}/i) || [left])[0];
  return String(token || left).toUpperCase();
}

// PREVIEW: recebe o arquivo de movimentações e devolve somente as linhas de PROVENTOS
async function previewProventosFromMov(req, res) {
  try {
    const usuario_id = req.user.id;
    const file = req.file;
    if (!file) return res.status(400).json({ erro: 'Arquivo não enviado' });

    const wb = readWorkbookFromBuffer(file.buffer, file.originalname);
    const rows = sheetToJsonFirst(wb);

    const out = [];
    for (const r of rows) {
      const movimentacao = pick(r, ['Movimentação','Movimentacao','Evento','Histórico','Historico','Descrição','Descricao']);
      const dcRaw        = pick(r, ['Entrada/Saída','Entrada/Saida','D/C','DC','Sinal']);
      const isCredito    = isCreditLike(dcRaw);
      if (!isProventoLike(movimentacao) || !isCredito) continue;

      const data = normalizeDateBR(
        pick(r, ['Data','Data do Movimento','Data Movimentação','Data Movimentacao','Data Liquidação','Data Liquidacao'])
      );

      const produto = pick(r, ['Produto','Ativo','Papel','Produto/Ativo','Descrição do Ativo','Descricao do Ativo']);
      const ticker  = extractTickerBasic(produto);

      const valor = toNumberBR(
        pick(r, ['Valor da Operação','Valor Liquido','Valor Líquido','Valor do Evento','Valor do Provento','Valor'])
      );

      const quantidade = toNumberBR(pick(r, ['Quantidade','Qtde','Qtd']));

      const precoUnitCSV = toNumberBR(pick(r, ['Preço Unitário','Preco Unitario','Preço','Preco','Preço Médio','Preco Medio']));
      const valorOperCSV = toNumberBR(pick(r, ['Valor da Operação','Valor Operação','Valor']));
      const valor_total  = (valorOperCSV && valorOperCSV > 0) ? valorOperCSV : valor;
      const valor_unitario = (precoUnitCSV && precoUnitCSV > 0)
        ? precoUnitCSV
        : ((quantidade && quantidade > 0) ? (valor_total / quantidade) : 0);

      const instituicao = pick(r, ['Instituição','Instituicao','Corretora']) || null;

      if (!data || !ticker || !valor || valor <= 0) continue;

      const tipoCanon = mapProventoTipo(movimentacao);
      const valorParaDedupe = (valor_total && valor_total > 0) ? valor_total : valor;
      const duplicado = await checkProventoDuplicado(usuario_id, ticker, tipoCanon, data, valorParaDedupe);

      out.push({
        incluir: !duplicado,
        duplicado,
        data,
        ticker,
        tipo: tipoCanon,
        valor_bruto: valor,
        quantidade: quantidade || null,
        instituicao,
        valor_unitario,
        valor_total
      });
    }

    return res.json({ linhas: out });
  } catch (e) {
    console.error('Erro preview proventos/movimentacao:', e);
    return res.status(500).json({ erro: 'Falha ao construir preview de proventos' });
  }
}

// CONFIRMAR: insere em tabela proventos, evitando duplicados (fallback em investimentos)
async function confirmProventosFromMov(req, res) {
  const client = await db.connect();
  try {
    const usuario_id = req.user.id;
    const { linhas } = req.body || {};
    if (!Array.isArray(linhas) || linhas.length === 0) {
      client.release();
      return res.status(400).json({ erro: 'Nenhuma linha enviada' });
    }

    let importados = 0;
    let falhas = 0;
    console.log('[CONFIRM PROV] total linhas recebidas:', linhas.length);

    // existe a tabela proventos?
    const tExists = await db.query(
      `SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='proventos'
        LIMIT 1`
    );
    const hasProventosTable = tExists.rowCount > 0;

    await client.query('BEGIN');

    for (const l of linhas) {
      try {
        if (l.incluir === false) continue;

        const data  = normalizeDateBR(l.data || l.data_operacao);
        const rawT  = String(l.tipo || '').toUpperCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
        const tipo  = (rawT.includes('JCP') || rawT.includes('JUROS') || (rawT.includes('CAPITAL') && rawT.includes('PROPRIO')))
                        ? 'JCP'
                        : (rawT.includes('REND') ? 'RENDIMENTO'
                          : (rawT.includes('AMORT') ? 'AMORTIZACAO' : 'DIVIDENDO'));
        const tick  = String(l.ticker || l.nome_investimento || '').toUpperCase().trim();
        const valor = toNumberBR(l.valor_bruto ?? l.valor_total);
        const qtd   = l.quantidade != null ? toNumberBR(l.quantidade) : null;
        const obs   = l.instituicao || 'Importado B3 (Provento)';

        if (!data || !tick || !valor || valor <= 0 || !tipo) {
          falhas++; 
          console.log('[CONFIRM PROV][skip]', { data, tick, valor, tipo });
          continue;
        }

        // dedupe (proventos OU investimentos)
        const dup1 = await client.query(
          `SELECT 1 FROM proventos
            WHERE usuario_id=$1
              AND UPPER(ticker)=UPPER($2)
              AND UPPER(tipo)=UPPER($3)
              AND (data)::date = $4::date
              AND ABS(valor_bruto - $5) < 0.01
            LIMIT 1`,
          [usuario_id, tick, tipo, data, valor]
        );
        let dup = dup1.rowCount > 0;
        if (!dup) {
          const dup2 = await client.query(
            `SELECT 1 FROM investimentos
              WHERE usuario_id=$1
                AND UPPER(nome_investimento)=UPPER($2)
                AND LOWER(tipo_operacao)='provento'
                AND (data_operacao)::date = $3::date
                AND ABS(valor_total - $4) < 0.01
              LIMIT 1`,
            [usuario_id, tick, data, valor]
          );
          dup = dup2.rowCount > 0;
        }
        if (dup) continue;

        let inserted = false;
        if (hasProventosTable) {
          try {
            await client.query(
              `INSERT INTO proventos
                (usuario_id, ticker, nome_ativo, tipo, data, quantidade, valor_bruto, imposto, observacao)
               VALUES ($1, UPPER($2), NULL, $3, $4, $5, $6, 0, $7)`,
              [usuario_id, tick, tipo, data, qtd, valor, obs]
            );
            inserted = true;
          } catch (e) {
            // se falhar por schema/constraints, cai no fallback
          }
        }
        if (!inserted) {
          const unit = (qtd && qtd > 0) ? (valor / qtd) : 0;
          await client.query(
            `INSERT INTO investimentos (
               usuario_id, categoria, subcategoria, nome_investimento,
               tipo_operacao, quantidade, valor_unitario, valor_total,
               data_operacao, observacao, classe_id, subclasse_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              usuario_id, 'Investimentos', null, tick,
              'provento',
              Number(qtd || 0),
              Number(unit || 0),
              Number(valor || 0),
              data,
              obs,
              null, null
            ]
          );
        }
        importados++;
      } catch (err) {
        falhas++; console.log('[CONFIRM PROV][err]', err?.message);
      }
    }

    await client.query('COMMIT');
    client.release();

    console.log('[CONFIRM PROV] resumo => importados:', importados, 'falhas:', falhas);
    return res.json({ importados, falhas });
  } catch (e) {
    console.error('Erro confirmar proventos/movimentacao:', e);
    try { await db.query('ROLLBACK'); } catch {}
    return res.status(500).json({ erro: 'Falha ao confirmar proventos' });
  }
}

router.post('/b3-movimentacao/proventos', upload.single('arquivo'), previewProventosFromMov);
router.post('/b3-movimentacao/proventos/confirmar', express.json(), confirmProventosFromMov);

module.exports = router;