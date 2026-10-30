const express = require('express');
const ReportController = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/dashboard', ReportController.getDashboard);
router.get('/monthly', ReportController.getMonthlySummary);

module.exports = router;
