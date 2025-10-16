const express = require('express');
const router = express.Router();
const db = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET;

router.post('/', async (req, res) => {
  const { usuario, senha } = req.body;
  // Fallback defensivo: se o middleware não rodou, não quebra
  if (typeof req.audit !== 'function') req.audit = () => {};  
  console.log('Login recebido:', usuario, senha);
  console.log('SECRET usado no login:', SECRET);

  try {
    db.get('SELECT * FROM usuarios WHERE email = ?', [usuario], async (err, user) => {
      if (err) {
        console.error('Erro ao buscar usuário:', err);
        return res.status(500).json({ error: 'Erro ao buscar usuário' });
      }

      if (!user) {
        // AUDITORIA: usuário não encontrado
        req.audit({ acao: 'auth.login', entidade: 'usuario', entidade_id: null, sucesso: false, motivo: 'user_not_found' });
        return res.status(401).json({ error: 'Usuário não encontrado' });
      }

      const senhaCorreta = await bcrypt.compare(senha, user.senha);
      if (!senhaCorreta) {
        // AUDITORIA: senha incorreta
        req.audit({ acao: 'auth.login', entidade: 'usuario', entidade_id: user.id, sucesso: false, motivo: 'invalid_password' });
        console.log('Senha incorreta para:', usuario);
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' });
      console.log('Login bem-sucedido');
      // AUDITORIA: sucesso
      req.audit({ acao: 'auth.login', entidade: 'usuario', entidade_id: user.id, sucesso: true });
      res.json({ token, nome: user.nome });
    });
  } catch (err) {
    console.error('Erro inesperado no login:', err);
    res.status(500).json({ error: 'Erro no login' });
  }
});

module.exports = router;
