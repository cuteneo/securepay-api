const winston = require('winston');
const config = require('../config/env');

const sensitiveFields = ['password', 'token', 'authorization', 'secret', 'creditCard'];

const maskSensitiveData = winston.format((info) => {
  if (typeof info.message === 'object') {
    const sanitized = { ...info.message };
    for (const key of Object.keys(sanitized)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    info.message = sanitized;
  }
  return info;
});

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    maskSensitiveData(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'securepay-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          if (stack) {
            return `[${timestamp}] ${level}: ${message}\n${stack}`;
          }
          if (typeof message === 'object') {
            return `[${timestamp}] ${level}: ${JSON.stringify(message, null, 2)}`;
          }
          return `[${timestamp}] ${level}: ${message}`;
        })
      ),
    }),
  ],
});

module.exports = logger;
