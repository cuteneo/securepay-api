const express = require('express');
const WalletController = require('../controllers/wallet.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { depositSchema, withdrawSchema } = require('../validations/wallet.validation');

const router = express.Router();

router.use(authenticate);

router.get('/', WalletController.getWallet);
router.post('/deposit', validate(depositSchema), WalletController.deposit);
router.post('/withdraw', validate(withdrawSchema), WalletController.withdraw);

module.exports = router;
