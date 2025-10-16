const sqlite3 = require('sqlite3').verbose();
const db = require('./db');

db.serialize(() => {
  console.log('Iniciando remoção da coluna antiga...');

  db.run('PRAGMA foreign_keys = OFF');

  db.run(`
    CREATE TABLE IF NOT EXISTS lancamentos_nova (
      id INTEGER PRIMARY KEY,
      tipo TEXT NOT NULL,
      data_lancamento TEXT NOT NULL,
      data_vencimento TEXT,
      valor REAL NOT NULL,
      categoria_id INTEGER,
      subcategoria_id INTEGER,
      observacao TEXT,
      status TEXT,
      usuario_id INTEGER,
      forma_pagamento_id INTEGER
    )
  `, (err) => {
    if (err) return console.error('Erro ao criar tabela nova:', err.message);

    db.run(`
      INSERT INTO lancamentos_nova (
        id, tipo, data_lancamento, data_vencimento, valor,
        categoria_id, subcategoria_id, observacao, status,
        usuario_id, forma_pagamento_id
      )
      SELECT 
        id, tipo, data_lancamento, data_vencimento, valor,
        categoria_id, subcategoria_id, observacao, status,
        usuario_id, forma_pagamento_id
      FROM lancamentos
    `, (err) => {
      if (err) return console.error('Erro ao copiar dados:', err.message);

      db.run(`DROP TABLE lancamentos`, (err) => {
        if (err) return console.error('Erro ao remover tabela antiga:', err.message);

        db.run(`ALTER TABLE lancamentos_nova RENAME TO lancamentos`, (err) => {
          if (err) return console.error('Erro ao renomear nova tabela:', err.message);

          db.run('PRAGMA foreign_keys = ON');
          console.log('Coluna "forma_pagamento" removida com sucesso!');
        });
      });
    });
  });
});
