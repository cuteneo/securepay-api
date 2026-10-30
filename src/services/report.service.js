const prisma = require('../config/prisma');
const { NotFoundError } = require('../utils/errors');

class ReportService {
  static async getDashboardSummary(userId, { startDate, endDate } = {}) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: { select: { username: true, fullName: true, email: true } },
      },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
      };
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
        status: 'COMPLETED',
        ...dateFilter,
      },
    });

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let totalTransfersSent = 0;
    let totalTransfersReceived = 0;

    let depositCount = 0;
    let withdrawalCount = 0;
    let transferSentCount = 0;
    let transferReceivedCount = 0;

    for (const t of transactions) {
      const amt = Number(t.amount);
      switch (t.type) {
        case 'DEPOSIT':
          totalDeposits += amt;
          depositCount++;
          break;
        case 'WITHDRAWAL':
          totalWithdrawals += amt;
          withdrawalCount++;
          break;
        case 'TRANSFER_OUT':
          totalTransfersSent += amt;
          transferSentCount++;
          break;
        case 'TRANSFER_IN':
          totalTransfersReceived += amt;
          transferReceivedCount++;
          break;
      }
    }

    const netFlow = totalDeposits + totalTransfersReceived - totalWithdrawals - totalTransfersSent;

    return {
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        currentBalance: Number(wallet.balance),
        status: wallet.status,
      },
      summary: {
        netFlow: Number(netFlow.toFixed(2)),
        totalVolume: Number((totalDeposits + totalWithdrawals + totalTransfersSent + totalTransfersReceived).toFixed(2)),
        deposits: {
          totalAmount: Number(totalDeposits.toFixed(2)),
          count: depositCount,
        },
        withdrawals: {
          totalAmount: Number(totalWithdrawals.toFixed(2)),
          count: withdrawalCount,
        },
        transfersSent: {
          totalAmount: Number(totalTransfersSent.toFixed(2)),
          count: transferSentCount,
        },
        transfersReceived: {
          totalAmount: Number(totalTransfersReceived.toFixed(2)),
          count: transferReceivedCount,
        },
        totalTransactions: transactions.length,
      },
      period: {
        startDate: startDate || 'ALL_TIME',
        endDate: endDate || 'CURRENT',
      },
    };
  }

  static async getMonthlySummary(userId, year = new Date().getFullYear()) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

    const transactions = await prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
        status: 'COMPLETED',
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const months = Array.from({ length: 12 }, (_, i) => {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return {
        month: i + 1,
        monthName: monthNames[i],
        deposits: 0,
        withdrawals: 0,
        transfersSent: 0,
        transfersReceived: 0,
        netChange: 0,
        count: 0,
      };
    });

    for (const t of transactions) {
      const monthIndex = new Date(t.createdAt).getMonth();
      const amt = Number(t.amount);
      const m = months[monthIndex];

      m.count++;
      switch (t.type) {
        case 'DEPOSIT':
          m.deposits += amt;
          m.netChange += amt;
          break;
        case 'WITHDRAWAL':
          m.withdrawals += amt;
          m.netChange -= amt;
          break;
        case 'TRANSFER_OUT':
          m.transfersSent += amt;
          m.netChange -= amt;
          break;
        case 'TRANSFER_IN':
          m.transfersReceived += amt;
          m.netChange += amt;
          break;
      }
    }

    const formattedMonthly = months.map((m) => ({
      ...m,
      deposits: Number(m.deposits.toFixed(2)),
      withdrawals: Number(m.withdrawals.toFixed(2)),
      transfersSent: Number(m.transfersSent.toFixed(2)),
      transfersReceived: Number(m.transfersReceived.toFixed(2)),
      netChange: Number(m.netChange.toFixed(2)),
    }));

    return {
      year,
      currency: wallet.currency,
      currentBalance: Number(wallet.balance),
      monthlyBreakdown: formattedMonthly,
    };
  }
}

module.exports = ReportService;
