const crypto = require('crypto');
const prisma = require('../config/prisma');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../utils/errors');
const logger = require('../utils/logger');

class WalletService {
  static generateReference(prefix = 'TXN') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  static async getWalletByUserId(userId) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found for this user');
    }

    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      status: wallet.status,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
      user: wallet.user,
    };
  }

  static async deposit(userId, { amount, description }) {
    if (amount <= 0) {
      throw new BadRequestError('Deposit amount must be strictly greater than 0');
    }

    const reference = this.generateReference('DEP');

    // Atomic execution with database transaction
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundError('Wallet not found');
      }

      if (wallet.status !== 'ACTIVE') {
        throw new ForbiddenError(`Cannot deposit funds: Wallet is ${wallet.status}`);
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          reference,
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount,
          balanceAfter: updatedWallet.balance,
          status: 'COMPLETED',
          description: description || 'Simulated wallet deposit',
          metadata: {
            method: 'SIMULATED_GATEWAY',
          },
        },
      });

      return { wallet: updatedWallet, transaction };
    });

    logger.info(`Deposit successful for wallet ${result.wallet.id}: +${amount}`);

    return {
      reference: result.transaction.reference,
      walletId: result.wallet.id,
      amount: Number(result.transaction.amount),
      newBalance: Number(result.wallet.balance),
      currency: result.wallet.currency,
      type: result.transaction.type,
      status: result.transaction.status,
      timestamp: result.transaction.createdAt,
    };
  }

  static async withdraw(userId, { amount, description }) {
    if (amount <= 0) {
      throw new BadRequestError('Withdrawal amount must be strictly greater than 0');
    }

    const reference = this.generateReference('WTH');

    // Atomic execution with database transaction
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundError('Wallet not found');
      }

      if (wallet.status !== 'ACTIVE') {
        throw new ForbiddenError(`Cannot withdraw funds: Wallet is ${wallet.status}`);
      }

      const currentBalance = Number(wallet.balance);
      if (currentBalance < amount) {
        throw new BadRequestError(
          `Insufficient funds. Current balance is $${currentBalance.toFixed(2)}, required $${amount.toFixed(2)}`
        );
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          reference,
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount,
          balanceAfter: updatedWallet.balance,
          status: 'COMPLETED',
          description: description || 'Simulated wallet withdrawal',
          metadata: {
            method: 'SIMULATED_PAYOUT',
          },
        },
      });

      return { wallet: updatedWallet, transaction };
    });

    logger.info(`Withdrawal successful for wallet ${result.wallet.id}: -${amount}`);

    return {
      reference: result.transaction.reference,
      walletId: result.wallet.id,
      amount: Number(result.transaction.amount),
      newBalance: Number(result.wallet.balance),
      currency: result.wallet.currency,
      type: result.transaction.type,
      status: result.transaction.status,
      timestamp: result.transaction.createdAt,
    };
  }
}

module.exports = WalletService;
