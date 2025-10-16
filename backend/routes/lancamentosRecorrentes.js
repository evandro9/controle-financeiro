const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth'); 

router.post('/', autenticar, (req, res) => {
const {
  tipo,
  data_inicio,
  data_vencimento, // ⬅️ novo campo
  valor,
  categoria_id,
  subcategoria_id,
  forma_pagamento_id,
  observacao,
  status,
  duracao_meses
} = req.body;

  const usuario_id = req.user.id;

  const sql = `
  INSERT INTO lancamentos_recorrentes (
    usuario_id,
    tipo,
    data_inicio,
    data_vencimento,
    valor,
    categoria_id,
    subcategoria_id,
    forma_pagamento_id,
    observacao,
    status,
    duracao_meses,
    ativo
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  RETURNING id
  `;
  const params = [
    usuario_id, tipo, data_inicio, data_vencimento, valor,
    categoria_id, subcategoria_id, forma_pagamento_id,
    observacao, status, duracao_meses
  ];
  db.get(sql, params, (err, row) => {
    if (err) {
      console.error('Erro ao inserir recorrente:', err);
      return res.status(500).json({ error: 'Erro ao salvar recorrente' });
    }
    res.status(201).json({ id: row.id });
  });
});

module.exports = router;