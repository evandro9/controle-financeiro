// routes/investimentoClassesRoutes.js (Postgres)
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../database/db');

router.use(auth);

// Helpers PG
const q = async (text, params = []) => (await db.query(text, params)).rows;
const one = async (text, params = []) => (await db.query(text, params)).rows[0] || null;

// Verifica se coluna existe (para checagens defensivas)
async function columnExists(tableName, columnName) {
  const r = await db.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
      LIMIT 1`,
    [tableName, columnName]
  );
  return r.rowCount > 0;
}

/**
 * LISTAR (inclui padrão + do usuário; pode filtrar ocultas)
 * GET /investimento-classes?ocultas=1|0
 */
router.get('/', async (req, res) => {
  try {
    const uid = req.user.id;
    const mostrarOcultas = String(req.query.ocultas || '0') === '1';
    // quando não mostrar ocultas, trate NULL como 0 para padrões antigos:
    const whereOculto = mostrarOcultas ? '' : 'AND COALESCE(oculto, 0) = 0';

    const rows = await q(
      `SELECT *
         FROM investimento_classes
        WHERE (usuario_id IS NULL OR usuario_id = $1) ${whereOculto}
        ORDER BY is_padrao DESC, nome ASC`,
      [uid]
    );
    res.json(rows);
  } catch (err) {
    console.error('[investimento-classes][GET] erro:', err);
    res.status(500).json({ erro: 'Falha ao listar classes' });
  }
});

/**
 * CRIAR
 * POST /investimento-classes
 * body: { nome }
 */
router.post('/', async (req, res) => {
  try {
    const uid = req.user.id;
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

    const r = await db.query(
      `INSERT INTO investimento_classes (usuario_id, nome, oculto, is_padrao)
       VALUES ($1, $2, 0, 0)
       RETURNING *`,
      [uid, nome]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error('[investimento-classes][POST] erro:', err);
    res.status(500).json({ erro: 'Falha ao criar classe' });
  }
});

/**
 * EDITAR
 * PUT /investimento-classes/:id
 * body: { nome?, oculto? }
 * Permite editar classe do usuário; e classe padrão global (usuario_id IS NULL) apenas se is_padrao=1.
 */
router.put('/:id', async (req, res) => {
  try {
    const uid = req.user.id;
    const { id } = req.params;
    const { nome, oculto } = req.body;

    await db.query(
      `UPDATE investimento_classes
          SET nome   = COALESCE($1, nome),
              oculto = COALESCE($2, oculto)
        WHERE id = $3
          AND (usuario_id = $4 OR (usuario_id IS NULL AND is_padrao = 1))`,
      [nome ?? null, (typeof oculto === 'number' ? oculto : null), id, uid]
    );
    const row = await one(`SELECT * FROM investimento_classes WHERE id=$1`, [id]);
    res.json(row);
  } catch (err) {
    console.error('[investimento-classes][PUT] erro:', err);
    res.status(500).json({ erro: 'Falha ao atualizar classe' });
  }
});

/**
 * OCULTAR / REEXIBIR
 * PATCH /investimento-classes/:id/ocultar
 * body: { oculto: 0|1 }
 */
router.patch('/:id/ocultar', async (req, res) => {
  try {
    const uid = req.user.id;
    const { id } = req.params;
    const { oculto } = req.body;

    await db.query(
      `UPDATE investimento_classes
          SET oculto = $1
        WHERE id = $2
          AND (usuario_id = $3 OR usuario_id IS NULL)`,
      [oculto ? 1 : 0, id, uid]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[investimento-classes][PATCH ocultar] erro:', err);
    res.status(500).json({ erro: 'Falha ao ocultar' });
  }
});

/**
 * DELETE classe do usuário (com checagens)
 * DELETE /investimento-classes/:id
 * - Não permite excluir classe padrão (usuario_id IS NULL)
 * - Checa dependências: subclasses, investimentos (se coluna classe_id existir), ticker map
 */
router.delete('/:id', async (req, res) => {
  const uid = req.user.id;
  const id = Number(req.params.id);

  try {
    // 1) Verifica existência e “proprietário”
    const classe = await one(`SELECT * FROM investimento_classes WHERE id=$1`, [id]);
    if (!classe) return res.status(404).json({ erro: 'Classe não encontrada' });
    if (classe.usuario_id == null) return res.status(403).json({ erro: 'Classe padrão não pode ser excluída' });
    if (classe.usuario_id !== uid) return res.status(403).json({ erro: 'Sem permissão para excluir esta classe' });

    // 2) Checa dependências
    // 2.1) Subclasses
    const sub = await one(
      `SELECT COUNT(1) AS n
         FROM investimento_subclasses
        WHERE classe_id = $1
          AND (usuario_id IS NULL OR usuario_id = $2)`,
      [id, uid]
    );
    if (Number(sub?.n || 0) > 0) {
      return res.status(400).json({
        erro: 'Não é possível excluir: existem subclasses vinculadas a esta classe.',
        motivo: 'subclasses',
        quantidade: Number(sub.n)
      });
    }

    // 2.2) Investimentos (apenas se a coluna existir)
    try {
      const temClasseId = await columnExists('investimentos', 'classe_id');
      if (temClasseId) {
        const inv = await one(
          `SELECT COUNT(1) AS n
             FROM investimentos
            WHERE classe_id = $1 AND usuario_id = $2`,
          [id, uid]
        );
        if (Number(inv?.n || 0) > 0) {
          return res.status(400).json({
            erro: 'Não é possível excluir: existem investimentos vinculados a esta classe.',
            motivo: 'investimentos',
            quantidade: Number(inv.n)
          });
        }
      }
    } catch (e) {
      // Se tabela/coluna não existir (42P01/42703), ignora a checagem
      if (!['42P01', '42703'].includes(e?.code)) throw e;
    }

    // 2.3) Mapeamentos de ticker
    try {
      const map = await one(
        `SELECT COUNT(1) AS n
           FROM investimento_ticker_map
          WHERE classe_id = $1 AND usuario_id = $2`,
        [id, uid]
      );
      if (Number(map?.n || 0) > 0) {
        return res.status(400).json({
          erro: 'Não é possível excluir: existem mapeamentos de ticker vinculados a esta classe.',
          motivo: 'ticker_map',
          quantidade: Number(map.n)
        });
      }
    } catch (e) {
      if (e?.code !== '42P01') throw e; // tabela pode não existir
    }

    // 3) Exclui
    const del = await db.query(
      `DELETE FROM investimento_classes WHERE id=$1 AND usuario_id=$2`,
      [id, uid]
    );
    if (del.rowCount === 0) {
      return res.status(404).json({ erro: 'Classe não encontrada para exclusão' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[investimento-classes][DELETE] erro:', err);
    res.status(500).json({ erro: 'Falha ao excluir classe' });
  }
});

module.exports = router;