const crypto = require('crypto');
const prisma = require('../config/prisma');
const {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} = require('../utils/errors');
const { checkIdempotency, saveIdempotency } = require('../utils/idempotency');
const logger = require('../utils/logger');

class TransferService {
  static generateReference(prefix = 'TRF') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }

  static async transferFunds(senderUserId, { recipientIdentifier, amount, note }, idempotencyKey = null) {
    if (amount <= 0) {
      throw new BadRequestError('Transfer amount must be strictly greater than 0');
    }

    // 1. Check idempotency if key is provided
    if (idempotencyKey) {
      const idempotencyResult = await checkIdempotency(
        idempotencyKey,
        senderUserId,
        '/api/v1/transfers',
        { recipientIdentifier, amount, note }
      );

      if (idempotencyResult) {
        if (idempotencyResult.isConflict) {
          throw new ConflictError(idempotencyResult.message);
        }
        if (idempotencyResult.isCached) {
          logger.info(`Idempotent request detected. Returning cached transfer for key: ${idempotencyKey}`);
          return { ...idempotencyResult.body, isCached: true };
        }
      }
    }

    // 2. Resolve sender wallet
    const senderWallet = await prisma.wallet.findUnique({
      where: { userId: senderUserId },
      include: {
        user: { select: { id: true, email: true, username: true, fullName: true } },
      },
    });

    if (!senderWallet) {
      throw new NotFoundError('Sender wallet does not exist');
    }

    if (senderWallet.status !== 'ACTIVE') {
      throw new ForbiddenError(`Sender wallet is ${senderWallet.status}`);
    }

    // Check sender balance
    const senderBalance = Number(senderWallet.balance);
    if (senderBalance < amount) {
      throw new BadRequestError(
        `Insufficient balance. Available: $${senderBalance.toFixed(2)}, required: $${amount.toFixed(2)}`
      );
    }

    // 3. Resolve recipient (by email, username, or wallet ID)
    let recipientWallet = null;

    if (recipientIdentifier.includes('@')) {
      const recipientUser = await prisma.user.findUnique({
        where: { email: recipientIdentifier.toLowerCase() },
        include: { wallet: true },
      });
      if (recipientUser && recipientUser.wallet) {
        recipientWallet = { ...recipientUser.wallet, user: recipientUser };
      }
    } else {
      // Check if recipientIdentifier is a wallet ID
      recipientWallet = await prisma.wallet.findUnique({
        where: { id: recipientIdentifier },
        include: {
          user: { select: { id: true, email: true, username: true, fullName: true } },
        },
      });

      // If not wallet ID, check by username
      if (!recipientWallet) {
        const recipientUser = await prisma.user.findUnique({
          where: { username: recipientIdentifier },
          include: { wallet: true },
        });
        if (recipientUser && recipientUser.wallet) {
          recipientWallet = { ...recipientUser.wallet, user: recipientUser };
        }
      }
    }

    if (!recipientWallet) {
      throw new NotFoundError('Recipient account or wallet could not be found');
    }

    // 4. Prevent self-transfers
    if (senderWallet.id === recipientWallet.id || senderWallet.userId === recipientWallet.userId) {
      throw new BadRequestError('Cannot transfer funds to your own wallet');
    }

    if (recipientWallet.status !== 'ACTIVE') {
      throw new BadRequestError(`Recipient wallet cannot accept funds: Wallet is ${recipientWallet.status}`);
    }

    const transferReference = this.generateReference('TRF');
    const senderTxnRef = this.generateReference('TXN_OUT');
    const receiverTxnRef = this.generateReference('TXN_IN');

    // 5. Execute atomic transaction with deadlock avoidance
    // Order wallet updates deterministically by ID to avoid database deadlocks
    const firstWalletId = senderWallet.id < recipientWallet.id ? senderWallet.id : recipientWallet.id;
    const isSenderFirst = firstWalletId === senderWallet.id;

    const result = await prisma.$transaction(async (tx) => {
      // Re-verify sender balance inside transaction
      const currentSender = await tx.wallet.findUnique({
        where: { id: senderWallet.id },
      });

      if (Number(currentSender.balance) < amount) {
        throw new BadRequestError('Insufficient balance at execution time');
      }

      let updatedSenderWallet;
      let updatedReceiverWallet;

      if (isSenderFirst) {
        updatedSenderWallet = await tx.wallet.update({
          where: { id: senderWallet.id },
          data: { balance: { decrement: amount } },
        });
        updatedReceiverWallet = await tx.wallet.update({
          where: { id: recipientWallet.id },
          data: { balance: { increment: amount } },
        });
      } else {
        updatedReceiverWallet = await tx.wallet.update({
          where: { id: recipientWallet.id },
          data: { balance: { increment: amount } },
        });
        updatedSenderWallet = await tx.wallet.update({
          where: { id: senderWallet.id },
          data: { balance: { decrement: amount } },
        });
      }

      // Record Transfer
      const transfer = await tx.transfer.create({
        data: {
          reference: transferReference,
          senderWalletId: senderWallet.id,
          receiverWalletId: recipientWallet.id,
          amount,
          status: 'COMPLETED',
          note: note || null,
        },
      });

      // Record Sender Debit (TRANSFER_OUT)
      const senderTxn = await tx.transaction.create({
        data: {
          reference: senderTxnRef,
          walletId: senderWallet.id,
          type: 'TRANSFER_OUT',
          amount,
          balanceAfter: updatedSenderWallet.balance,
          status: 'COMPLETED',
          description: note || `Transfer to ${recipientWallet.user.username}`,
          transferId: transfer.id,
          metadata: {
            recipient: {
              walletId: recipientWallet.id,
              username: recipientWallet.user.username,
              fullName: recipientWallet.user.fullName,
            },
          },
        },
      });

      // Record Receiver Credit (TRANSFER_IN)
      const receiverTxn = await tx.transaction.create({
        data: {
          reference: receiverTxnRef,
          walletId: recipientWallet.id,
          type: 'TRANSFER_IN',
          amount,
          balanceAfter: updatedReceiverWallet.balance,
          status: 'COMPLETED',
          description: note || `Transfer from ${senderWallet.user.username}`,
          transferId: transfer.id,
          metadata: {
            sender: {
              walletId: senderWallet.id,
              username: senderWallet.user.username,
              fullName: senderWallet.user.fullName,
            },
          },
        },
      });

      return {
        transfer,
        senderTxn,
        receiverTxn,
        newBalance: Number(updatedSenderWallet.balance),
      };
    });

    const responsePayload = {
      transferId: result.transfer.id,
      reference: result.transfer.reference,
      amount: Number(result.transfer.amount),
      senderBalanceAfter: result.newBalance,
      recipient: {
        username: recipientWallet.user.username,
        fullName: recipientWallet.user.fullName,
        walletId: recipientWallet.id,
      },
      note: result.transfer.note,
      status: result.transfer.status,
      timestamp: result.transfer.createdAt,
    };

    // 6. Save idempotency key if provided
    if (idempotencyKey) {
      await saveIdempotency(
        idempotencyKey,
        senderUserId,
        '/api/v1/transfers',
        { recipientIdentifier, amount, note },
        200,
        responsePayload
      );
    }

    logger.info(
      `Transfer completed: ${transferReference} ($${amount}) from ${senderWallet.user.username} to ${recipientWallet.user.username}`
    );

    return responsePayload;
  }
}

module.exports = TransferService;
