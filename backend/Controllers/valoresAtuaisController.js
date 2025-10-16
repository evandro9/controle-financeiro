
const db = require('../database/db');

// Salvar ou atualizar valor mensal
function salvarOuAtualizarValorAtual(req, res) {
  let { nome_investimento, data_referencia, preco_unitario, valor_total } = req.body;
  const usuario_id = req.user.id;

  if (!nome_investimento || !data_referencia) {
    return res.status(400).json({ erro: 'Preencha nome_investimento e data_referencia.' });
  }

  const hoje = new Date();
  const [anoSelecionado, mesSelecionado] = data_referencia.split('-').map(Number);

  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  let dataFinal;
  if (mesSelecionado === mesAtual && anoSelecionado === anoAtual) {
    dataFinal = hoje;
  } else {
    dataFinal = new Date(anoSelecionado, mesSelecionado, 0);
  }

  data_referencia = dataFinal.toISOString().split('T')[0];
  const mesAno = data_referencia.slice(0, 7); // 'YYYY-MM'

  const sqlCheck = `
    SELECT id, data_referencia FROM valores_atuais
    WHERE usuario_id = ? AND nome_investimento = ?
      AND strftime('%Y-%m', data_referencia) = ?
  `;

  db.get(sqlCheck, [usuario_id, nome_investimento, mesAno], (err, row) => {
    if (err) {
      console.error('Erro ao verificar valor atual:', err);
      return res.status(500).json({ erro: 'Erro ao verificar valor atual.' });
    }

    if (row) {
      const sqlUpdate = `
        UPDATE valores_atuais
        SET preco_unitario = ?, valor_total = ?, data_referencia = ?
        WHERE id = ?
      `;
      db.run(sqlUpdate, [preco_unitario, valor_total, data_referencia, row.id], function (err) {
        if (err) {
          console.error('Erro ao atualizar valor atual:', err);
          return res.status(500).json({ erro: 'Erro ao atualizar valor atual.' });
        }
        return res.json({ sucesso: true, atualizado: true });
      });
    } else {
      const sqlInsert = `
        INSERT INTO valores_atuais (usuario_id, nome_investimento, data_referencia, preco_unitario, valor_total)
        VALUES (?, ?, ?, ?, ?)
      `;
      db.run(sqlInsert, [usuario_id, nome_investimento, data_referencia, preco_unitario, valor_total], function (err) {
        if (err) {
          console.error('Erro ao inserir valor atual:', err);
          return res.status(500).json({ erro: 'Erro ao inserir valor atual.' });
        }
        return res.json({ sucesso: true, inserido: true });
      });
    }
  });
}

// Listar valores com filtro de ano e mês
function listarValoresAtuais(req, res) {
  const usuario_id = req.user.id;
  const { ano, mes } = req.query;

  const sql = `
    SELECT * FROM valores_atuais
    WHERE usuario_id = ?
      AND strftime('%Y', data_referencia) = ?
      AND strftime('%m', data_referencia) = ?
    ORDER BY data_referencia DESC
  `;

  const mesFormatado = String(mes).padStart(2, '0');

  db.all(sql, [usuario_id, ano, mesFormatado], (err, rows) => {
    if (err) {
      console.error('Erro ao listar valores atuais:', err);
      return res.status(500).json({ erro: 'Erro ao listar valores atuais.' });
    }
    return res.json(rows);
  });
}

module.exports = {
  salvarOuAtualizarValorAtual,
  listarValoresAtuais
};
