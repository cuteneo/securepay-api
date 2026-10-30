const WalletService = require('../../src/services/wallet.service');
const prisma = require('../../src/config/prisma');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../../src/utils/errors');

jest.mock('../../src/config/prisma', () => ({
  wallet: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}));

describe('WalletService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deposit', () => {
    it('should successfully deposit funds and create a transaction ledger entry', async () => {
      const mockWallet = {
        id: 'wallet-uuid-1',
        userId: 'user-1',
        balance: 100.0,
        currency: 'USD',
        status: 'ACTIVE',
      };

      const mockUpdatedWallet = {
        ...mockWallet,
        balance: 150.0,
      };

      const mockTransaction = {
        id: 'txn-1',
        reference: 'DEP_123',
        type: 'DEPOSIT',
        amount: 50.0,
        balanceAfter: 150.0,
        status: 'COMPLETED',
        createdAt: new Date(),
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          wallet: {
            findUnique: jest.fn().mockResolvedValue(mockWallet),
            update: jest.fn().mockResolvedValue(mockUpdatedWallet),
          },
          transaction: {
            create: jest.fn().mockResolvedValue(mockTransaction),
          },
        });
      });

      const result = await WalletService.deposit('user-1', {
        amount: 50.0,
        description: 'Test deposit',
      });

      expect(result.amount).toBe(50.0);
      expect(result.newBalance).toBe(150.0);
      expect(result.type).toBe('DEPOSIT');
      expect(result.status).toBe('COMPLETED');
    });

    it('should reject non-positive deposit amount', async () => {
      await expect(
        WalletService.deposit('user-1', { amount: -10 })
      ).rejects.toThrow(BadRequestError);

      await expect(
        WalletService.deposit('user-1', { amount: 0 })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw ForbiddenError if wallet is frozen', async () => {
      const mockFrozenWallet = {
        id: 'wallet-uuid-1',
        userId: 'user-1',
        balance: 100.0,
        status: 'FROZEN',
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          wallet: {
            findUnique: jest.fn().mockResolvedValue(mockFrozenWallet),
          },
        });
      });

      await expect(
        WalletService.deposit('user-1', { amount: 50.0 })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('withdraw', () => {
    it('should successfully withdraw funds when balance is sufficient', async () => {
      const mockWallet = {
        id: 'wallet-uuid-1',
        userId: 'user-1',
        balance: 200.0,
        currency: 'USD',
        status: 'ACTIVE',
      };

      const mockUpdatedWallet = {
        ...mockWallet,
        balance: 130.0,
      };

      const mockTransaction = {
        id: 'txn-wth-1',
        reference: 'WTH_123',
        type: 'WITHDRAWAL',
        amount: 70.0,
        balanceAfter: 130.0,
        status: 'COMPLETED',
        createdAt: new Date(),
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          wallet: {
            findUnique: jest.fn().mockResolvedValue(mockWallet),
            update: jest.fn().mockResolvedValue(mockUpdatedWallet),
          },
          transaction: {
            create: jest.fn().mockResolvedValue(mockTransaction),
          },
        });
      });

      const result = await WalletService.withdraw('user-1', {
        amount: 70.0,
        description: 'ATM Cash out',
      });

      expect(result.amount).toBe(70.0);
      expect(result.newBalance).toBe(130.0);
      expect(result.type).toBe('WITHDRAWAL');
    });

    it('should throw BadRequestError when balance is insufficient (prevents negative balance)', async () => {
      const mockWallet = {
        id: 'wallet-uuid-1',
        userId: 'user-1',
        balance: 40.0, // only $40
        status: 'ACTIVE',
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          wallet: {
            findUnique: jest.fn().mockResolvedValue(mockWallet),
          },
        });
      });

      await expect(
        WalletService.withdraw('user-1', { amount: 100.0 }) // trying to withdraw $100
      ).rejects.toThrow(BadRequestError);
    });
  });
});
