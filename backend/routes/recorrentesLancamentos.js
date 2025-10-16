const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const { addMonths, parseISO, format } = require('date-fns');

router.post('/', auth, (req, res) => {
  const {
    tipo,
    data_inicio,
    data_vencimento,
    valor,
    categoria_id,
    subcategoria_id,
    forma_pagamento_id,
    observacao,
    status = 'pendente',
    duracao_meses
  } = req.body;

  const usuario_id = req.user.id;

  if (!tipo || !data_inicio || !data_vencimento || !valor || !duracao_meses) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
  }

  const parcelas = [];

  const dataBase = parseISO(data_inicio);
  const vencimentoBase = parseISO(data_vencimento);

  for (let i = 0; i < duracao_meses; i++) {
    const data_lanc = addMonths(dataBase, i);
    const data_venc = addMonths(vencimentoBase, i);

    parcelas.push([
      usuario_id,
      tipo,
      format(data_lanc, 'yyyy-MM-dd'),
      format(data_venc, 'yyyy-MM-dd'),
      valor,
      categoria_id,
      subcategoria_id,
      forma_pagamento_id,
      observacao || '',
      status
    ]);
  }

  // 1) cria o grupo de recorrência e pega id inteiro
  const nomeGrupo = `Recorrente ${format(parseISO(data_inicio), 'yyyy-MM')}`;
  const sqlGrupo = `
    INSERT INTO grupos_recorrentes (usuario_id, nome)
    VALUES (?, ?)
    RETURNING id
  `;
  db.get(sqlGrupo, [usuario_id, nomeGrupo], (err, row) => {
    if (err) {
      console.error('Erro ao criar grupo recorrente:', err.message);
      return res.status(500).json({ error: 'Erro ao criar grupo recorrente' });
    }
    const grupo_recorrente_id = row.id;

    // 2) insere as parcelas vinculando ao id inteiro do grupo
    const sqlLanc = `
      INSERT INTO lancamentos (
        usuario_id, tipo, data_lancamento, data_vencimento, valor,
        categoria_id, subcategoria_id, forma_pagamento_id,
        observacao, status, grupo_recorrente_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let erros = 0, feitos = 0;
    parcelas.forEach(p => {
      const params = [...p, grupo_recorrente_id];
      db.run(sqlLanc, params, (e) => {
        feitos++;
        if (e) erros++;
        if (feitos === parcelas.length) {
          if (erros) return res.status(500).json({ error: 'Falha ao inserir algumas parcelas' });
          res.status(201).json({ message: 'Lançamentos recorrentes criados', grupo_recorrente_id });
        }
      });
    });
  });
});

module.exports = router;