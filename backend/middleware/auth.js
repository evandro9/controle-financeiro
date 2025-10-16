const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET;

module.exports = function autenticar(req, res, next) {
  let token = req.headers['authorization'];

  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  if (token.startsWith('Bearer ')) {
    token = token.replace('Bearer ', '');
  }

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.user = decoded;
    next();
  });
};
