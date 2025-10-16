const jwt = require('jsonwebtoken');
const SECRET = 'chave-secreta-simples';

function autenticar(req, res, next) {
  let token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Token ausente' });

  // Se vier no formato "Bearer <token>", remove o "Bearer "
  if (token.startsWith('Bearer ')) {
    token = token.replace('Bearer ', '');
    console.log('🔐 SECRET usado no middleware:', SECRET);
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = autenticar;
