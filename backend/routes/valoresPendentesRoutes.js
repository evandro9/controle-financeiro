// backend/routes/valoresPendentesRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { format } = require('date-fns');
const { ptBR } = require('date-fns/locale');

router.use(auth);

router.get('/', (req, res) => {
  const usuario_id = req.user.id;
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;

  db.all(
    `SELECT nome_investimento, tipo_operacao, quantidade, data_operacao
     FROM investimentos
     WHERE usuario_id = ?
     ORDER BY data_operacao ASC`,
    [usuario_id],
    (err, investimentos) => {
      if (err) return res.status(500).json({ erro: 'Erro ao buscar investimentos' });

      const ativos = new Set();
      const quantidadePorAtivo = {};
      const primeiraDataPorAtivo = {};

      investimentos.forEach((inv) => {
        const nome = inv.nome_investimento;
        const mult = inv.tipo_operacao === 'compra' ? 1 : -1;
        const data = new Date(inv.data_operacao);
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const chave = `${ano}-${mes}`;

        ativos.add(nome);
        if (!quantidadePorAtivo[nome]) quantidadePorAtivo[nome] = {};
        if (!quantidadePorAtivo[nome][chave]) quantidadePorAtivo[nome][chave] = 0;

        quantidadePorAtivo[nome][chave] += mult * inv.quantidade;

        if (!primeiraDataPorAtivo[nome]) {
          primeiraDataPorAtivo[nome] = data;
        }
      });

      const acumuladoPorAtivo = {};
      const primeiroMesPorAtivo = {};

      ativos.forEach((ativo) => {
        acumuladoPorAtivo[ativo] = {};
        let acumulado = 0;
        const dataInicio = primeiraDataPorAtivo[ativo];
        const anoInicio = dataInicio.getFullYear();
        const mesInicio = dataInicio.getMonth() + 1;

        for (let m = mesInicio; m <= mesAtual; m++) {
          const chave = `${anoAtual}-${String(m).padStart(2, '0')}`;
          acumulado += quantidadePorAtivo[ativo]?.[chave] || 0;
          acumuladoPorAtivo[ativo][chave] = acumulado;

          if (acumulado > 0 && !primeiroMesPorAtivo[ativo]) {
            primeiroMesPorAtivo[ativo] = chave;
          }
        }
      });

      db.all(
        `SELECT nome_investimento, data_referencia
         FROM valores_atuais
         WHERE usuario_id = ?`,
        [usuario_id],
        (err2, valores) => {
          if (err2) return res.status(500).json({ erro: 'Erro ao buscar valores atuais' });

          const mapaDatas = {};

          valores.forEach(v => {
            const chave = v.nome_investimento + '|' + v.data_referencia.slice(0, 7);
            mapaDatas[chave] = v.data_referencia;
          });

          const pendencias = [];

          ativos.forEach((ativo) => {
            const faltando = [];
            const primeiro = primeiroMesPorAtivo[ativo];
            if (!primeiro) return;

            const mesInicio = parseInt(primeiro.split('-')[1]);

            for (let m = mesInicio; m < mesAtual; m++) {
              const chave = `${anoAtual}-${String(m).padStart(2, '0')}`;
              const key = ativo + '|' + chave;
              const qtd = acumuladoPorAtivo[ativo][chave] || 0;
              const data_referencia = mapaDatas[key];

              const nomeMes = format(new Date(`${chave}-02T12:00:00`), 'MMMM', { locale: ptBR });

              if (qtd > 0) {
                if (!data_referencia) {
                  faltando.push({ mes: nomeMes, status: 'ausente', data: null });
                } else {
                  const [anoStr, mesStr, diaStr] = data_referencia.split('-');
                  const diaReferencia = parseInt(diaStr);
                  const ano = parseInt(anoStr);
                  const mesNum = parseInt(mesStr);
                  const ultimoDia = new Date(ano, mesNum, 0).getDate();

                  if (diaReferencia < ultimoDia) {
                    faltando.push({ mes: nomeMes, status: 'incompleto', data: data_referencia });
                  }
                }
              }
            }

            if (faltando.length > 0) {
              pendencias.push({ ativo, meses: faltando });
            }
          });

          res.json(pendencias);
        }
      );
    }
  );
});

module.exports = router;