// middleware/tenant.js
function extractSubdomain(host) {
  if (!host) return null;
  const base = host.split(':')[0]; // remove :port
  const parts = base.split('.');
  if (parts.length < 3) return null;     // ex.: app.com → sem subdomínio
  return parts[0];                        // cliente.app.com → "cliente"
}

module.exports = function resolveTenant(req, _res, next) {
  const fromHeader = typeof req.headers['x-tenant-id'] === 'string'
    ? req.headers['x-tenant-id'].trim()
    : null;
  const fromSub = extractSubdomain(req.headers.host);
  req.tenantId = fromHeader || fromSub || null;
  next();
};