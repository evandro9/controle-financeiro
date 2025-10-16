const db = require('./db');
const bcrypt = require('bcryptjs');

// Defina seu e-mail e senha aqui:
const email = 'seu@email.com';
const nome = 'Renê';
const senha = '123456'; // pode trocar depois

// Criptografa a senha
const hash = bcrypt.hashSync(senha, 10);

// Insere no banco
db.run(`
  INSERT INTO usuarios (nome, email, senha)
  VALUES (?, ?, ?)
`, [nome, email, hash], function (err) {
  if (err) {
    console.error('Erro ao inserir usuário:', err.message);
  } else {
    console.log('Usuário criado com sucesso! ID:', this.lastID);
  }
});