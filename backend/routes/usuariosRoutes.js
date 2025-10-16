const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const auth = require('../middleware/auth');

router.post('/', async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const stmt = db.prepare(`INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)`);
    stmt.run(nome, email, senhaHash);
    res.status(201).json({ message: 'Usuário criado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

module.exports = router;

// POST /api/usuarios/definir-senha  (primeira senha ou troca)
router.post('/definir-senha', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { senha } = req.body || {};
    if (!userId || !senha) return res.status(400).json({ error: 'dados_invalidos' });
    const hash = await bcrypt.hash(senha, 10);
    await db.query('UPDATE usuarios SET senha=$1 WHERE id=$2', [hash, userId]);
    // AUDITORIA: troca/definição de senha
    req.audit({ acao: 'usuarios.definir_senha', entidade: 'usuario', entidade_id: userId, sucesso: true });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[usuarios/definir-senha]', e);
    return res.status(500).json({ error: 'server' });
  }
});