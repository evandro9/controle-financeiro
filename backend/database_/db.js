const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'financeiro.db'); // <-- cria o banco aqui

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar com o banco de dados', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite!');
  }
});

module.exports = db;