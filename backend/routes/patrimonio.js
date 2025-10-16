const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth');

/** Helpers simples (promisify) */
function run(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (e) { e ? reject(e) : resolve(this); })
  );
}
function get(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (e, row) => e ? reject(e) : resolve(row))
  );
}
function all(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (e, rows) => e ? reject(e) : resolve(rows))
  );
}

/** Cálculo de taxa mensal “quase TWR”
 * saldo_prev = saldo mês anterior (0 se não houver)
 * fluxo = aportes - retiradas
 * rent_liq = saldo_atual - saldo_prev - fluxo
 * base = saldo_prev + 0.5*fluxo  (aproximação)
 * taxa = (base ~ 0 ? 0 : rent_liq / base)
 */
function calcTaxaMensal(saldo_prev, saldo_atual, aportes = 0, retiradas = 0) {
  const fluxo = Number(aportes || 0) - Number(retiradas || 0);
  const rent_liq = Number(saldo_atual || 0) - Number(saldo_prev || 0) - fluxo;
  const base = Number(saldo_prev || 0) + 0.5 * fluxo;
  const eps = 1e-9;
  const taxa = Math.abs(base) < eps ? 0 : rent_liq / base;
  return { taxa, base: Math.max(Math.abs(base), eps), rent_liq, fluxo };
}

/** =========================================
 *  CONTAS
 * ========================================= */
router.get('/contas', autenticar, async (req, res) => {
  try {
    const rows = await all(
      `SELECT * FROM patrimonio_contas WHERE usuario_id = ? ORDER BY ativa DESC, nome`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/contas', autenticar, async (req, res) => {
  try {
    const { nome, instituicao, tipo, cor_hex, ativa = 1 } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });
    const r = await run(
      `INSERT INTO patrimonio_contas (usuario_id, nome, instituicao, tipo, cor_hex, ativa)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, nome, instituicao || null, tipo || null, cor_hex || null, ativa ? 1 : 0]
    );
    const row = await get(`SELECT * FROM patrimonio_contas WHERE id=? AND usuario_id=?`, [r.lastID, req.user.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/contas/:id', autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, instituicao, tipo, cor_hex, ativa = 1 } = req.body;
    await run(
      `UPDATE patrimonio_contas
         SET nome=?, instituicao=?, tipo=?, cor_hex=?, ativa=?
       WHERE id=? AND usuario_id=?`,
      [nome, instituicao || null, tipo || null, cor_hex || null, ativa ? 1 : 0, id, req.user.id]
    );
    const row = await get(`SELECT * FROM patrimonio_contas WHERE id=? AND usuario_id=?`, [id, req.user.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/contas/:id', autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    // Apaga os saldos primeiro e depois a conta, de forma atômica
    await run('BEGIN');
    await run(
      `DELETE FROM patrimonio_saldos WHERE conta_id=? AND usuario_id=?`,
      [id, req.user.id]
    );
    await run(
      `DELETE FROM patrimonio_contas WHERE id=? AND usuario_id=?`,
      [id, req.user.id]
    );
    await run('COMMIT');
    res.json({ sucesso: true, removidos: { saldos: true, conta: true } });
  } catch (e) { 
    try { await run('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: e.message }); }
});

/** =========================================
 *  SALDOS (snapshots mensais)
 * ========================================= */
router.get('/saldos', autenticar, async (req, res) => {
  try {
    const { ano, mes } = req.query;
    if (!ano || !mes) return res.status(400).json({ error: 'Informe ano e mes' });

    const rows = await all(
      `SELECT s.*, c.nome AS conta_nome, c.instituicao, c.tipo, c.cor_hex
         FROM patrimonio_saldos s
         JOIN patrimonio_contas c ON c.id = s.conta_id
        WHERE s.usuario_id = ? AND s.ano = ? AND s.mes = ?
        ORDER BY conta_nome`,
      [req.user.id, Number(ano), Number(mes)]
    );

    // Anexar taxa mensal calculada (comparando com mês anterior da mesma conta)
    const withTaxa = await Promise.all(rows.map(async (r) => {
  const prev = await get(
    `SELECT saldo, aportes, retiradas
       FROM patrimonio_saldos
      WHERE usuario_id = ? AND conta_id = ? AND (
              (ano = ? AND mes = ?) OR
              (ano = ? AND mes = ?)
            )
      ORDER BY ano DESC, mes DESC
      LIMIT 1`,
    [req.user.id, r.conta_id,
     Number(r.ano), Number(r.mes) - 1,
     Number(r.ano) - 1, 12] // mês 1 considera dez/ano-1
  );

      const saldo_prev = prev?.saldo || 0;
      const { taxa, base, rent_liq, fluxo } = calcTaxaMensal(saldo_prev, r.saldo, r.aportes, r.retiradas);
      return { ...r, taxa, base, rent_liq, fluxo, saldo_prev };
    }));

    res.json(withTaxa);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/saldos', autenticar, async (req, res) => {
  try {
    const { conta_id, ano, mes, saldo, aportes = 0, retiradas = 0, obs } = req.body;
    if (!conta_id || !ano || !mes) return res.status(400).json({ error: 'conta_id, ano e mes são obrigatórios' });

    // UPSERT pelo UNIQUE(usuario,conta,ano,mes)
    await run(
      `INSERT INTO patrimonio_saldos (usuario_id, conta_id, ano, mes, saldo, aportes, retiradas, obs)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(usuario_id, conta_id, ano, mes) DO UPDATE SET
         saldo=excluded.saldo,
         aportes=excluded.aportes,
         retiradas=excluded.retiradas,
         obs=excluded.obs`,
      [req.user.id, conta_id, Number(ano), Number(mes), Number(saldo || 0), Number(aportes || 0), Number(retiradas || 0), obs || null]
    );
    const row = await get(
      `SELECT * FROM patrimonio_saldos WHERE usuario_id=? AND conta_id=? AND ano=? AND mes=?`,
      [req.user.id, conta_id, Number(ano), Number(mes)]
    );
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/saldos/:id', autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { saldo, aportes = 0, retiradas = 0, obs } = req.body;
    await run(
      `UPDATE patrimonio_saldos
          SET saldo=?, aportes=?, retiradas=?, obs=?
        WHERE id=? AND usuario_id=?`,
      [Number(saldo || 0), Number(aportes || 0), Number(retiradas || 0), obs || null, id, req.user.id]
    );
    const row = await get(`SELECT * FROM patrimonio_saldos WHERE id=? AND usuario_id=?`, [id, req.user.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** =========================================
 *  EVOLUÇÃO (para gráficos)
 *  - Por conta: ?conta_id=...&ano=2025
 *  - Total consolidado do usuário (se omitir conta_id)
 * ========================================= */
router.get('/evolucao', autenticar, async (req, res) => {
  try {
    const { conta_id, ano } = req.query;
    const anoNum = Number(ano) || new Date().getFullYear();

    if (conta_id) {
      // Evolução da conta específica
      const rows = await all(
        `SELECT ano, mes, saldo, aportes, retiradas
           FROM patrimonio_saldos
          WHERE usuario_id=? AND conta_id=? AND ano=?
          ORDER BY mes`,
        [req.user.id, Number(conta_id), anoNum]
      );

      // Base inicial: dezembro do ano anterior (se existir)
const dezAnt = await get(
  `SELECT saldo FROM patrimonio_saldos
    WHERE usuario_id=? AND conta_id=? AND ano=? AND mes=12`,
  [req.user.id, Number(conta_id), anoNum - 1]
);

// anexar taxa vs mês anterior (considerando dez/ano-1 para jan)
let prevSaldo = Number(dezAnt?.saldo || 0);
let prevMes = 12;
      const serie = rows.map(r => {
        const { taxa } = calcTaxaMensal(prevSaldo, r.saldo, r.aportes, r.retiradas);
        prevSaldo = r.saldo;
        prevMes = r.mes;
        return { ano: r.ano, mes: r.mes, saldo: r.saldo, taxa };
      });

      return res.json(serie);
    }

    // Evolução consolidada do usuário (todas as contas)
    // Passo 1: pegar todos os saldos do ano
    const saldos = await all(
      `SELECT conta_id, mes, saldo, aportes, retiradas
         FROM patrimonio_saldos
        WHERE usuario_id=? AND ano=?
        ORDER BY conta_id, mes`,
      [req.user.id, anoNum]
    );

    // Agrupar por mês e calcular total_saldo (mês sem linhas = 0)
    const byMes = Array.from({ length: 12 }, (_, i) => ({
      ano: anoNum, mes: i + 1, total_saldo: 0, taxa_ponderada: 0
    }));
    // Também vamos contar presença de linhas por mês (pra achar “primeiro” e “último” com dado)
    const temLinhaNoMes = new Array(12).fill(false);

    // Para taxa ponderada precisamos da taxa de cada conta e sua base
    // Vamos montar caches do mês anterior por conta
    const prevPorConta = new Map(); // conta_id -> saldo_prev
    // Para janeiro, usamos dez/ano-1 apenas para a BASE de taxa (não para total_saldo)

    const basesDezAnt = await all(
  `SELECT conta_id, saldo FROM patrimonio_saldos
    WHERE usuario_id=? AND ano=? AND mes=12`,
  [req.user.id, anoNum - 1]
);

    // Primeiro, acumular saldos por mês
    for (const r of saldos) {
      const idx = r.mes - 1;
      if (idx >= 0 && idx < 12) {
        byMes[idx].total_saldo += Number(r.saldo || 0);
        temLinhaNoMes[idx] = true;
      }
    }

    // Agora calcular taxa ponderada por mês
    for (let m = 1; m <= 12; m++) {
      let somaPesoTaxa = 0;
      let somaPeso = 0;

      const doMes = saldos.filter(s => s.mes === m);
     for (const s of doMes) {
  // para janeiro usar dez/ano-1; depois, o último saldo visto
  let prevSaldo = prevPorConta.get(s.conta_id);
  if (prevSaldo == null) {
    const baseDez = basesDezAnt.find(b => b.conta_id === s.conta_id);
    prevSaldo = Number(baseDez?.saldo || 0);
  }
        const { taxa, base } = calcTaxaMensal(prevSaldo, s.saldo, s.aportes, s.retiradas);
        somaPesoTaxa += taxa * base;
        somaPeso += base;
        prevPorConta.set(s.conta_id, s.saldo);
      }

      const taxaPond = somaPeso > 0 ? (somaPesoTaxa / somaPeso) : 0;
      byMes[m - 1].taxa_ponderada = taxaPond;
    }

        // Totais por mês (shape conveniente para a tabela)
    const totais_por_mes = byMes.reduce((acc, r) => {
      acc[r.mes] = Number(r.total_saldo || 0);
      return acc;
    }, {});

    // Evolução no ano: do primeiro mês COM LINHA ao último mês COM LINHA
    const primeiroIdx = temLinhaNoMes.findIndex(Boolean);
    const ultimoIdx = temLinhaNoMes.lastIndexOf(true);
    let anual = { valor_inicial: null, valor_final: null, evolucao_no_ano: null };
    if (primeiroIdx !== -1 && ultimoIdx !== -1 && primeiroIdx <= ultimoIdx) {
      const inicial = Number(byMes[primeiroIdx].total_saldo || 0);
      const final = Number(byMes[ultimoIdx].total_saldo || 0);
      anual.valor_inicial = inicial;
      anual.valor_final = final;
      anual.evolucao_no_ano = (inicial > 0) ? ((final - inicial) / inicial) : null;
    }

    // Novo shape (mais completo) para o consolidado
    res.json({
      ano: anoNum,
      meses: byMes,
      totais_por_mes,
      anual
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** =========================================
 *  OBJETIVO ANUAL
 * ========================================= */
router.get('/objetivo', autenticar, async (req, res) => {
  try {
    const { ano } = req.query;
    if (!ano) return res.status(400).json({ error: 'Informe ano' });
    const row = await get(
      `SELECT * FROM patrimonio_objetivos WHERE usuario_id=? AND ano=?`,
      [req.user.id, Number(ano)]
    );
    res.json(row || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/objetivo', autenticar, async (req, res) => {
  try {
    const { ano, objetivo, base_inicial } = req.body;
    if (!ano || objetivo == null) return res.status(400).json({ error: 'ano e objetivo são obrigatórios' });

    await run(
      `INSERT INTO patrimonio_objetivos (usuario_id, ano, objetivo, base_inicial)
       VALUES (?,?,?,?)
       ON CONFLICT(usuario_id, ano) DO UPDATE SET
         objetivo=excluded.objetivo,
         base_inicial=excluded.base_inicial`,
      [req.user.id, Number(ano), Number(objetivo), base_inicial != null ? Number(base_inicial) : null]
    );

    const row = await get(
      `SELECT * FROM patrimonio_objetivos WHERE usuario_id=? AND ano=?`,
      [req.user.id, Number(ano)]
    );
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** =========================================
 *  OVERVIEW (um hit para a tela)
 *  ?ano=2025&mes=07
 *  Retorna:
 *   - contas do mês (com taxa por conta)
 *   - total_saldo, taxa_ponderada
 *   - objetivo do ano + progresso + aporte_mensal_sugerido
 * ========================================= */
router.get('/overview', autenticar, async (req, res) => {
  try {
    const { ano, mes } = req.query;
    if (!ano || !mes) return res.status(400).json({ error: 'Informe ano e mes' });

    const anoNum = Number(ano), mesNum = Number(mes);

    // 1) Saldos do mês (com taxa por conta)
    const saldosMes = await all(
      `SELECT s.*, c.nome AS conta_nome, c.instituicao, c.tipo, c.cor_hex
         FROM patrimonio_saldos s
         JOIN patrimonio_contas c ON c.id = s.conta_id
        WHERE s.usuario_id = ? AND s.ano = ? AND s.mes = ?
        ORDER BY conta_nome`,
      [req.user.id, anoNum, mesNum]
    );

    const saldosComTaxa = await Promise.all(saldosMes.map(async (r) => {
      const prev = await get(
        `SELECT saldo FROM patrimonio_saldos
          WHERE usuario_id=? AND conta_id=? AND (
            (ano=? AND mes=?) OR (ano=? AND mes=?)
          )`,
        [req.user.id, r.conta_id, anoNum, mesNum - 1, anoNum - 1, 12]
      );
      const prevSaldo = prev?.saldo || 0;
      const { taxa, base } = calcTaxaMensal(prevSaldo, r.saldo, r.aportes, r.retiradas);
      return { ...r, taxa, base, saldo_prev: prevSaldo };
    }));

    const total_saldo = saldosComTaxa.reduce((acc, r) => acc + Number(r.saldo || 0), 0);

    // 2) Taxa ponderada do mês
    const somaPeso = saldosComTaxa.reduce((acc, r) => acc + (r.base || 0), 0);
    const somaPesoTaxa = saldosComTaxa.reduce((acc, r) => acc + (r.taxa * (r.base || 0)), 0);
    const taxa_ponderada = somaPeso > 0 ? (somaPesoTaxa / somaPeso) : 0;

    // 3) Objetivo + progresso
    const objetivo = await get(
      `SELECT * FROM patrimonio_objetivos WHERE usuario_id=? AND ano=?`,
      [req.user.id, anoNum]
    );

    let objetivo_ano = objetivo?.objetivo || null;
    let base_inicial = objetivo?.base_inicial || null;

    if (objetivo_ano == null) objetivo_ano = null; // não cadastrado
    // se base_inicial não foi definida, podemos usar o total de Jan (se existir)
    if (base_inicial == null) {
      const janRows = await all(
        `SELECT SUM(saldo) AS total FROM patrimonio_saldos
          WHERE usuario_id=? AND ano=? AND mes=1`,
        [req.user.id, anoNum]
      );
      base_inicial = Number(janRows?.[0]?.total || 0);
    }

    const atual = total_saldo;
    const perc_atingida = (objetivo_ano ? (atual / objetivo_ano) : 0);
    const faltante = (objetivo_ano ? Math.max(0, objetivo_ano - atual) : null);
    const meses_restantes = 12 - mesNum + 1;
    const aporte_mensal_sugerido = (objetivo_ano && meses_restantes > 0)
      ? (faltante / meses_restantes)
      : null;

    res.json({
      contas: saldosComTaxa,
      total_saldo,
      taxa_ponderada,
      objetivo: {
        ano: anoNum,
        objetivo: objetivo_ano,
        base_inicial
      },
      progresso: {
        atual,
        perc_atingida,
        faltante,
        aporte_mensal_sugerido,
        meses_restantes
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;