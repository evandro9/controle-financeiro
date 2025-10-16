// backend/middleware/auditoria.js
const db = require('../database/db');

const SENSIVEIS = ['password','senha','token','authorization','cookie','set-cookie','secret','jwt','x-access-token'];

function redact(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    const sens = SENSIVEIS.some(s => k.toLowerCase().includes(s));
    out[k] = sens ? '[REDACTED]' : (typeof v === 'object' ? redact(v, depth + 1) : v);
  }
  return out;
}

function parseBool(x) {
  return !['0','false','off','no',''].includes(String(x ?? '').toLowerCase());
}

function compilarPadroes(csv) {
  const lista = String(csv || '').split(',').map(s => s.trim()).filter(Boolean);
  // wildcard simples: auth.*  => ^auth\..*$
  return lista.map(p =>
    new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
  );
}

module.exports = function auditoria() {
  const habilitada = parseBool(process.env.AUDITORIA_HABILITADA ?? '0'); // default OFF
  const amostra   = Math.max(0, Math.min(1, Number(process.env.AUDITORIA_AMOSTRA ?? '1')));
  const permitir  = compilarPadroes(process.env.AUDITORIA_ACOES ?? '');  // vazio = todas

  return (req, res, next) => {
    // use nas rotas: req.audit({ acao, entidade, entidade_id, sucesso, motivo, detalhes })
    req.audit = (evt = {}) => { (req._audEventos ||= []).push(evt); };

    res.on('finish', async () => {
      try {
        if (!habilitada) return;
        if (amostra < 1 && Math.random() > amostra) return;
        const eventos = req._audEventos || [];
        if (!eventos.length) return;

        const usuarioId = req.user?.id ?? null;
        const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0] || req.ip || null;
        const agente = req.headers['user-agent'] || null;

        const baseReq = {
          query:   req.query || {},
          params:  req.params || {},
          body:    req.body || {},
          headers: {
            origin: req.headers.origin,
            referer: req.headers.referer,
            'x-request-id': req.id || req.headers['x-request-id']
          }
        };
        const reqJson = JSON.stringify(redact(baseReq));
        const rota = req.originalUrl || req.url;

        for (const e of eventos) {
          const acao = e.acao || 'evento';
          if (permitir.length && !permitir.some(rx => rx.test(acao))) continue;

          await db.query(
            `INSERT INTO auditoria
               (usuario_id, rota, metodo, acao, entidade, entidade_id, ip, agente, status_http, sucesso, motivo, req, res, data_hora)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())`,
            [
              usuarioId,
              rota,
              req.method,
              String(acao),
              e.entidade || null,
              e.entidade_id != null ? String(e.entidade_id) : null,
              ip,
              agente,
              res.statusCode,
              e.sucesso == null ? null : !!e.sucesso,
              e.motivo || null,
              reqJson,
              e.detalhes ? JSON.stringify(redact(e.detalhes)) : null
            ]
          );
        }
      } catch (err) {
        try { console.warn('[auditoria] falha ao inserir:', err.message); } catch {}
      }
    });

    next();
  };
};