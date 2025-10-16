'use strict';
const rateLimit = require('express-rate-limit');
// ⬇️ importa o helper oficial para normalizar IPv4/IPv6
const { ipKeyGenerator } = require('express-rate-limit');
let RedisStore, Redis;
try {
  ({ RedisStore } = require('rate-limit-redis'));
  Redis = require('ioredis');
} catch (_) {}

function resposta429JSON(req, res, _next, options) {
  const retry = res.get('Retry-After') || Math.ceil((options.windowMs || 60_000) / 1000);
  return res.status(429).json({
    erro: 'limite_excedido',
    mensagem: `Muitas tentativas. Tente novamente em ~${retry}s.`,
    rota: req.originalUrl
  });
}

// Use sempre ipKeyGenerator(req) em vez de req.ip (v7 exige)
const porIP = (req) => ipKeyGenerator(req);
const porIPeEmail = (req) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  // concatena IP normalizado + email
  return `${ipKeyGenerator(req)}|${email}`;
};

function criarStoreCompartilhado() {
  const usarRedis = process.env.RATE_LIMIT_STORE === 'redis';
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_ENDPOINT;
  if (!usarRedis || !url || !RedisStore || !Redis) return undefined; // memória
  try {
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
    return new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: process.env.RATE_LIMIT_PREFIX || 'ratelimit:',
    });
  } catch (e) {
    console.warn('[rate-limit] Falha ao inicializar Redis; usando memória.', e?.message);
    return undefined;
  }
}
const STORE = criarStoreCompartilhado();

// 10 tentativas / 10min por (IP+email)
const limiterLogin = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: resposta429JSON,
  keyGenerator: porIPeEmail,
  store: STORE,
});

// 60 req / min por IP (refresh/recuperar/alterar senha etc.)
const limiterSensivel = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: resposta429JSON,
  keyGenerator: porIP,
  store: STORE,
});

// Webhooks: pico curto + sustentado
const limiterWebhookBurst = rateLimit({
  windowMs: 5 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: resposta429JSON,
  keyGenerator: porIP,
  store: STORE,
});
const limiterWebhookSustained = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: resposta429JSON,
  keyGenerator: porIP,
  store: STORE,
});
function limiterWebhook(req, res, next) {
  limiterWebhookBurst(req, res, function () {
    limiterWebhookSustained(req, res, next);
  });
}

module.exports = { limiterLogin, limiterSensivel, limiterWebhook };