const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
// Helpers de precificação/índices (sem usar valores_atuais)
const { toYahoo, buildPriceSeriesFor, lastPxOnOrBefore, buildFXSeriesUSDBRL, fxOnOrBefore, valorRFnaData } = require('../utils/invest-helpers'); 
const { exigirRecurso } = require('../middleware/assinaturaRecursos');

// exige usuário autenticado
router.use(auth);
// exige plano com recurso premium
router.use(exigirRecurso('investimentos_premium'));

// GET /investimentos/atuais?classe_id=&subclasse_id=&classe=&subclasse=
router.get('/', async (req, res) => {
  try {
    const usuario_id = req.user.id;
    const { classe_id, subclasse_id, classe, subclasse } = req.query;
    console.log('[INV-ATUAIS] filtros', { usuario_id, classe_id, subclasse_id, classe, subclasse });   

    // Descobre o nome da classe pelo ID (para detectar "Caixa" por contexto)
    let nomeClasseCtx = null;
    if (classe_id) {
      try {
        const rC = await db.query('SELECT nome FROM investimento_classes WHERE id=$1', [Number(classe_id)]);
        nomeClasseCtx = rC.rows?.[0]?.nome || null;
      } catch {}
    }
    console.log('[INV-ATUAIS] classeCtx', { classe_id, nomeClasseCtx });    

    // --- Filtros opcionais por classe/subclasse (id preferencial; nome como fallback) ---
    const whereInv = ['i.usuario_id = $1'];
    const paramsInv = [usuario_id];

    if (classe_id) {
      whereInv.push(`i.classe_id = $${paramsInv.length + 1}`);
      paramsInv.push(Number(classe_id));
    }
    if (subclasse_id) {
      whereInv.push(`i.subclasse_id = $${paramsInv.length + 1}`);
      paramsInv.push(Number(subclasse_id));
    }
    // compat: se não veio id, permite filtrar por nome (case-insensitive)
    if (!classe_id && classe) {
      whereInv.push(`UPPER(c.nome) = UPPER($${paramsInv.length + 1})`);
      paramsInv.push(String(classe));
    }
    if (!subclasse_id && subclasse) {
      whereInv.push(`UPPER(s.nome) = UPPER($${paramsInv.length + 1})`);
      paramsInv.push(String(subclasse));
    }

    // --- Movimentações do usuário (ordenadas por data) ---
    const rInv = await db.query(
      `
      SELECT
        i.nome_investimento,
        c.nome AS categoria,
        s.nome AS subcategoria,
        i.tipo_operacao,
        i.quantidade,
        i.valor_unitario,
        i.valor_total,
        i.data_operacao,
        i.indexador,
        i.taxa_anual,
        i.percentual_cdi,
        i.base_dias,
        i.come_cotas,
        i.aliquota_comecotas
      FROM investimentos i
      LEFT JOIN investimento_classes c   ON c.id = i.classe_id
      LEFT JOIN investimento_subclasses s ON s.id = i.subclasse_id
      WHERE ${whereInv.join(' AND ')}
      ORDER BY i.data_operacao::date ASC
      `,
      paramsInv
    );
    const investimentos = rInv.rows;
console.log('[INV-ATUAIS] movimentacoes:', investimentos.length);    

    // Se não há fluxos, não há posição
    if (!investimentos.length) return res.json([]);

    // === Precificação on-demand (Yahoo p/ ações/ETFs/FIIs/BDRs; fórmula p/ RF/Tesouro/Caixa) ===
    // 1) Agrupa fluxos por ativo
    const porAtivo = new Map();
    for (const inv of investimentos) {
      const nome = inv.nome_investimento;
      if (!porAtivo.has(nome)) {
        porAtivo.set(nome, {
          cfg: { ...inv }, // guarda o último cfg visto p/ esse ativo
          fluxos: [],
          investido: 0,
          categoria: inv.categoria,
          subcategoria: inv.subcategoria,
        });
      }
      const st = porAtivo.get(nome);
      const tipo = String(inv.tipo_operacao || '').toLowerCase();
      const isCompra = /compra|buy|aplic/.test(tipo);
      const isVenda  = /vend|sell|resgat|amortiz|saida|saída|resgate/.test(tipo);
      const qtd = Number(inv.quantidade || 0) * (isVenda ? -1 : +1);
      const vt  = Number(inv.valor_total || 0) * (isVenda ? -1 : +1);
      st.fluxos.push({ data: inv.data_operacao, tipo: inv.tipo_operacao, quantidade: qtd, valor_total: vt, sinal: (isVenda ? -1 : +1) });
      if (isCompra) st.investido += Number(inv.valor_total || 0);
      // atualiza cfg com campos de RF caso existam
      st.cfg.indexador = inv.indexador;
      st.cfg.taxa_anual = inv.taxa_anual;
      st.cfg.percentual_cdi = inv.percentual_cdi;
      st.cfg.base_dias = inv.base_dias;
      st.cfg.come_cotas = inv.come_cotas;
      st.cfg.aliquota_comecotas = inv.aliquota_comecotas;
    }

    // 2) Quantidades atuais por ativo (ignora posições zeradas/short)
    const hoje = new Date();
    const hojeISO = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())).toISOString().slice(0, 10);
    const quantidades = new Map();
    for (const [nome, st] of porAtivo) {
      const q = (st.fluxos || []).reduce((acc, f) => acc + Number(f.quantidade || 0), 0);
      if (q > 0) quantidades.set(nome, q);
    }
    if (quantidades.size === 0) return res.json([]);

    // 3) Monta lista de equities (com ticker Yahoo) para cotação
    const equities = [];
    let menorData = hojeISO;
    for (const [nome, st] of porAtivo) {
      const yf = toYahoo(nome);
      if (yf) equities.push({ nome, yf });
      const d0 = (st.fluxos[0] && String(st.fluxos[0].data).slice(0, 10)) || hojeISO;
      if (d0 < menorData) menorData = d0;
    }
    const priceSeries = equities.length ? await buildPriceSeriesFor(equities, menorData, hojeISO, 7, 'adj') : new Map();
    const precisaFX = equities.some(e => !String(e.yf || '').endsWith('.SA'));
    const fx = precisaFX ? await buildFXSeriesUSDBRL(menorData, hojeISO, 15) : null;

    // distribuição por categoria para debug
    const distCat = {};
    for (const [nome, st] of porAtivo) {
      const k = String(st.categoria || '—').toUpperCase();
      distCat[k] = (distCat[k] || 0) + 1;
    }
    console.log('[INV-ATUAIS] ativos únicos:', porAtivo.size, 'por categoria:', distCat);

    // 4) Calcula valor atual por ativo
    const calculado = [];
    for (const [nome, st] of porAtivo) {
      const qtd = quantidades.get(nome) || 0;
      if (qtd <= 0) continue;
      const sub = String(st.subcategoria || '').toUpperCase();
      const idx = String(st.cfg?.indexador || '').toUpperCase();
      const cat = String(st.categoria || '').toUpperCase();
      let valor = 0;
      // Renda Fixa / Tesouro: marcação na curva / PU
      if (/TESOURO/.test(sub.toUpperCase()) || /^(PRE|IPCA|CDI)$/.test(idx)) {
        try {
          valor = await valorRFnaData(st.cfg, st.fluxos, hojeISO, null, {});
        } catch {
          valor = 0;
        }
      } else {
        // Ações/ETFs/FIIs/BDRs/Cripto via Yahoo
        const ps = priceSeries.get(nome);
        let px = ps ? lastPxOnOrBefore(ps, hojeISO) : null;
        if (px && precisaFX) {
          const yf = toYahoo(nome);
          if (yf && !yf.endsWith('.SA')) {
            const fxv = fxOnOrBefore(fx, hojeISO) || 0;
            if (fxv) px = px * fxv;
          }
        }
        // Fallback: sem ticker/indexador → saldo por fluxo
        if (!valor || valor <= 0) {
          valor = (st.fluxos || []).reduce((acc, f) => acc + (Number(f.sinal || 0) * Math.abs(Number(f.valor_total) || 0)), 0);
        }
      }
      calculado.push({
        nome_investimento: nome,
        categoria: st.categoria,
        subcategoria: st.subcategoria,
        quantidade: Number(qtd),
        valor_unitario: (Number(qtd) > 0 && Number.isFinite(valor)) ? (valor / Number(qtd)) : 0,
        valor_atual: Number(valor) || 0,
        valor_investido: Number(st.investido || 0),
      });
    }

    const resultado = calculado;
    const somaAtual = resultado.reduce((a,b)=>a+Number(b.valor_atual||0),0);
    console.log('[INV-ATUAIS] retorno itens:', resultado.length, 'soma=', somaAtual.toFixed(2));
    if (somaAtual === 0) console.log('[INV-ATUAIS] somaAtual==0 (pizza tende a mostrar "sem dados")');
    if (!resultado.length) console.log('[INV-ATUAIS] vazio (verifique filtros / classe_id)');

    res.json(resultado);
  } catch (err) {
    console.error('❌ [/investimentos/atuais] erro:', err);
    res.status(500).json({ erro: 'Erro ao listar posição atual' });
  }
});

// exporta o Router diretamente (evita "argument handler must be a function")
module.exports = router;