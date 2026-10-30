const prisma = require('../config/prisma');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

class TransactionService {
  static async getTransactions(userId, { page = 1, limit = 10, type, status, startDate, endDate }) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const where = {
      walletId: wallet.id,
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * limit;

    const [totalRecords, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          transfer: {
            select: {
              id: true,
              reference: true,
              note: true,
              senderWallet: {
                select: {
                  user: { select: { username: true, fullName: true } },
                },
              },
              receiverWallet: {
                select: {
                  user: { select: { username: true, fullName: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const formattedTransactions = transactions.map((t) => ({
      id: t.id,
      reference: t.reference,
      type: t.type,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      status: t.status,
      description: t.description,
      metadata: t.metadata,
      transferDetails: t.transfer
        ? {
            reference: t.transfer.reference,
            note: t.transfer.note,
            sender: t.transfer.senderWallet?.user?.username,
            receiver: t.transfer.receiverWallet?.user?.username,
          }
        : null,
      createdAt: t.createdAt,
    }));

    return {
      transactions: formattedTransactions,
      meta: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  static async getTransactionById(userId, transactionId) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [{ id: transactionId }, { reference: transactionId }],
      },
      include: {
        transfer: {
          include: {
            senderWallet: { include: { user: { select: { username: true, fullName: true } } } },
            receiverWallet: { include: { user: { select: { username: true, fullName: true } } } },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Access control check: user must own the wallet associated with this transaction
    if (transaction.walletId !== wallet.id) {
      throw new ForbiddenError('You do not have permission to view this transaction');
    }

    return {
      id: transaction.id,
      reference: transaction.reference,
      type: transaction.type,
      amount: Number(transaction.amount),
      balanceAfter: Number(transaction.balanceAfter),
      status: transaction.status,
      description: transaction.description,
      metadata: transaction.metadata,
      transfer: transaction.transfer
        ? {
            id: transaction.transfer.id,
            reference: transaction.transfer.reference,
            amount: Number(transaction.transfer.amount),
            note: transaction.transfer.note,
            sender: transaction.transfer.senderWallet?.user?.username,
            receiver: transaction.transfer.receiverWallet?.user?.username,
          }
        : null,
      createdAt: transaction.createdAt,
    };
  }
}

module.exports = TransactionService;
