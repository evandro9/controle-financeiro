const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const controller = require('../Controllers/valoresAtuaisController');

router.use(auth);

router.post('/', controller.salvarOuAtualizarValorAtual);
router.get('/', controller.listarValoresAtuais);

module.exports = router;
