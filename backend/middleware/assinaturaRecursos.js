/**
 * Middleware de assinatura/recursos (gate per feature)
 * - Verifica assinatura ativa do usuário (status + validade)
 * - Verifica se o plano do usuário inclui o recurso solicitado
 *
 * Uso:
 *   const { exigirRecurso } = require('../middleware/assinaturaRecursos');
 *   router.use(exigirRecurso('investimentos_premium'));
 */

const db = require('../database/db');

// --- Mapa de recursos → planos permitidos ---
// Atenção: mantenha os nomes em minúsculas
const MAPA_RECURSOS = {
  // Tudo que é analítico/avançado de Investimentos
  'investimentos_premium': ['premium'],
};

// Normaliza a string do plano para classes: 'basico' | 'premium'
function normalizarPlano(plan) {
  const p = String(plan || '').trim().toLowerCase();
  // Trata 'básico' com/sem acento e variações em inglês
  if (/(basic|básic|basico|básico)/.test(p)) return 'basico';
  // Qualquer outra coisa tratamos como 'premium' (ex.: 'semestral', 'anual', 'mensal', 'pro', 'plus', etc.)
  return 'premium';
}

async function obterAssinaturaMaisRecente(userId) {
  // Pega a mais recente pela coluna updated_at
  const { rows } = await db.query(
    `SELECT id, user_id, plan, status, current_period_end, cancel_at,
            (NOW() AT TIME ZONE 'America/Sao_Paulo')                    AS now_sp,
            (current_period_end AT TIME ZONE 'America/Sao_Paulo')       AS current_period_end_sp
       FROM subscriptions
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [userId]
  );
  return rows?.[0] || null;
}

function assinaturaAtiva(row) {
  if (!row) return false;
  if (String(row.status || '').toLowerCase() !== 'active') return false;
  // Considera ativa se não estiver expirada no relógio de São Paulo
  const agora = new Date(row.now_sp || Date.now());
  const fim   = row.current_period_end_sp ? new Date(row.current_period_end_sp) : null;
  if (fim && fim < agora) return false;
  // Se houver cancel_at no passado, também bloqueia
  if (row.cancel_at) {
    const cancel = new Date(row.cancel_at);
    if (!isNaN(cancel) && cancel <= agora) return false;
  }
  return true;
}

function planoContemRecurso(planoNormalizado, recurso) {
  const permitidos = MAPA_RECURSOS[recurso] || [];
  // Recurso exige 'premium'
  if (permitidos.includes('premium') && planoNormalizado === 'premium') return true;
  // Qualquer outro caso é negado
  return false;
}

/**
 * Middleware: exige acesso a um determinado recurso
 * @param {string} recurso - ex.: 'investimentos_premium'
 */
function exigirRecurso(recurso) {
  return async function (req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ erro: 'unauthorized', mensagem: 'Usuário não autenticado' });
      }

      // 1) Assinatura
      const sub = await obterAssinaturaMaisRecente(userId);
      if (!assinaturaAtiva(sub)) {
        return res.status(402).json({
          erro: 'assinatura_inativa',
          mensagem: 'Sua assinatura não está ativa.',
          detalhe: { status: sub?.status || null, current_period_end: sub?.current_period_end || null }
        });
      }

      // 2) Plano → recurso
      const plano = normalizarPlano(sub.plan);
      const ok = planoContemRecurso(plano, recurso);
      if (!ok) {
        return res.status(403).json({
          erro: 'recurso_bloqueado',
          mensagem: 'Seu plano não inclui este recurso.',
          detalhe: { recurso, plano_atual: sub.plan }
        });
      }

      return next();
    } catch (e) {
      console.error('[assinaturaRecursos][exigirRecurso] erro:', e);
      return res.status(500).json({ erro: 'falha_verificar_assinatura' });
    }
  };
}

module.exports = {
  exigirRecurso,
  _internals: { normalizarPlano, planoContemRecurso, obterAssinaturaMaisRecente, assinaturaAtiva }
};