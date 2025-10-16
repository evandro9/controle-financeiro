const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'financeiro.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) {
    console.error('Erro ao listar tabelas:', err.message);
    return;
  }

  console.log('Tabelas no banco de dados:');
  rows.forEach(row => console.log('- ' + row.name));
});
