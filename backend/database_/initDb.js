const db = require('./db');

// Tabela de categorias
db.run(`
  CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL
  )
`);

// Tabela de subcategorias
db.run(`
  CREATE TABLE IF NOT EXISTS subcategorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    categoria_id INTEGER NOT NULL,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
  )
`);

// Tabela de lançamentos
db.run(`
  CREATE TABLE IF NOT EXISTS lancamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL, -- 'receita' ou 'despesa'
    data_lancamento TEXT NOT NULL,
    data_vencimento TEXT,
    valor REAL NOT NULL,
    categoria_id INTEGER,
    subcategoria_id INTEGER,
    forma_pagamento TEXT,
    observacao TEXT,
    status TEXT,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    FOREIGN KEY (subcategoria_id) REFERENCES subcategorias(id)
  )
`);

// Tabela de usuários
db.run(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    email TEXT UNIQUE,
    senha TEXT
  )
`);

// Tabela de planejamentos por categoria e ano
db.run(`
  CREATE TABLE IF NOT EXISTS planejamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ano TEXT NOT NULL,
    categoria_id INTEGER NOT NULL,
    valor_planejado REAL NOT NULL,
    usuario_id INTEGER NOT NULL,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  )
`);

console.log('Tabelas atualizadas com sucesso!');
