// routes/analisesRecorrentesRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth');

router.get('/recorrencia-mensal', autenticar, async (req, res) => {
  try {
    const ano = parseInt(req.query.ano, 10);
    const mes = parseInt(req.query.mes, 10) || (new Date().getMonth() + 1);
 const usuarioId = Number(req.user?.id);
 if (!Number.isFinite(usuarioId)) {
   return res.status(401).json({ error: 'Não autenticado' });
 }
    if (!ano)       return res.status(400).json({ error: 'Parâmetro ano é obrigatório' });

    const ym = `${ano}-${String(mes).padStart(2, '0')}`;

    // Receita do mês (status pago/pendente)
    const rec = await db.query(`
      SELECT COALESCE(SUM(valor),0) AS total
      FROM lancamentos
      WHERE usuario_id = $1
        AND lower(tipo) = 'receita'
        AND lower(status) IN ('pago','paga','pendente')
        AND TO_CHAR(data_lancamento::date, 'YYYY-MM') = $2
    `, [usuarioId, ym]);

    // Despesa do mês
    const desp = await db.query(`
      SELECT COALESCE(SUM(valor),0) AS total
      FROM lancamentos
      WHERE usuario_id = $1
        AND lower(tipo) = 'despesa'
        AND lower(status) IN ('pago','paga','pendente')
        AND TO_CHAR(data_lancamento::date, 'YYYY-MM') = $2
    `, [usuarioId, ym]);

    // Totais por grupo de parcelas
    const parcelas = await db.query(`
      SELECT l.grupo_parcela_id AS gid,
             c.nome AS categoria_nome,
             COALESCE(SUM(l.valor),0) AS total
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1
        AND lower(l.tipo)='despesa'
        AND lower(l.status) IN ('pago','paga','pendente')
        AND l.grupo_parcela_id IS NOT NULL
        AND TO_CHAR(l.data_lancamento::date,'YYYY-MM') = $2
      GROUP BY l.grupo_parcela_id, c.nome
      HAVING SUM(l.valor) > 0
    `, [usuarioId, ym]);

    // Totais por grupo recorrente (exclui parcelas)
    const recorrentes = await db.query(`
      SELECT l.grupo_recorrente_id AS gid,
             c.nome AS categoria_nome,
             COALESCE(SUM(l.valor),0) AS total
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1
        AND lower(l.tipo)='despesa'
        AND lower(l.status) IN ('pago','paga','pendente')
        AND l.grupo_recorrente_id IS NOT NULL
        AND l.grupo_parcela_id IS NULL
        AND TO_CHAR(l.data_lancamento::date,'YYYY-MM') = $2
      GROUP BY l.grupo_recorrente_id, c.nome
      HAVING SUM(l.valor) > 0
    `, [usuarioId, ym]);

    // Totais de gastos pontuais (sem grupo)
    const pontuais = await db.query(`
      SELECT c.nome AS categoria_nome,
             COALESCE(SUM(l.valor),0) AS total
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      WHERE l.usuario_id = $1
        AND lower(l.tipo)='despesa'
        AND lower(l.status) IN ('pago','paga','pendente')
        AND l.grupo_parcela_id  IS NULL
        AND l.grupo_recorrente_id IS NULL
        AND TO_CHAR(l.data_lancamento::date,'YYYY-MM') = $2
      GROUP BY c.nome
      HAVING SUM(l.valor) > 0
    `, [usuarioId, ym]);

    // Itens detalhados — Parcelas
    const itensParcelas = await db.query(`
      SELECT 
        l.id,
        COALESCE(l.observacao,'') AS descricao,
        l.valor::numeric AS valor,
        COALESCE(c.nome,'Sem categoria') AS categoria,
        COALESCE(s.nome,'—') AS subcategoria,
        l.parcela AS parcela_atual,
        (
          SELECT MAX(COALESCE(parcela,1))
          FROM lancamentos
          WHERE grupo_parcela_id = l.grupo_parcela_id
        ) AS parcelas_total
      FROM lancamentos l
      LEFT JOIN categorias    c ON c.id = l.categoria_id
      LEFT JOIN subcategorias s ON s.id = l.subcategoria_id
      WHERE l.usuario_id = $1
        AND lower(l.tipo)='despesa'
        AND l.grupo_parcela_id IS NOT NULL
        AND TO_CHAR(l.data_lancamento::date,'YYYY-MM') = $2
      ORDER BY l.data_lancamento ASC, l.id ASC
    `, [usuarioId, ym]);

    // Itens detalhados — Recorrentes
    const itensRecorrentes = await db.query(`
      SELECT 
        l.id,
        COALESCE(l.observacao,'') AS descricao,
        l.valor::numeric AS valor,
        COALESCE(c.nome,'Sem categoria') AS categoria,
        COALESCE(s.nome,'—') AS subcategoria
      FROM lancamentos l
      LEFT JOIN categorias    c ON c.id = l.categoria_id
      LEFT JOIN subcategorias s ON s.id = l.subcategoria_id
      WHERE l.usuario_id = $1
        AND lower(l.tipo)='despesa'
        AND lower(l.status) IN ('pago','paga','pendente')
        AND l.grupo_recorrente_id IS NOT NULL
        AND l.grupo_parcela_id IS NULL
        AND TO_CHAR(l.data_lancamento::date,'YYYY-MM') = $2
      ORDER BY l.data_lancamento ASC, l.id ASC
    `, [usuarioId, ym]);

    // Itens detalhados — Pontuais
    const itensPontuais = await db.query(`
      SELECT 
        l.id,
        COALESCE(l.observacao,'') AS descricao,
        l.valor::numeric AS valor,
        COALESCE(c.nome,'Sem categoria') AS categoria,
        COALESCE(s.nome,'—') AS subcategoria
      FROM lancamentos l
      LEFT JOIN categorias    c ON c.id = l.categoria_id
      LEFT JOIN subcategorias s ON s.id = l.subcategoria_id
      WHERE l.usuario_id = $1
        AND lower(l.tipo)='despesa'
        AND lower(l.status) IN ('pago','paga','pendente')
        AND l.grupo_parcela_id  IS NULL
        AND l.grupo_recorrente_id IS NULL
        AND TO_CHAR(l.data_lancamento::date,'YYYY-MM') = $2
      ORDER BY l.data_lancamento ASC, l.id ASC
    `, [usuarioId, ym]);

    const receitaMes      = Number(rec.rows?.[0]?.total || 0);
    const totalParcelas   = parcelas.rows.reduce((s,x)=> s + Number(x.total||0), 0);
    const totalRecorrentes= recorrentes.rows.reduce((s,x)=> s + Number(x.total||0), 0);
    const totalPontuais   = pontuais.rows.reduce((s,x)=> s + Number(x.total||0), 0);

    res.json({
      params: { ano, mes, ym },
      receita_mes: receitaMes,
      despesa_paga_mes: Number(desp.rows?.[0]?.total || 0),
      totais: {
        parcelas: totalParcelas,
        recorrentes: totalRecorrentes,
        pontuais: totalPontuais,
        pct_parcelas_sobre_receita:    receitaMes>0 ? 100*totalParcelas/receitaMes : 0,
        pct_recorrentes_sobre_receita: receitaMes>0 ? 100*totalRecorrentes/receitaMes : 0
      },
      listas: {
        parcelas: parcelas.rows,
        recorrentes: recorrentes.rows,
        pontuais: pontuais.rows
      },
      itens: {
        parcelas:    itensParcelas.rows,
        recorrentes: itensRecorrentes.rows,
        pontuais:    itensPontuais.rows
      }
    });
  } catch (e) {
    console.error('[analises/recorrencia-mensal] erro:', e);
    res.status(500).json({ error:'Erro ao calcular recorrência mensal', detalhe: String(e?.message || e) });
  }
});

module.exports = router;