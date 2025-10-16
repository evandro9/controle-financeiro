// backend/routes/investimentoSubclassesRoutes.js (Postgres)
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../database/db');

router.use(auth);

// LISTAR por classe
router.get('/', async (req, res) => {
  try {
    const uid = req.user.id;
    const classe_id = Number(req.query.classe_id);
    if (!classe_id) return res.status(400).json({ erro: 'classe_id é obrigatório' });

    const mostrarOcultas = String(req.query.ocultas || '0') === '1';
    const whereOculto = mostrarOcultas ? '' : 'AND s.oculto = 0';

    const { rows } = await db.query(
      `
      SELECT s.*
        FROM investimento_subclasses s
        JOIN investimento_classes c ON c.id = s.classe_id
       WHERE s.classe_id = $1
         AND (s.usuario_id IS NULL OR s.usuario_id = $2)
         ${whereOculto}
       ORDER BY s.is_padrao DESC, s.nome ASC
      `,
      [classe_id, uid]
    );

    res.json(rows || []);
  } catch (err) {
    console.error('GET /investimento_subclasses erro:', err);
    res.status(500).json({ erro: 'Falha ao listar subclasses' });
  }
});

// CRIAR
router.post('/', async (req, res) => {
  try {
    const uid = req.user.id;
    const { classe_id, nome } = req.body;
    if (!classe_id || !nome) {
      return res.status(400).json({ erro: 'classe_id e nome são obrigatórios' });
    }

    const { rows } = await db.query(
      `INSERT INTO investimento_subclasses (usuario_id, classe_id, nome, oculto, is_padrao)
       VALUES ($1, $2, $3, 0, 0)
       RETURNING *`,
      [uid, Number(classe_id), String(nome).trim()]
    );

    res.json(rows?.[0] || null);
  } catch (err) {
    console.error('POST /investimento_subclasses erro:', err);
    res.status(500).json({ erro: 'Falha ao criar subclasse' });
  }
});

// EDITAR
router.put('/:id', async (req, res) => {
  try {
    const uid = req.user.id;
    const id = Number(req.params.id);
    const { nome, oculto } = req.body;

    // Atualiza somente campos enviados; mantém a regra original de permissão
    const { rowCount } = await db.query(
      `UPDATE investimento_subclasses
          SET nome   = COALESCE($1, nome),
              oculto = COALESCE($2, oculto)
        WHERE id = $3
          AND (usuario_id = $4 OR (usuario_id IS NULL AND is_padrao = 1))`,
      [
        (typeof nome === 'string' ? nome.trim() : null),
        (typeof oculto === 'number' ? oculto : null),
        id,
        uid
      ]
    );

    if (rowCount === 0) {
      return res.status(404).json({ erro: 'Subclasse não encontrada ou sem permissão para editar' });
    }

    const { rows } = await db.query(`SELECT * FROM investimento_subclasses WHERE id=$1`, [id]);
    res.json(rows?.[0] || null);
  } catch (err) {
    console.error('PUT /investimento_subclasses/:id erro:', err);
    res.status(500).json({ erro: 'Falha ao atualizar subclasse' });
  }
});

// OCULTAR/REEXIBIR
router.patch('/:id/ocultar', async (req, res) => {
  try {
    const uid = req.user.id;
    const id = Number(req.params.id);
    const { oculto } = req.body;

    const { rowCount } = await db.query(
      `UPDATE investimento_subclasses
          SET oculto = $1
        WHERE id = $2
          AND (usuario_id = $3 OR usuario_id IS NULL)`,
      [oculto ? 1 : 0, id, uid]
    );

    if (rowCount === 0) {
      return res.status(404).json({ erro: 'Subclasse não encontrada ou sem permissão para ocultar' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /investimento_subclasses/:id/ocultar erro:', err);
    res.status(500).json({ erro: 'Falha ao ocultar' });
  }
});

// DELETE subclasse do usuário (sem cascade)
router.delete('/:id', async (req, res) => {
  try {
    const uid = req.user.id;
    const id = Number(req.params.id);

    // 1) Verifica existência e propriedade (padrão não pode excluir)
    const subQ = await db.query(`SELECT * FROM investimento_subclasses WHERE id=$1`, [id]);
    const sub = subQ.rows?.[0];
    if (!sub) return res.status(404).json({ erro: 'Subclasse não encontrada' });

    if (sub.usuario_id == null) {
      return res.status(403).json({
        erro: 'Subclasse padrão não pode ser excluída (você pode ocultá-la).',
        motivo: 'padrao'
      });
    }
    if (Number(sub.usuario_id) !== Number(uid)) {
      return res.status(403).json({ erro: 'Sem permissão para excluir esta subclasse' });
    }

    // 2) Bloqueia exclusão se houver investimentos vinculados (se a coluna existir)
    const colExistsQ = await db.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'investimentos'
          AND column_name  = 'subclasse_id'
        LIMIT 1`
    );
    if (colExistsQ.rowCount > 0) {
      const r2 = await db.query(
        `SELECT COUNT(1)::int AS n
           FROM investimentos
          WHERE subclasse_id=$1 AND usuario_id=$2`,
        [id, uid]
      );
      if ((r2.rows?.[0]?.n || 0) > 0) {
        return res.status(400).json({
          erro: 'Não é possível excluir: existem investimentos vinculados a esta subclasse.',
          motivo: 'investimentos',
          quantidade: r2.rows[0].n
        });
      }
    }

    // 3) Bloqueia exclusão se houver mapeamentos de ticker vinculados
    const r3 = await db.query(
      `SELECT COUNT(1)::int AS n
         FROM investimento_ticker_map
        WHERE subclasse_id=$1 AND usuario_id=$2`,
      [id, uid]
    );
    if ((r3.rows?.[0]?.n || 0) > 0) {
      return res.status(400).json({
        erro: 'Não é possível excluir: existem mapeamentos de ticker vinculados a esta subclasse.',
        motivo: 'ticker_map',
        quantidade: r3.rows[0].n
      });
    }

    // 4) Sem vínculos -> excluir
    const del = await db.query(
      `DELETE FROM investimento_subclasses WHERE id=$1 AND usuario_id=$2`,
      [id, uid]
    );
    if (del.rowCount === 0) {
      return res.status(404).json({ erro: 'Subclasse não encontrada para exclusão' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /investimento_subclasses/:id erro:', err);
    res.status(500).json({ erro: 'Falha ao excluir subclasse' });
  }
});

module.exports = router;