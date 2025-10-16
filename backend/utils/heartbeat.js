const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * Faz um GET em uma URL de heartbeat (Healthchecks/BetterStack etc.).
 * Não lança erro: sempre resolve com { ok, status }.
 */
function ping(urlString, { timeoutMs = 5000 } = {}) {
  if (!urlString) return Promise.resolve({ ok: false, status: 0, reason: 'no_url' });
  try {
    const u = new URL(urlString);
    const lib = u.protocol === 'https:' ? https : http;
    return new Promise((resolve) => {
      const req = lib.get(u, { timeout: timeoutMs }, (res) => {
        // drenar/descartar o corpo para liberar o socket
        res.resume();
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        resolve({ ok, status: res.statusCode });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 0, reason: 'timeout' });
      });
      req.on('error', () => resolve({ ok: false, status: 0, reason: 'network' }));
    });
  } catch {
    return Promise.resolve({ ok: false, status: 0, reason: 'bad_url' });
  }
}

module.exports = { ping };