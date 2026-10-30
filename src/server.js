const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const prisma = require('./config/prisma');

const server = app.listen(config.port, () => {
  logger.info(`=======================================================`);
  logger.info(` SecurePay API Server is running on port ${config.port}`);
  logger.info(` Environment: ${config.env}`);
  logger.info(` API Documentation: http://localhost:${config.port}/api-docs`);
  logger.info(` Health Check: http://localhost:${config.port}${config.apiPrefix}/health`);
  logger.info(`=======================================================`);
});

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} signal received: closing HTTP server and database connections...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during database disconnect:', err);
      process.exit(1);
    }
  });

  // Force close if graceful shutdown takes longer than 10 seconds
  setTimeout(() => {
    logger.error('Forcefully terminating process after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  process.exit(1);
});
