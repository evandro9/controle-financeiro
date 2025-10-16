// backend/Controllers/investimentosController.js  (Postgres)
const db = require('../database/db');
const { format } = require('date-fns');
const yahooFinance = require('yahoo-finance2').default;
const { baseTicker } = require('../utils/importacaoB3Utils');

// ---------- Helpers que preservam a lógica original ----------

// Normalização de chaves p/ map (ticker OU nome RF)
function gerarVariantesChave(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return [];
  const variantes = new Set();
  // B3: 4+ letras + 1-2 dígitos (com ou sem sufixo .SA)
  const isB3Like = /^[A-Z]{4,}[0-9]{1,2}(\.[A-Z]+)?$/.test(s);
  if (isB3Like) {
    const semSuf = s.replace(/\..*$/, '');
    variantes.add(semSuf);          // VALE3
    variantes.add(`${semSuf}.SA`);  // VALE3.SA
    variantes.add(s);               // original
    return Array.from(variantes);
  }
  // EUA/geral (AAPL, VOO, etc.)
  if (/^[A-Z0-9.\-]+$/.test(s)) {
    const semSuf = s.replace(/\..*$/, '');
    variantes.add(semSuf);
    variantes.add(s);
    return Array.from(variantes);
  }
  // RF / nomes “com espaço”: usamos o nome inteiro em CAIXA ALTA (colapsado)
  variantes.add(s.replace(/\s+/g, ' ').trim());
  return Array.from(variantes);
}
function chavePrimaria(raw) {
  const vars = gerarVariantesChave(raw);
  return vars[0] || '';
}

async function getNomeClasseById(id) {
  if (!id) return null;
  const { rows } = await db.query(`SELECT nome FROM investimento_classes WHERE id=$1`, [id]);
  return rows?.[0]?.nome || null;
}
async function getNomeSubclasseById(id) {
  if (!id) return null;
  const { rows } = await db.query(`SELECT nome FROM investimento_subclasses WHERE id=$1`, [id]);
  return rows?.[0]?.nome || null;
}

async function upsertTickerMap(usuario_id, ticker, classe_id, subclasse_id) {
  if (!ticker) return;
  const variantes = gerarVariantesChave(ticker);
  const prim = chavePrimaria(ticker);
  if (!prim) return;

  // Atualiza quaisquer variações existentes (case-insensitive)
  const upd = await db.query(
    `UPDATE investimento_ticker_map
        SET classe_id=$3, subclasse_id=$4
      WHERE usuario_id=$1
        AND UPPER(ticker) = ANY($2::text[])`,
    [usuario_id, variantes.map(v => v.toUpperCase()), classe_id || null, subclasse_id || null]
  );

  // Se não havia nenhuma linha, insere uma (mantendo a lógica do original)
  if (upd.rowCount === 0) {
    // Se existir UNIQUE(usuario_id,ticker), ótimo; se não existir, ainda assim preserva o comportamento
    await db.query(
      `INSERT INTO investimento_ticker_map (usuario_id, ticker, classe_id, subclasse_id)
       VALUES ($1,$2,$3,$4)`,
      [usuario_id, prim, classe_id || null, subclasse_id || null]
    );
  }
}

function formatTicker(ticker) {
  return `${ticker}.SA`;
}
function getUltimoDiaMes(ano, mes) {
  return new Date(ano, mes, 0); // último dia do mês
}

// ===================== CONTROLLERS =====================

exports.atualizarCotacoes = async (req, res) => {
  try {
    const usuarioId = req.user.id;

    // 1️⃣ Buscar todos os ativos do usuário (Ação BR, FII, ETF)
    const ativosQ = await db.query(
      `SELECT DISTINCT nome_investimento
         FROM investimentos
        WHERE usuario_id = $1
          AND (subcategoria = 'Ação BR' OR subcategoria = 'FII' OR subcategoria = 'ETF')`,
      [usuarioId]
    );
    const ativos = ativosQ.rows || [];
    if (ativos.length === 0) {
      return res.json({ message: "Nenhum ativo para atualizar", atualizados: [] });
    }

    const atualizados = [];

    for (const { nome_investimento } of ativos) {
      const ticker = nome_investimento;
      const tickerFormatado = formatTicker(ticker);

      // 2️⃣ Intervalo de datas (desde a 1ª operação até hoje)
      const primeiraCompraQ = await db.query(
        `SELECT MIN((data_operacao)::date) AS primeira_data
           FROM investimentos
          WHERE usuario_id = $1 AND nome_investimento = $2`,
        [usuarioId, ticker]
      );
      const primeiraData = primeiraCompraQ.rows?.[0]?.primeira_data;
      if (!primeiraData) continue;

      const dataInicial = new Date(primeiraData);
      const hoje = new Date();

      // 3️⃣ Últimos dias de cada mês até hoje
      const datasReferencia = [];
      let ano = dataInicial.getFullYear();
      let mes = dataInicial.getMonth() + 1;

      while (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes <= (hoje.getMonth() + 1))) {
        const ultimoDia = getUltimoDiaMes(ano, mes);
        if (ano === hoje.getFullYear() && mes === (hoje.getMonth() + 1)) {
          datasReferencia.push(hoje); // mês atual → hoje
        } else {
          datasReferencia.push(ultimoDia);
        }
        mes++;
        if (mes > 12) { mes = 1; ano++; }
      }

      // 4️⃣ Histórico do ativo no Yahoo
      const start = new Date(dataInicial.getFullYear(), dataInicial.getMonth(), 1);
      const history = await yahooFinance.historical(tickerFormatado, { period1: start });

      // 5️⃣ Para cada data de referência, usa o último preço disponível ≤ data
      for (const dataRef of datasReferencia) {
        const dataRefStr = dataRef.toISOString().split("T")[0];
        const precoObj = [...history].reverse().find(c => new Date(c.date) <= dataRef);
        if (!precoObj || !precoObj.close) continue;

        const precoUnitario = Number(precoObj.close);

        // 6️⃣ Quantidade acumulada até a data
        const qtdQ = await db.query(
          `SELECT COALESCE(SUM(CASE WHEN tipo_operacao='compra' THEN quantidade ELSE -quantidade END),0)::numeric AS quantidade
             FROM investimentos
            WHERE usuario_id=$1
              AND nome_investimento=$2
              AND (data_operacao)::date <= $3::date`,
          [usuarioId, ticker, dataRefStr]
        );
        const quantidade = Number(qtdQ.rows?.[0]?.quantidade || 0);
        const valorTotal = quantidade * precoUnitario;

        // 7️⃣ Upsert em valores_atuais por (usuario_id, nome_investimento, data_referencia)
        const existeQ = await db.query(
          `SELECT id
             FROM valores_atuais
            WHERE usuario_id = $1
              AND nome_investimento = $2
              AND (data_referencia)::date = $3::date
            LIMIT 1`,
          [usuarioId, ticker, dataRefStr]
        );

        if (existeQ.rowCount > 0) {
          await db.query(
            `UPDATE valores_atuais
                SET preco_unitario = $1, valor_total = $2
              WHERE id = $3`,
            [precoUnitario, valorTotal, existeQ.rows[0].id]
          );
        } else {
          await db.query(
            `INSERT INTO valores_atuais (usuario_id, nome_investimento, data_referencia, preco_unitario, valor_total)
             VALUES ($1,$2,$3,$4,$5)`,
            [usuarioId, ticker, dataRefStr, precoUnitario, valorTotal]
          );
        }

        atualizados.push({ ticker, data: dataRefStr, preco: precoUnitario, quantidade, valor_total: valorTotal });
      }
    }

    res.json({ message: "Cotações e valores históricos atualizados com sucesso", atualizados });
  } catch (err) {
    console.error("❌ Erro ao atualizar cotações:", err);
    res.status(500).json({ error: "Erro interno ao atualizar cotações" });
  }
};

exports.criarInvestimento = async (req, res) => {
  try {
    const usuario_id = req.user.id;
    let {
      categoria, subcategoria, nome_investimento,
      tipo_operacao, quantidade, valor_unitario,
      valor_total, data_operacao, observacao,
      classe_id, subclasse_id,
      // ---- RF (opcionais) ----
      metodo_valorizacao, indexador, taxa_anual, percentual_cdi,
      data_inicio, vencimento, base_dias,
      // ---- Come-cotas (fundos) ----
      come_cotas, aliquota_comecotas,
      valor_unitario_usd, cotacao_usd_brl
    } = req.body;

    classe_id = classe_id ? Number(classe_id) : null;
    subclasse_id = subclasse_id ? Number(subclasse_id) : null;

    // Preenche nomes a partir dos IDs (categoria é NOT NULL no seu schema)
    if (!categoria) categoria = (await getNomeClasseById(classe_id)) || 'Investimentos';
    if (!subcategoria) subcategoria = await getNomeSubclasseById(subclasse_id);

    const total = (valor_total != null)
      ? Number(valor_total)
      : Number(quantidade || 0) * Number(valor_unitario || 0);

    // ---- Normalização RF ----
    const idx = (indexador || '').toString().trim().toUpperCase() || null; // 'PRE' | 'CDI' | 'IPCA' | null
    const taxaAnualDec = (idx === 'PRE' || idx === 'IPCA') && isFinite(Number(taxa_anual))
      ? Number(taxa_anual) : null; // decimal (ex.: 0.12)
    const pctCDI = (idx === 'CDI') && isFinite(Number(percentual_cdi))
      ? Number(percentual_cdi) : null; // ex.: 110
    const metVal = idx ? (metodo_valorizacao || 'AUTOMATICO') : null;
    const baseDias = idx ? (Number(base_dias) || 252) : null;
    const dtInicio = idx ? (data_inicio || data_operacao || null) : null;
    const dtVenc   = idx ? (vencimento || null) : null;
    const comecotasOn = idx ? (come_cotas ? 1 : 0) : null;
    const aliCome = idx && come_cotas ? Number(aliquota_comecotas) : null;

    const sql = `INSERT INTO investimentos (
      usuario_id, categoria, subcategoria, nome_investimento,
      tipo_operacao, quantidade, valor_unitario, valor_total,
      data_operacao, observacao, classe_id, subclasse_id,
      metodo_valorizacao, indexador, taxa_anual, percentual_cdi, data_inicio, vencimento, base_dias,
      come_cotas, aliquota_comecotas, valor_unitario_usd, cotacao_usd_brl
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
    ) RETURNING id`;

    const r = await db.query(sql, [
      usuario_id, categoria, subcategoria ?? null, nome_investimento,
      tipo_operacao, Number(quantidade || 0), Number(valor_unitario || 0), Number(total || 0),
      data_operacao, observacao || null, classe_id, subclasse_id,
      metVal, idx, taxaAnualDec, pctCDI, dtInicio, dtVenc, baseDias,
      comecotasOn, aliCome,
      isFinite(Number(valor_unitario_usd)) ? Number(valor_unitario_usd) : null,
      isFinite(Number(cotacao_usd_brl)) ? Number(cotacao_usd_brl) : null
    ]);

    // Atualiza/insere mapeamento do ticker para próximas vezes
    if (classe_id) await upsertTickerMap(usuario_id, nome_investimento, classe_id, subclasse_id);

    return res.status(201).json({ id: r.rows?.[0]?.id });
  } catch (err) {
    console.error('Erro ao cadastrar investimento:', err);
    return res.status(500).json({ erro: 'Erro ao cadastrar investimento' });
  }
};

exports.listarInvestimentos = async (req, res) => {
  try {
    const usuario_id = req.user.id;
    const { nome, ano, mes, limite } = req.query;

    if (nome && nome.trim() !== '') {
      const { rows } = await db.query(
        `SELECT * FROM investimentos
          WHERE usuario_id = $1 AND nome_investimento ILIKE $2
          ORDER BY data_operacao DESC`,
        [usuario_id, `%${nome.trim()}%`]
      );
      return res.json(rows);
    }

    let sql = `SELECT * FROM investimentos WHERE usuario_id = $1`;
    const params = [usuario_id];
    let i = 2;

    if (ano && ano !== 'todos') {
      sql += ` AND to_char((data_operacao)::date, 'YYYY') = $${i++}`;
      params.push(String(ano));
    }
    if (mes && mes !== 'todos') {
      sql += ` AND to_char((data_operacao)::date, 'MM') = $${i++}`;
      params.push(String(mes).padStart(2, '0'));
    }

    sql += ` ORDER BY data_operacao DESC`;

    const limiteFinal = limite === '0' ? null : parseInt(limite, 10) || 10;
    if (limiteFinal) {
      sql += ` LIMIT $${i++}`;
      params.push(limiteFinal);
    }

    const { rows } = await db.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error('Erro SQL:', err);
    return res.status(500).json({ erro: 'Erro ao listar investimentos' });
  }
};

exports.editarInvestimento = async (req, res) => {
  try {
    const usuario_id = req.user.id;
    const { id } = req.params;
    let {
      categoria, subcategoria, nome_investimento,
      tipo_operacao, quantidade, valor_unitario,
      valor_total, data_operacao, observacao,
      classe_id, subclasse_id,
      // ---- RF (opcionais) ----
      metodo_valorizacao, indexador, taxa_anual, percentual_cdi,
      data_inicio, vencimento, base_dias,
      // ---- Come-cotas (fundos) ----
      come_cotas, aliquota_comecotas, valor_unitario_usd, cotacao_usd_brl
    } = req.body;

    classe_id = classe_id ? Number(classe_id) : null;
    subclasse_id = subclasse_id ? Number(subclasse_id) : null;

    // Se vieram IDs, garantimos os nomes consistentes (categoria é NOT NULL)
    if (!categoria && classe_id != null) categoria = (await getNomeClasseById(classe_id)) || 'Investimentos';
    if (!subcategoria && subclasse_id != null) subcategoria = await getNomeSubclasseById(subclasse_id);

    const total = (valor_total != null)
      ? Number(valor_total)
      : Number(quantidade || 0) * Number(valor_unitario || 0);

    // ---- Normalização RF ----
    const idx = (indexador || '').toString().trim().toUpperCase() || null;
    const taxaAnualDec = (idx === 'PRE' || idx === 'IPCA') && isFinite(Number(taxa_anual))
      ? Number(taxa_anual) : null;
    const pctCDI = (idx === 'CDI') && isFinite(Number(percentual_cdi))
      ? Number(percentual_cdi) : null;
    const metVal = idx ? (metodo_valorizacao || 'AUTOMATICO') : null;
    const baseDias = idx ? (Number(base_dias) || 252) : null;
    const dtInicio = idx ? (data_inicio || data_operacao || null) : null;
    const dtVenc   = idx ? (vencimento || null) : null;
    const comecotasOn = idx ? (come_cotas ? 1 : 0) : null;
    const aliCome = idx && come_cotas ? Number(aliquota_comecotas) : null;

    const sql = `UPDATE investimentos SET
      categoria = $1, subcategoria = $2, nome_investimento = $3,
      tipo_operacao = $4, quantidade = $5, valor_unitario = $6,
      valor_total = $7, data_operacao = $8, observacao = $9,
      classe_id = $10, subclasse_id = $11,
      metodo_valorizacao = $12, indexador = $13, taxa_anual = $14, percentual_cdi = $15, data_inicio = $16, vencimento = $17, base_dias = $18,
      come_cotas = $19, aliquota_comecotas = $20,
      valor_unitario_usd = $21, cotacao_usd_brl = $22
      WHERE id = $23 AND usuario_id = $24`;

    await db.query(sql, [
      categoria, subcategoria ?? null, nome_investimento,
      tipo_operacao, Number(quantidade || 0), Number(valor_unitario || 0),
      Number(total || 0), data_operacao, observacao || null,
      classe_id, subclasse_id,
      metVal, idx, (idx ? (taxaAnualDec) : null), (idx ? (pctCDI) : null),
      (idx ? (dtInicio) : null), (idx ? (dtVenc) : null), (idx ? (baseDias) : null),
      (idx ? (comecotasOn) : null), (idx ? (aliCome) : null),
      isFinite(Number(valor_unitario_usd)) ? Number(valor_unitario_usd) : null,
      isFinite(Number(cotacao_usd_brl)) ? Number(cotacao_usd_brl) : null,
      id, usuario_id
    ]);

    if (classe_id) await upsertTickerMap(usuario_id, nome_investimento, classe_id, subclasse_id);

    return res.status(200).json({ sucesso: true });
  } catch (err) {
    console.error('Erro ao atualizar investimento:', err);
    return res.status(500).json({ erro: 'Erro ao atualizar investimento' });
  }
};

exports.deletarInvestimento = async (req, res) => {
  try {
    const usuario_id = req.user.id;
    const { id } = req.params;
    await db.query(`DELETE FROM investimentos WHERE id = $1 AND usuario_id = $2`, [id, usuario_id]);
    return res.status(200).json({ sucesso: true });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao deletar investimento' });
  }
};

exports.listarTodosInvestimentos = async (req, res) => {
  try {
    const usuario_id = req.user.id;
    const { rows } = await db.query(
      `SELECT * FROM investimentos WHERE usuario_id = $1 ORDER BY data_operacao DESC`,
      [usuario_id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao listar investimentos' });
  }
};

// GET /investimentos/ticker-map?ticker=...
exports.getTickerMap = async (req, res) => {
  try {
    const uid = req.user.id;
    const variantes = gerarVariantesChave(String(req.query.ticker || ''));
    if (!variantes.length) return res.status(400).json({ erro: 'ticker obrigatório' });

    const { rows } = await db.query(
      `SELECT classe_id, subclasse_id
         FROM investimento_ticker_map
        WHERE usuario_id=$1
          AND UPPER(ticker) = ANY($2::text[])
        LIMIT 1`,
      [uid, variantes.map(v => v.toUpperCase())]
    );
    return res.json(rows?.[0] || {});
  } catch (err) {
    return res.status(500).json({ erro: 'Falha ao obter mapa' });
  }
};