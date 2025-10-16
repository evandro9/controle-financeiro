// 1) LEITURA DO EXCEL/CSV
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');
const crypto = require('crypto');



function readMatrix(buffer, filename='') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) {
    const txt = buffer.toString('utf8');
    return parse(txt, { delimiter: ';', relax_quotes: true, relax_column_count: true });
  }
  // ⚠️ raw:true => preserva números como Number (não vira string formatada)
  const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false, cellNF: false, cellText: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws, { header: 1, raw: true });
}

// 2) PARSE NUMÉRICO INTELIGENTE
function toNumberSmart(v) {
  if (typeof v === 'number') return v;         // já é Number do xlsx
  if (!v) return 0;
  let s = String(v).trim();

  // remove "R$" e espaços
  s = s.replace(/\s/g, '').replace(/^R\$/i, '');

  // Casos:
  // a) "1.234,56" (pt-BR): vírgula = decimal
  // b) "1234.56"  (US):    ponto   = decimal
  // c) "1,234.56" (US com milhar): remove a vírgula de milhar
  // d) "1.234" sem vírgula pode ser milhar, então se não houver vírgula, ponto é decimal se existirem no máx 2 dígitos após.
  if (/,/.test(s) && /\./.test(s)) {
    // Tem os dois separadores: assume vírgula como decimal e ponto como milhar
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/,/.test(s)) {
    // Só vírgula: decimal BR
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\./.test(s)) {
    // Só ponto: decimal US (não remover!)
    // Se for "1.234" e parecer milhar (>=4 dígitos antes do ponto e nada depois), trate como milhar
    const m = s.match(/^(\d+)\.(\d{3})(?!\d)/);
    if (m && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// 3) NORMALIZAÇÃO DE OPERAÇÃO E TICKER
function normOperacao(op='') {
  const s = String(op).toLowerCase();
  if (s.includes('compra') || s === 'c' || s === 'buy') return 'compra';
  if (s.includes('venda')  || s === 'v' || s === 'sell') return 'venda';
  return 'compra';
}

function baseTicker(t='') {
  let x = String(t).trim().toUpperCase();
  // Corrige erros comuns e fracionário
  x = x.replace(/[^A-Z0-9]/g, '');   // tira lixo
  x = x.replace(/F$/, '');           // ITUB4F -> ITUB4
  // Casos de digitação: ITUBE4 -> ITUB4
  x = x.replace(/^ITUBE(\d)$/, 'ITUB$1');
  return x;
}

// 4) PARSE DAS LINHAS (mapeando seus cabeçalhos reais da planilha B3)
function parseRows(rows) {
  const headers = rows[0].map(h => (h||'').toString().trim().toLowerCase());
  const idx = keys => headers.findIndex(h => keys.some(k => h.includes(k)));

  const iData  = idx(['data do negócio','data do negocio','data']);
  const iTipo  = idx(['tipo de movimentação','tipo de movimentacao','operação','operacao']);
  const iMerc  = idx(['mercado']);
  const iInst  = idx(['instituição','instituicao']);
  const iCode  = idx(['código de negociação','codigo de negociacao','ticker','ativo']);
  const iQtd   = idx(['quantidade','qtd']);
  const iPreco = idx(['preço','preco','valor unit']);
  const iTotal = idx(['valor','valor total','vl total']);

  const items = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const data = row[iData];
    const dataISO = typeof data === 'string'
      ? data.split('/').reverse().join('-') // 10/07/2025 -> 2025-07-10
      : // datas do Excel (serial) não vieram no teu arquivo, mas se vierem: trata aqui
        (row[iData] && row[iData].toISOString ? row[iData].toISOString().slice(0,10) : '');

    const ticker = baseTicker(row[iCode] || '');
    const tipo   = normOperacao(row[iTipo] || '');
    const qtd    = toNumberSmart(row[iQtd]);
    const preco  = toNumberSmart(row[iPreco]);
    const total  = iTotal >= 0 ? toNumberSmart(row[iTotal]) : (qtd * preco);

    if (!dataISO || !ticker || !qtd || !preco) continue;

    // Marca mercado fracionário “F” (sem poluir ticker canônico)
    const mercado = (String(row[iMerc]||'').toLowerCase().includes('fracion')) ? 'fracionario' : 'vista';

    items.push({
      data_operacao: dataISO,
      nome_investimento: ticker,     // canônico (sem F)
      mercado,                       // 'vista' | 'fracionario'
      tipo_operacao: tipo,           // 'compra' | 'venda'
      quantidade: qtd,
      valor_unitario: preco,
      valor_total: total,
      observacao: `Importado B3 (${mercado})`
    });
  }
  return items;
}

async function parseB3Negociacao(buffer, filename='') {
  const rows = readMatrix(buffer, filename);
  const items = parseRows(rows);
  return { items, meta: { linhas: items.length, arquivo: filename } };
}

function importHash(item, usuario_id) {
  // normaliza e gera chave estável por usuário + operação
  const s = [
    usuario_id,
    (item.data_operacao || '').slice(0,10),
    (item.nome_investimento || '').toUpperCase(),
    (item.tipo_operacao || '').toLowerCase(),
    Number(item.quantidade || 0).toFixed(4),
    Number(item.valor_unitario || 0).toFixed(4),
  ].join('|');
  return crypto.createHash('sha1').update(s).digest('hex');
}
module.exports = { parseB3Negociacao, toNumberSmart, baseTicker, importHash };