//const db = require('./db');


//Mostra 5 registros da tabela escolhida

const db = require('./db');
const sql = `
  SELECT *
  FROM planejamentos
  ORDER BY ID DESC
`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error('Erro ao buscar lançamentos:', err.message);
    return;
  }

  if (rows.length === 0) {
    console.log('❌ Nenhum lançamento encontrado no banco.');
  } else {
    console.log(`✅ Total de lançamentos encontrados: ${rows.length}`);
  rows.forEach(l => {
  console.log(l);
});
  }

  db.close();
});


// Verifica todas colunas da tabela escolhida

// const db = require('./db');
// db.all(`PRAGMA table_info(planejamentos);`, (err, rows) => {
//   if (err) {
//     console.error('Erro ao consultar estrutura da tabela:', err.message);
//     return;
//   }

//   console.log('📋 Estrutura da tabela lancamentos:');
//   for (const col of rows) {
//     console.log(`${col.cid} | ${col.name} | ${col.type} | NOT NULL: ${col.notnull} | PK: ${col.pk}`);
//   }

//   db.close();
// });

// Lista nome de todas as tabelas cadastradas

// const db = require('./db');

// db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`, (err, rows) => {
//   if (err) {
//     console.error('Erro ao listar tabelas:', err.message);
//     return;
//   }

//   console.log('📋 Tabelas encontradas no banco:');
//   rows.forEach(row => {
//     console.log(`- ${row.name}`);
//   });

//   db.close();
// });
