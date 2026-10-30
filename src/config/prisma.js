const { PrismaClient } = require('@prisma/client');
const config = require('./env');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: config.env === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
  prisma = global.prisma;
}

module.exports = prisma;
