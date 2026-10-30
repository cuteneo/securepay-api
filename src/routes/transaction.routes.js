const express = require('express');
const TransactionController = require('../controllers/transaction.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { transactionQuerySchema } = require('../validations/transaction.validation');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(transactionQuerySchema), TransactionController.getTransactions);
router.get('/:id', TransactionController.getTransactionById);

module.exports = router;
