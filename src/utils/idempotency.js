const crypto = require('crypto');
const prisma = require('../config/prisma');
const logger = require('./logger');

const hashRequestPayload = (payload) => {
  return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
};

const checkIdempotency = async (key, userId, endpoint, body) => {
  if (!key) return null;

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      // Check if key belongs to user
      if (existing.userId !== userId) {
        return { isConflict: true, message: 'Idempotency key already used by another entity' };
      }

      // Check if payload matches
      const currentHash = hashRequestPayload(body);
      if (existing.requestHash !== currentHash) {
        return {
          isConflict: true,
          message: 'Idempotency key reused with different request payload',
        };
      }

      // Check expiration
      if (new Date() > new Date(existing.expiresAt)) {
        return null; // Expired, allow re-execution
      }

      return { isCached: true, statusCode: existing.responseCode, body: existing.responseBody };
    }

    return null;
  } catch (error) {
    logger.error('Error checking idempotency:', error);
    return null;
  }
};

const saveIdempotency = async (key, userId, endpoint, body, statusCode, responseBody) => {
  if (!key) return;

  try {
    const requestHash = hashRequestPayload(body);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.idempotencyKey.upsert({
      where: { key },
      update: {
        statusCode,
        responseBody,
        expiresAt,
      },
      create: {
        key,
        userId,
        endpoint,
        requestHash,
        responseCode: statusCode,
        responseBody,
        expiresAt,
      },
    });
  } catch (error) {
    logger.error('Error saving idempotency record:', error);
  }
};

module.exports = {
  checkIdempotency,
  saveIdempotency,
  hashRequestPayload,
};
