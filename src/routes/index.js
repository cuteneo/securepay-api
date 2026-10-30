const express = require('express');
const authRoutes = require('./auth.routes');
const walletRoutes = require('./wallet.routes');
const transferRoutes = require('./transfer.routes');
const transactionRoutes = require('./transaction.routes');
const reportRoutes = require('./report.routes');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'SecurePay API',
  });
});

router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/transfers', transferRoutes);
router.use('/transactions', transactionRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
