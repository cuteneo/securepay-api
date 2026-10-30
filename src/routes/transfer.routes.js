const express = require('express');
const TransferController = require('../controllers/transfer.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { transferSchema } = require('../validations/transfer.validation');

const router = express.Router();

router.use(authenticate);

router.post('/', validate(transferSchema), TransferController.transferFunds);

module.exports = router;
