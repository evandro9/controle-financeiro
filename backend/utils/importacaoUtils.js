// backend/utils/importacaoUtils.js
const crypto = require('crypto');

// ===== Normalização =====
function normStr(s = '') {
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\w\s/.-]/g, ' ')     // mantém números/letras, espaço e alguns separadores úteis
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseValorBR(str = '') {
  // aceita "1.234,56" ou "1234.56"
  const s = String(str).replace(/\s/g, '').replace(/R\$/i, '');
  if (/,/.test(s) && /\./.test(s)) {
    // se tem ponto e vírgula, assume BR: remove pontos, troca vírgula por ponto
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  if (/,/.test(s) && !/\./.test(s)) {
    // só vírgula => decimal brasileiro
    return parseFloat(s.replace(',', '.'));
  }
  return parseFloat(s);
}

function toISODate(d) {
  // tenta vários formatos comuns: DD/MM/YYYY, YYYY-MM-DD, etc.
  if (!d) return null;
  // OFX pode vir com sufixo de fuso: 20250722000000[-3:BRT]
  const s = String(d).trim().replace(/\[.*\]$/, '');
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  // OFX: YYYYMMDD ou YYYYMMDDHHMMSS
  if (/^\d{8,14}$/.test(s)) {
    const yyyy = s.slice(0,4), mm = s.slice(4,6), dd = s.slice(6,8);
    return `${yyyy}-${mm}-${dd}`;
  }
  // fallback: Date.parse
  const dt = new Date(s);
  if (!isNaN(dt)) return dt.toISOString().slice(0,10);
  return null;
}

// Normaliza data de OFX (DTPOSTED) para YYYY-MM-DD
function normOfxDate(s) {
  if (!s) return null;
  const clean = String(s).replace(/\[.*\]$/, ''); // remove sufixo de timezone
  return toISODate(clean); // já cobre YYYYMMDD e YYYYMMDDHHMMSS
}


// ===== Hash de dedupe =====
function hashDedupe({ data_lancamento, data_vencimento, valor, descricao }) {
  const base = [
    (data_lancamento || '').slice(0,10),
    (data_vencimento || '').slice(0,10),
    Number(valor).toFixed(2),
    normStr(descricao || '')
  ].join('|');
  return crypto.createHash('sha1').update(base).digest('hex');
}

// ===== Heurísticas de parcela/recorrência =====
function detectParcelado(descricao) {
  const s = normStr(descricao);
  const m = s.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (m) {
    const atual = parseInt(m[1],10), total = parseInt(m[2],10);
    if (atual >= 1 && total >= atual) return { ehParcela: true, atual, total };
  }
  if (/\bparc/.test(s) || /\bparcel/.test(s)) return { ehParcela: true, atual: null, total: null };
  return { ehParcela: false };
}

function detectRecorrente(descricao) {
  const s = normStr(descricao);
  const palavras = ['mensalidade','assinatura','aluguel','stream','netflix','spotify','prime','icloud'];
  const hit = palavras.some(p => s.includes(p));
  return { ehRecorrente: !!hit };
}

// ===== Regras de categorização =====
// ===== Regras de categorização =====
function aplicaRegras(descricao, valor = null, regras = []) {
  const s = normStr(descricao);
  for (const r of regras) {
    const pad = normStr(r.padrao || '');
    const bateDescricao =
      (r.tipo_match === 'equals'   && s === pad) ||
      (r.tipo_match === 'contains' && s.includes(pad)) ||
      (r.tipo_match === 'regex'    && (() => { try { return new RegExp(r.padrao,'i').test(descricao); } catch { return false; }})());

    if (bateDescricao) {
      // Se a regra tiver valor_fixo, exigir igualdade (2 casas)
      if (r.valor_fixo != null) {
        const vRegra = Number(r.valor_fixo);
        const vLinha = Number(valor);
        if (Number.isFinite(vRegra) && Number.isFinite(vLinha) &&
            vRegra.toFixed(2) === vLinha.toFixed(2)) {
          return { categoria_id: r.categoria_id, subcategoria_id: r.subcategoria_id, regra: r };
        }
        // descrição bateu, mas valor não → tenta próxima regra
        continue;
      }
      // Sem valor_fixo: comportamento antigo
      return { categoria_id: r.categoria_id, subcategoria_id: r.subcategoria_id, regra: r };
    }
  }
  return null;
}

// ===== Parser CSV =====
// sem dependências externas: CSV simples (se precisar evoluir: trocar por 'csv-parse')
function parseCSV(conteudo) {
  const linhas = conteudo.split(/\r?\n/).filter(l => l.trim().length);
  if (linhas.length === 0) return [];
  const sep = linhas[0].includes(';') ? ';' : ',';
  const headers = linhas[0].split(sep).map(h => h.trim());
  const rows = [];
  for (let i=1;i<linhas.length;i++){
    const cols = linhas[i].split(sep);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (cols[idx] ?? '').trim());
    rows.push(obj);
  }
  return rows;
}

// ===== Parser OFX (mínimo) =====
function parseOFX(conteudo) {
  // extrai <STMTTRN>...</STMTTRN>
  const trs = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m;
  while ((m = re.exec(conteudo)) !== null) {
    const bloco = m[1];
    const get = (tag) => {
      const mm = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]+)`,'i'));
      return mm ? mm[1].trim() : '';
    };
    const dtposted = get('DTPOSTED');   // ex.: 20250722000000[-3:BRT]
    const trnamt   = get('TRNAMT');     // ex.: -123.45
    const trntype  = get('TRNTYPE');    // DEBIT/CREDIT
    const fitid    = get('FITID');
    const memo     = get('MEMO') || get('NAME') || '';
  const dateIso = normOfxDate(dtposted);   // -> YYYY-MM-DD
  trs.push({
    type: trntype,
    date: dateIso,
    DTPOSTED: dtposted,                    // ⬅️ mantém o original para fallback
    amount: parseFloat(trnamt),
    fitid,
    memo
  });
  }
  return trs;
}

// === Helpers Faturas (cartão de crédito) ===
function parseParcela(raw='') {
  const s = String(raw).trim();
  if (!s || s === '-') return { atual: null, total: null };
  let m = s.match(/(\d+)\s*de\s*(\d+)/i);
  if (m) return { atual: Number(m[1]), total: Number(m[2]) };
  m = s.match(/de\s*(\d+)$/i);
  if (m) return { atual: 1, total: Number(m[1]) };
  return { atual: null, total: null };
}

// calcula data de vencimento (YYYY-MM-DD) a partir do dia de vencimento do cartão
function calcVencimento(isoDataReferencia, diaVencimento = 1) {
  if (!isoDataReferencia) return null;
  const [Y,M] = isoDataReferencia.split('-').map(Number);
  const dt = new Date(Date.UTC(Y, (M||1)-1, 1));
  dt.setUTCMonth(dt.getUTCMonth() + 1); // vencimento no mês seguinte
  const ultimo = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth()+1, 0)).getUTCDate();
  const dia = Math.min(Number(diaVencimento) || 1, ultimo);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth()+1).padStart(2,'0');
  const dd = String(dia).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

// CSV de Fatura — cabeçalho típico: Data;Estabelecimento;Portador;Valor;Parcela
function parseFaturaCsv({ csvText, cartaoId = null, diaVencimento = 1 }) {
  const lines = String(csvText||'').replace(/\r/g,'').split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines.shift();
  const sep = header.includes(';') ? ';' : ',';

  const idx = {};
  header.split(sep).forEach((h, i) => {
    const k = normStr(h);
    if (k.includes('data')) idx.data = i;
    else if (k.includes('estabelecimento') || k.includes('descricao')) idx.estab = i;
    else if (k.includes('valor')) idx.valor = i;
    else if (k.includes('parcela')) idx.parcela = i;
    else if (k.includes('portador')) idx.portador = i;
  });

  const out = [];
  for (const line of lines) {
    const cols = line.split(sep);
    const dmy = (cols[idx.data] || '').trim(); // 07/07/2025
    const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(dmy);
    if (!m) continue;
    const [_, dd, mm, yyyy] = m;
    const iso = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

    const descricao = (cols[idx.estab] || '').trim();
    const valor = parseValorBR(cols[idx.valor] || '0');
    const { atual, total } = parseParcela(cols[idx.parcela] || '');

    // ignorar pagamento/recebimento de fatura
    const descNorm = normStr(descricao);
    if (descNorm.includes('pagamento de fatura') || descNorm.includes('pagamento recebido')) continue;

    const tipo = (Number(valor) < 0) ? 'receita' : 'despesa';
    const preview = {
      categoria_id: null,
      subcategoria_id: null,
      data_lancamento: iso,                                // data da compra
      data_vencimento: calcVencimento(iso, diaVencimento), // venc. do cartão
      valor: Math.abs(Number(valor) || 0),
      descricao_normalizada: descNorm,
      tipo,
      parcelado: !!total,
      parcela_atual: total ? (atual || 1) : null,
      parcela_total: total || null,
      grupo_parcela_id: null, // pode evoluir depois
    };

    out.push({ descricao, valor: Number(valor) || 0, preview });
  }
  return out;
}

// OFX de Fatura (ex.: Nubank crédito)
function parseFaturaOfx({ ofxText, cartaoId = null, diaVencimento = 1 }) {
  const blocos = String(ofxText||'').split(/<STMTTRN>/i).slice(1);
  const out = [];
  for (const b of blocos) {
    const seg = b.split(/<\/STMTTRN>/i)[0] || '';
    const trntype = (seg.match(/<TRNTYPE>([^<]+)/i)?.[1] || '').toUpperCase(); // CREDIT/DEBIT
    const dt = seg.match(/<DTPOSTED>(\d{8})/i)?.[1] || ''; // YYYYMMDD
    const amt = Number(seg.match(/<TRNAMT>(-?\d+(?:\.\d+)?)/i)?.[1] || '0');
    const memo = (seg.match(/<MEMO>([^<]*)/i)?.[1] || seg.match(/<NAME>([^<]*)/i)?.[1] || '').trim();
    const fitid = (seg.match(/<FITID>([^<]+)/i)?.[1] || '').trim();

    if (!dt) continue;
    const iso = `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}`;

    const memoNorm = normStr(memo);
    if (trntype === 'CREDIT' && (memoNorm.includes('pagamento recebido') || memoNorm.includes('pagamento fatura'))) {
      continue; // ignora pagamento da fatura
    }

    const tipo = amt < 0 ? 'despesa' : 'receita';
    const valorAbs = Math.abs(amt);

    const preview = {
      categoria_id: null,
      subcategoria_id: null,
      data_lancamento: iso,
      data_vencimento: calcVencimento(iso, diaVencimento),
      valor: Number(valorAbs.toFixed(2)),
      descricao_normalizada: memoNorm,
      tipo,
      parcelado: false,
      parcela_atual: null,
      parcela_total: null,
      grupo_parcela_id: null,
      fitid
    };

    out.push({ descricao: memo || '(sem descrição)', valor: Number(amt.toFixed(2)), preview });
  }
  return out;
}

// === utils de data ===
function toISODate(s) {
  if (!s) return null;
  s = String(s).trim();

  // dd/mm/yyyy
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // yyyy-mm-dd
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // yyyyMMdd (OFX)
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // tenta Date
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return null;
}

function addMonthsClamp(iso, months) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  // último dia do mês alvo
  const lastOfTarget = new Date(y, (m - 1) + months + 1, 0).getDate();
  const dia = Math.min(d, lastOfTarget);
  const dt = new Date(y, (m - 1) + months, dia);
  return dt.toISOString().slice(0, 10);
}

// Se cair sábado/domingo, empurra para a próxima segunda-feira.
function shiftToNextBusinessDay(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m - 1), d));
  let wd = dt.getUTCDay(); // 0=dom, 6=sáb
  if (wd === 6) dt.setUTCDate(dt.getUTCDate() + 2); // sábado -> +2
  else if (wd === 0) dt.setUTCDate(dt.getUTCDate() + 1); // domingo -> +1
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2,'0');
  const dd = String(dt.getUTCDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

 function computeCardDueDate(dataLanc, diaVenc, diaFech) {
   if (!dataLanc || !diaVenc) return null;
   const [y, m, d] = dataLanc.split('-').map(Number);
   const addMonths = (yy, mm, add) => {
     const dt = new Date(yy, (mm - 1) + add, 1);
     return [dt.getFullYear(), dt.getMonth() + 1];
   };
   const lastDay = (yy, mm) => new Date(yy, mm, 0).getDate();

   if (diaFech) {
     // competência do ciclo
     const [cyY, cyM] = (d <= diaFech) ? [y, m] : addMonths(y, m, 1);
    // vencimento é no MESMO mês da competência
    const [vy, vm] = [cyY, cyM];
     const dia = Math.min(Number(diaVenc), lastDay(vy, vm));
     return `${vy}-${String(vm).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
   } else {
     // sem fechamento → mesmo mês da data_lancamento
     const dia = Math.min(Number(diaVenc), lastDay(y, m));
     return `${y}-${String(m).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
   }
 }

 // Vencimento para parcelas ANCORADO na primeira fatura:
//  - dataCompra: 'YYYY-MM-DD' (data da compra original)
//  - atual: número da parcela atual (1..N)
//  - diaVenc: 1..31
//  - diaFech: 1..31 (nullable)
// Regra:
//   1) Definir a COMPETÊNCIA da 1ª parcela:
//        se dia(compra) <= diaFech → competência = mês(compra)
//        senão                     → competência = mês(compra) + 1
//   2) 1º vencimento = diaVenc no mês (competência + 1)
//   3) Parcela 'atual' vence em: 1º vencimento + (atual - 1) meses
//   (sempre com clamp de fim de mês; sem pular fds aqui)
function computeCardInstallmentDueDate(dataCompra, atual, diaVenc, diaFech) {
  if (!dataCompra || !diaVenc || !Number.isFinite(Number(atual))) return null;
  const [y, m, d] = dataCompra.split('-').map(Number);
  const addMonths = (yy, mm, add) => {
    const dt = new Date(yy, (mm - 1) + add, 1);
    return [dt.getFullYear(), dt.getMonth() + 1];
  };
  const lastDay = (yy, mm) => new Date(yy, mm, 0).getDate();

  // 1) competência da primeira fatura
  let cyY = y, cyM = m;
  if (diaFech && d > Number(diaFech)) {
    [cyY, cyM] = addMonths(y, m, 1);
  }
  // 2) 1º vencimento: MESMO mês da competência
  let [vy, vm] = [cyY, cyM];
  let dia = Math.min(Number(diaVenc), lastDay(vy, vm));
  // 3) parcela atual: somar (atual - 1) meses ao 1º vencimento
  if (Number(atual) > 1) {
    [vy, vm] = addMonths(vy, vm, Number(atual) - 1);
    dia = Math.min(Number(diaVenc), lastDay(vy, vm));
  }
  return `${vy}-${String(vm).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
}

// --- DETECÇÃO DO TIPO DO ARQUIVO (extrato x fatura) ---

function detectDocTypeFromOFX(text) {
  const t = String(text || '').toUpperCase();
  let scoreF = 0, scoreE = 0;
  // Sinais de fatura (cartão)
  if (t.includes('<CREDITCARDMSGSRSV1')) scoreF += 3;
  if (t.includes('<CCSTMTRS') || t.includes('<CCACCTFROM')) scoreF += 2;
  // Sinais de extrato (bancário)
  if (t.includes('<BANKMSGSRSV1')) scoreE += 3;
  if (t.includes('<STMTRS') || t.includes('<BANKACCTFROM') || t.includes('<ACCTTYPE>')) scoreE += 2;

  const tipo = scoreF > scoreE ? 'fatura' : (scoreE > scoreF ? 'extrato' : 'desconhecido');
  const total = Math.max(scoreF, scoreE);
  const conf = total >= 4 ? 0.95 : total >= 3 ? 0.8 : total >= 2 ? 0.6 : 0.5;
  const signals = { scoreF, scoreE };
  return { tipo, confidence: conf, signals };
}

function detectDocTypeFromCSV(headerLine, sampleRows = []) {
  const H = (headerLine || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase();

  const has = (...keys) => keys.some(k => H.includes(k));

  let scoreF = 0, scoreE = 0;
  // Fatura: cabeçalhos típicos
  if (has('data compra','data da compra','parcela','n parcela','nr parcela')) scoreF += 2;
  if (has('venc','vencimento')) scoreF += 1;
  // Extrato: cabeçalhos típicos
  if (has('saldo','documento','agencia','historico','lancamento')) scoreE += 2;
  if (has('data','descricao') && !has('parcela')) scoreE += 1;

  // Conteúdo: procurar "3/12" etc. em descrição
  const parcelaRegex = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/;
  const anyParcela = sampleRows.some(r => parcelaRegex.test((r || '').toString().toLowerCase()));
  if (anyParcela) scoreF += 2;

  const tipo = scoreF > scoreE ? 'fatura' : (scoreE > scoreF ? 'extrato' : 'desconhecido');
  const total = Math.max(scoreF, scoreE);
  const conf = total >= 4 ? 0.9 : total >= 3 ? 0.75 : total >= 2 ? 0.6 : 0.5;
  const signals = { scoreF, scoreE, anyParcela };
  return { tipo, confidence: conf, signals };
}

function detectDocTypeFromBuffer(buf, filename = '') {
  const name = (filename || '').toLowerCase();
  const asText = buf.toString('utf8');

  // Heurística: se tem <OFX> é OFX
  if (asText.trim().toUpperCase().includes('<OFX')) {
    return detectDocTypeFromOFX(asText);
  }
  // CSV: primeira linha como header
  const [firstLine, ...rest] = asText.split(/\r?\n/);
  const sample = rest.slice(0, 10);
  return detectDocTypeFromCSV(firstLine, sample);
}

module.exports = {
  normStr, parseValorBR, toISODate, normOfxDate,
  hashDedupe, detectParcelado, detectRecorrente,
  aplicaRegras, parseCSV, parseOFX, parseFaturaCsv, parseFaturaOfx,
  toISODate, addMonthsClamp, computeCardDueDate, computeCardInstallmentDueDate, shiftToNextBusinessDay,
  detectDocTypeFromBuffer
};