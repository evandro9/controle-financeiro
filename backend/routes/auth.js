const express = require('express');
const router = express.Router();
const db = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Segredo usado para gerar o token
const SECRET = 'chave-secreta-simples'; // Trocaremos depois com .env

router.post('/', (req, res) => {
  const { email, senha } = req.body;

  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

    const senhaCorreta = bcrypt.compareSync(senha, user.senha);
    if (!senhaCorreta) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id, nome: user.nome }, SECRET, { expiresIn: '2h' });
    res.json({ token, nome: user.nome });
  });
});

module.exports = router;
