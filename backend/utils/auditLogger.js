const fs = require('fs');
const path = require('path');

const AUDIT_DIR = path.join(__dirname, '..', 'logs');
const AUDIT_FILE = path.join(AUDIT_DIR, 'audit.ndjson');

// Garante diretório
if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });

/**
 * Registra um evento de auditoria em formato NDJSON.
 * @param {Object} evt - { action, entityType, entityId, userId, ip, userAgent, details }
 */
function audit(evt = {}) {
  const record = {
    ts: new Date().toISOString(),
    action: evt.action,
    entityType: evt.entityType,
    entityId: evt.entityId ?? null,
    userId: evt.userId ?? null,
    ip: evt.ip ?? null,
    userAgent: evt.userAgent ?? null,
    details: evt.details ?? null
  };
  fs.appendFile(AUDIT_FILE, JSON.stringify(record) + '\n', () => {});
}

module.exports = { audit, AUDIT_FILE };