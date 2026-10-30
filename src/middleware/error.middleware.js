const { AppError } = require('../utils/errors');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const config = require('../config/env');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || null;

  // Log error with request context (redacting sensitive body)
  logger.error({
    message: err.message,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  // Handle SyntaxError (e.g. malformed JSON in request body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }

  // Handle Prisma Database Errors
  if (err.code) {
    switch (err.code) {
      case 'P2002': {
        statusCode = 409;
        const target = err.meta?.target ? ` on field: ${err.meta.target}` : '';
        message = `A duplicate entry was detected${target}.`;
        break;
      }
      case 'P2025': {
        statusCode = 404;
        message = 'Requested record was not found in the database.';
        break;
      }
      case 'P2003': {
        statusCode = 400;
        message = 'Foreign key constraint violation.';
        break;
      }
      default:
        if (err.name === 'PrismaClientKnownRequestError') {
          statusCode = 400;
          message = 'Database operation failed.';
        }
    }
  }

  // In production, do not leak internal system details for 500 errors
  if (config.env === 'production' && statusCode === 500) {
    message = 'An unexpected internal error occurred. Please contact support.';
    errors = null;
  }

  return ApiResponse.error(res, message, statusCode, errors);
};

// 404 Not Found Middleware for unmatched routes
const notFoundHandler = (req, res, next) => {
  return ApiResponse.error(
    res,
    `Cannot ${req.method} ${req.originalUrl} - Route not found`,
    404
  );
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
