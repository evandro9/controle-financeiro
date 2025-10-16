const sqlite3 = require('sqlite3').verbose();
const db = require('./db');

// Em atualiza_banco.js (adapte ao seu padrão de migrações)
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS investimento_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,         -- null = padrão do sistema
      nome TEXT NOT NULL,
      oculto INTEGER DEFAULT 0,   -- 0=visível, 1=oculto
      is_padrao INTEGER DEFAULT 0,
      UNIQUE(usuario_id, nome)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS investimento_subclasses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      classe_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      oculto INTEGER DEFAULT 0,
      is_padrao INTEGER DEFAULT 0,
      FOREIGN KEY(classe_id) REFERENCES investimento_classes(id),
      UNIQUE(usuario_id, classe_id, nome)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS investimento_ticker_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      ticker TEXT NOT NULL,         -- canônico (ex.: ITUB4)
      classe_id INTEGER NOT NULL,
      subclasse_id INTEGER,
      UNIQUE(usuario_id, ticker),
      FOREIGN KEY(classe_id) REFERENCES investimento_classes(id),
      FOREIGN KEY(subclasse_id) REFERENCES investimento_subclasses(id)
    )
  `);

  // Seeds padrão do sistema (usuario_id NULL)
  const seeds = [
    ['Ação', 0, 1],
    ['FII', 0, 1],
    ['ETF', 0, 1],
    ['Renda Fixa', 0, 1],
    ['BDR', 0, 1],
    ['Cripto', 0, 1],
  ];
  const stmt = db.prepare(`INSERT OR IGNORE INTO investimento_classes (nome, oculto, is_padrao) VALUES (?,?,?)`);
  seeds.forEach(s => stmt.run(s));
  stmt.finalize();

  // Subclasses padrão (exemplos)
  db.get(`SELECT id as id_acao FROM investimento_classes WHERE nome='Ação' AND usuario_id IS NULL`, (err, row1) => {
    if (row1?.id_acao) {
      const st = db.prepare(`INSERT OR IGNORE INTO investimento_subclasses (classe_id, nome, oculto, is_padrao) VALUES (?,?,?,?)`);
      st.run([row1.id_acao, 'Ação BR', 0, 1]);
      st.run([row1.id_acao, 'Ação EUA', 0, 1]);
      st.finalize();
    }
  });
});