require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { startDailyReconciler } = require('./jobs/scheduler');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');
const dbPing = require('./utils/dbPing');
const app = express();
// real IPs behind proxy (ngrok/nginx)
app.set('trust proxy', 1);
// Oculta o header "X-Powered-By"
app.disable('x-powered-by');
const PORT = process.env.PORT || 3001;
const hotmartWebhooks = require('./routes/hotmartWebhooks');
const resolveTenant = require('./middleware/tenant'); // novo
const autenticar = require('./middleware/auth');
const { requireActiveForWrites } = require('./middleware/subscriptionGuard');
const { exigirRecurso } = require('./middleware/assinaturaRecursos');
const { limiterLogin, limiterSensivel, limiterWebhook } = require('./middleware/limitesRequisicoes');
const auditoria = require('./middleware/auditoria');

app.use(express.json());
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ====== Request ID + Logs HTTP (ignora /healthz nos auto-logs) ======
app.use(requestId);
const isProd = process.env.NODE_ENV === 'production';
app.use(pinoHttp({
  // continua ignorando o health check
  autoLogging: { ignorePaths: ['/healthz'] },
  // Só loga sucesso (2xx/3xx) em produção; em dev fica "silent".
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return isProd ? 'info' : 'silent';
  },
  // Redações adicionais para não vazar token no console
  redact: {
    paths: [
      'req.headers',              // remove todos os headers (resolve hífens)
      'req.body.password',
      'req.body.senha',
      'req.body.token'
    ],
    remove: true
  },
  // Evita duplicar reqId no log (deixa só req.id padrão do pino-http)
  customProps: (req) => ({
    userId: req.user?.id ?? undefined
  })
}));

// ====== Security headers (Helmet) — somente em produção ======
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    // Mantemos seu HSTS manual abaixo para não duplicar o header:
    hsts: false,
    // Evita bloquear embeds/terceiros inesperadamente
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Esta API não serve HTML; CSP fica desativada por ora.
    // Quando o front for servido no mesmo domínio, configuramos uma CSP sob medida.
    contentSecurityPolicy: false
  }));
}

// ====== CORS configurável por ambiente ======
const allowNgrok   = String(process.env.CORS_ALLOW_NGROK   || '').toLowerCase() === 'true';
// libera *.vercel.app (previews) — true por padrão
const allowVercel  = String(process.env.CORS_ALLOW_VERCEL  || 'true').toLowerCase() === 'true';
const explicitOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: function (origin, cb) {
    // Requisições sem Origin (ex.: curl, backend → backend) são permitidas
    if (!origin) return cb(null, true);
    try {
      const url = new URL(origin);
      const host = url.hostname || '';
      const isExplicit = explicitOrigins.includes(origin);
      const isNgrok = allowNgrok && (
        host.endsWith('.ngrok.io') || host.endsWith('.ngrok-free.app')
      );
      const isVercel = allowVercel && host.endsWith('.vercel.app'); // ✅ previews da Vercel
      if (isExplicit || isNgrok || isVercel) return cb(null, true);
    } catch (_) {}
    return cb(new Error('Not allowed by CORS'));
  },
  // Permita só o necessário
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Authorization','Content-Type'],
  credentials: false, // usando Bearer; se migrar p/ cookie, troque para true e ajuste CORS_ORIGINS
};
app.use(cors(corsOptions));
app.use(auditoria());

// ====== HTTPS obrigatório + HSTS (apenas em produção) ======
if (process.env.NODE_ENV === 'production') {
  // Redireciona http → https (considerando proxy)
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    if (proto === 'https') return next();
    const host = req.headers.host;
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
  // HSTS: instrui o navegador a só usar HTTPS
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
}

// ====== Health check (liveness/readiness simples) ======
app.get('/healthz', async (req, res) => {
  const r = await dbPing();
  if (!r.ok) logger.error({ err: r.err }, 'healthz-db-ping-failed');
  const payload = {
    status: r.ok ? 'ok' : 'degraded',
    uptimeSec: Math.round(process.uptime()),
    db: r.ok ? 'ok' : 'error',
    latencyMs: r.latencyMs,
    version: process.env.APP_VERSION || 'dev'
  };
  res.status(r.ok ? 200 : 503).json(payload);
});

// ====== Captura erros não tratados (última linha de defesa) ======
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'UnhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'UncaughtException');
  // Opcional: process.exit(1) em ambientes onde um PM2/systemd fará restart
});

app.use(resolveTenant); // injeta req.tenantId (subdomínio ou header)
// ⚠️ Rotas públicas (SEM auth/guard) — DEVEM vir antes
const loginRoutes = require('./routes/loginRoutes');
app.use('/auth', require('./routes/authMagicRoutes'));    
app.use('/login', limiterLogin, loginRoutes);
app.use('/webhooks', limiterWebhook); // protege /webhooks/*
app.use('/webhooks/hotmart', hotmartWebhooks);
// (opcional) criação de usuário pública:
const usuariosRoutes = require('./routes/usuariosRoutes');
app.use('/usuarios/recuperar-senha', limiterSensivel);
app.use('/usuarios/alterar-senha', limiterSensivel);
app.use('/usuarios', usuariosRoutes);
// A partir daqui: exige token (autenticar)
app.use(autenticar);
app.use(require('./routes/consentsRoutes'));
// 🔒 Gate de reaceite de Termos/Privacidade
const legalGate = require('./middleware/legalGate');
app.use(legalGate);
// E bloqueia escrita se assinatura não estiver 'active'
app.use(requireActiveForWrites);
const lancamentosRoutes = require('./routes/lancamentos');
const planejamentosRoutes = require('./routes/planejamentos');
const formasPagamentoRoutes = require('./routes/formas-pagamento');
const investimentosRoutes = require('./routes/investimentosRoutes');
const valoresAtuaisRoutes = require('./routes/valoresAtuaisRoutes');
const investimentosEvolucaoRoutes = require('./routes/investimentosEvolucaoRoutes');
const investimentosAtuaisRoutes = require('./routes/investimentosAtuaisRoutes');
const valoresPendentesRoutes = require('./routes/valoresPendentesRoutes');
const rebalanceamentoRoutes = require('./routes/rebalanceamentoRoutes');
const analisesRoutes = require('./routes/analisesRoutes');
const analisesResumoRoutes = require('./routes/analisesResumoRoutes');
const rentabilidadeRoutes = require('./routes/investimentosRentabilidadeRoutes');
const categoriasComSubRoutes = require('./routes/categoriasComSub');
const subcategoriasRoutes = require('./routes/subcategoriasRoutes');
const categoriasRoutes = require('./routes/categoriasRoutes');
//app.use('/login', authRoutes);
const lancamentosRecorrentes = require('./routes/lancamentosRecorrentes');
const recorrentesLancamentos = require('./routes/recorrentesLancamentos');
const benchmarksRoutes = require('./routes/benchmarksRoutes');
const planosRoutes = require('./routes/planosRoutes');
const planosMovimentosRoutes = require('./routes/planosMovimentosRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const planosDashboardRoutes = require('./routes/planosDashboardRoutes');
const importacoesRoutes = require('./routes/importacoesRoutes');
const regrasRoutes = require('./routes/regrasRoutes');
const importacoesB3MovimentacaoRoutes = require('./routes/importacoesB3MovimentacaoRoutes'); // NOVO
const patrimonioMoedaRoutes = require('./routes/patrimonioMoedaRoutes');
const meRoutes = require('./routes/meRoutes');
const assinaturaRoutes = require('./routes/assinaturaRoutes');
app.use('/categorias-com-sub', require('./routes/categoriasComSub'));
app.use('/lancamentos', lancamentosRoutes);
app.use('/planejamentos', planejamentosRoutes);
app.use('/formas-pagamento', formasPagamentoRoutes);
// ⚠️ Rotas analíticas/avançadas de investimentos (premium)
app.use('/investimentos', exigirRecurso('investimentos_premium'), rentabilidadeRoutes);

// Módulo genérico de investimentos (CRUD) — liberado para básico/premium
app.use('/investimentos', investimentosRoutes);
app.use('/valores-atuais', valoresAtuaisRoutes);
app.use('/investimentos/evolucao',  exigirRecurso('investimentos_premium'), investimentosEvolucaoRoutes);
app.use('/investimentos/atuais',    exigirRecurso('investimentos_premium'), investimentosAtuaisRoutes);
app.use('/valores-atuais/pendentes', valoresPendentesRoutes);
app.use('/investimentos/rebalanceamento', exigirRecurso('investimentos_premium'), rebalanceamentoRoutes);
app.use('/analises', require('./routes/analisesRecorrentesRoutes'));
app.use('/analises', analisesRoutes);
app.use('/analises', analisesResumoRoutes);
app.use(analisesResumoRoutes); // se preferir manter assim, ao menos ficou DEPOIS das importações
app.use('/login', loginRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/categorias-com-sub', categoriasComSubRoutes);
app.use('/subcategorias', subcategoriasRoutes);
app.use('/categorias', categoriasRoutes);
app.use('/lancamentos-recorrentes', lancamentosRecorrentes);
app.use('/lancamentos/recorrente', recorrentesLancamentos);
app.use('/benchmarks', benchmarksRoutes);
app.use('/planos', planosRoutes);
app.use('/planos-movimentos', planosMovimentosRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/planos-dashboard', planosDashboardRoutes);
app.use('/patrimonio', require('./routes/patrimonio'));
app.use('/', importacoesRoutes);
app.use('/', regrasRoutes);
app.use('/importacoes/investimentos', require('./routes/investimentosImportB3Routes'));
app.use('/investimentos/classes', require('./routes/investimentoClassesRoutes'));
app.use('/investimentos/subclasses', require('./routes/investimentoSubclassesRoutes'));
app.use('/importacoes/investimentos', importacoesB3MovimentacaoRoutes); // movimentação (bonificação)
app.use('/investimentos/proventos', require('./routes/proventos/proventos'));
app.use('/investimentos/proventos', require('./routes/proventos/import_b3'));
app.use('/investimentos/posicao-mensal-por-ativo', exigirRecurso('investimentos_premium'), require('./routes/investimentosPosicaoMensalPorAtivoRoutes'));
app.use('/patrimonio', patrimonioMoedaRoutes);
app.use(require('./routes/indicesRoutes'));
app.use(require('./routes/yahooAutocompleteRoutes'));
app.use(require('./routes/catalogoRoutes'));
app.use('/regras-lancamentos', require('./routes/regrasLancamentosRoutes'))
app.use('/me', meRoutes);
app.use('/assinatura', assinaturaRoutes);
app.use('/user-tours', require('./routes/userTourRoutes'));
app.use('/user-preferences', require('./routes/userPreferencesRoutes'));

app.get('/', (req, res) => {
  res.send('Servidor funcionando! 🚀');
});

// ✅ Fallback 404 em JSON para evitar "Resposta não é JSON"
app.use((req, res) => {
  res
    .status(404)
    .json({ erro: 'Rota não encontrada', method: req.method, path: req.path });
});

startDailyReconciler({ verbose: true });

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});