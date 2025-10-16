const bcrypt = require('bcryptjs');

const hash = '$2b$10$HnjdvspavudZuSi8tuG9g.nAgG4YrrkUoKmaJqvJeFTBBRrM4eQWq';
const senhaDigitada = '123456';

bcrypt.compare(senhaDigitada, hash).then((resultado) => {
  console.log('Senha confere?', resultado); // true ou false
});
