  const { AsyncLocalStorage } = require('async_hooks');
const jwt = require('jsonwebtoken');
const { getOrCreateDemoDb } = require('./demoDb');
require('dotenv').config();

const als = new AsyncLocalStorage();

function decodeJwtIfPresent(req) {
  try {
    const hdr = req.headers?.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function attachRequestContext(req, res, next) {
  const decoded = req.user || decodeJwtIfPresent(req) || {};
  if (!req.user && decoded) req.user = decoded;

  const isDemoHeader = String(req.headers['x-demo'] || '').trim() === '1';
  const isDemo = !!(decoded && decoded.is_demo) || isDemoHeader;
  const userKey = isDemo
    ? (decoded.sub || decoded.id || decoded.email || 'demo')
    : null;

  const demoCtx = isDemo ? getOrCreateDemoDb(userKey) : null; // { pool, ready }

  als.run({ isDemo, user: decoded, pool: demoCtx?.pool || null }, () => {
    const waitReady = demoCtx?.ready || Promise.resolve();
    waitReady.then(() => next()).catch(next);
  });
}

function getCurrentPool() {
  const store = als.getStore();
  return store?.pool || null;
}

function isDemoRequest() {
  const store = als.getStore();
  return !!store?.isDemo;
}

module.exports = {
  attachRequestContext,
  getCurrentPool,
  isDemoRequest,
};