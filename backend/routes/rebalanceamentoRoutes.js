const express = require('express');
const router = express.Router();
const db = require('../database/db');
const autenticar = require('../middleware/auth');

// GET: buscar distribuição salva
router.get('/', autenticar, (req, res) => {
  const usuarioId = req.user.id;

  const sql = `SELECT * FROM distribuicao_rebalanceamento WHERE usuario_id = ?`;

  db.all(sql, [usuarioId], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao buscar distribuição');
    }

    const percentuais = {};                 // flat por subclasse (compat)
    const internos = {};                    // { subclasse: { ativo: %dentroSub } }
    const percentuaisClasse = {};           // { classe: % na carteira }
    const percentuaisSubPorClasse = {};     // { classe: { subclasse: % dentro da classe } }

    rows.forEach(row => {
      const classe    = row.classe;
      const subclasse = (row.subclasse === '' ? null : row.subclasse);
      const ativo     = (row.ativo === '' ? null : row.ativo);

      // Classe (linha com 'classe' e percentual_classe)
      if (classe && row.percentual_classe != null && !subclasse && !ativo) {
        percentuaisClasse[classe] = Number(row.percentual_classe);
      }
      // Subclasse interna à classe (partição 100% por classe)
      if (classe && subclasse && row.percentual_subclasse_interna != null) {
        if (!percentuaisSubPorClasse[classe]) percentuaisSubPorClasse[classe] = {};
        percentuaisSubPorClasse[classe][subclasse] = Number(row.percentual_subclasse_interna);
      }
      // Flat por subclasse (compatibilidade)
      if (subclasse && row.percentual_subclasse != null) {
        percentuais[subclasse] = Number(row.percentual_subclasse);
      }
      // Ativos (dentro da subclasse)
      if (subclasse && ativo && row.percentual_ativo != null) {
        if (!internos[subclasse]) internos[subclasse] = {};
        internos[subclasse][ativo] = Number(row.percentual_ativo);
      }
    });

    // Fallback: se não houver linhas “puras” de classe, deriva somando o flat das subclasses por classe
    if (Object.keys(percentuaisClasse).length === 0) {
      const acc = {};
      rows.forEach(row => {
        if (row.classe && row.subclasse && row.percentual_subclasse != null) {
          acc[row.classe] = (acc[row.classe] || 0) + Number(row.percentual_subclasse || 0);
        }
      });
      Object.assign(percentuaisClasse, acc);
    }

    // Fallback: derivar % por classe somando flats das suas subclasses
    if (Object.keys(percentuaisClasse).length === 0) {
      const acc = {};
      rows.forEach(row => {
        const classe    = row.classe;
        const subclasse = (row.subclasse === '' ? null : row.subclasse);
        const pctFlat   = row.percentual_subclasse;
        if (classe && subclasse && pctFlat != null) {
          acc[classe] = (acc[classe] || 0) + Number(pctFlat);
        }
      });
      Object.assign(percentuaisClasse, acc);
    }

    res.json({ percentuais, internos, percentuaisClasse, percentuaisSubPorClasse });
  });
});

// POST: salvar nova distribuição
router.post('/', autenticar, (req, res) => {
  const usuarioId = req.user.id;
  // Front envia:
  //  - percentuaisClasse: { classe: % }
  //  - percentuaisSubPorClasse: { classe: { sub: %dentroClasse } }
  //  - percentuais: { subclasse: %flat }    (compatibilidade)
  //  - internos: { subclasse: { ativo: %dentroSub } }
  const { percentuais, internos, percentuaisClasse, percentuaisSubPorClasse } = req.body;

  db.run('DELETE FROM distribuicao_rebalanceamento WHERE usuario_id = ?', [usuarioId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro ao limpar distribuição anterior');
    }

    const insertBase = `
      INSERT INTO distribuicao_rebalanceamento
      (usuario_id, classe, percentual_classe, subclasse, percentual_subclasse, percentual_subclasse_interna, ativo, percentual_ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const insertStmt = db.prepare(insertBase);

    try {
      // 1) Linhas de CLASSE (apenas classe + percentual_classe)
      if (percentuaisClasse && typeof percentuaisClasse === 'object') {
        for (const classe in percentuaisClasse) {
          const pctClasse = Number(percentuaisClasse[classe] || 0);
          insertStmt.run([usuarioId, classe, pctClasse, null, null, null, null, null]);
        }
      }

      // 2) Linhas de SUBCLASSE (partição interna por classe + flat)
      //    Para cada (classe -> sub) gravamos:
      //      - percentual_subclasse_interna (dentro da classe)
      //      - percentual_subclasse (flat) se disponível (compat)
      if (percentuaisSubPorClasse && typeof percentuaisSubPorClasse === 'object') {
        for (const classe in percentuaisSubPorClasse) {
          const mapaSubs = percentuaisSubPorClasse[classe] || {};
          for (const sub in mapaSubs) {
            const pctInterno = Number(mapaSubs[sub] || 0);
            const pctFlat = percentuais && percentuais[sub] != null ? Number(percentuais[sub]) : null;
            insertStmt.run([
              usuarioId,
              classe,                 // classe
              null,                   // percentual_classe
              sub,                    // subclasse
              pctFlat,                // percentual_subclasse (flat, compat) - pode ser null
              pctInterno,             // percentual_subclasse_interna (100% dentro da classe)
              null,                   // ativo
              null                    // percentual_ativo
            ]);
          }
        }
      }

      // 3) Linhas de ATIVO (dentro da subclasse) — mantém como já era
      if (internos && typeof internos === 'object') {
        for (const sub in internos) {
          const ativos = internos[sub] || {};
          for (const ativo in ativos) {
            insertStmt.run([
              usuarioId,
              null,                   // classe
              null,                   // percentual_classe
              sub,                    // subclasse
              null,                   // percentual_subclasse (NÃO replicar flat na linha do ativo)
              null,                   // percentual_subclasse_interna (não se aplica na linha do ativo)
              ativo,                  // ativo
              Number(ativos[ativo] || 0) // % do ativo dentro da subclasse
            ]);
          }
        }
      }

      insertStmt.finalize();
      res.sendStatus(200);
    } catch (error) {
      console.error(error);
      res.status(500).send('Erro ao salvar distribuição');
    }
  });
});

module.exports = router;