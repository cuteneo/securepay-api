const TransferService = require('../../src/services/transfer.service');
const prisma = require('../../src/config/prisma');
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
} = require('../../src/utils/errors');
const { checkIdempotency, saveIdempotency } = require('../../src/utils/idempotency');

jest.mock('../../src/config/prisma', () => ({
  wallet: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  transfer: {
    create: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
  idempotencyKey: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock('../../src/utils/idempotency', () => ({
  checkIdempotency: jest.fn(),
  saveIdempotency: jest.fn(),
  hashRequestPayload: jest.fn(),
}));

describe('TransferService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSenderWallet = {
    id: 'wallet-sender-uuid',
    userId: 'user-sender',
    balance: 500.0,
    status: 'ACTIVE',
    user: { id: 'user-sender', email: 'alice@example.com', username: 'alice', fullName: 'Alice' },
  };

  const mockReceiverWallet = {
    id: 'wallet-receiver-uuid',
    userId: 'user-receiver',
    balance: 100.0,
    status: 'ACTIVE',
    user: { id: 'user-receiver', email: 'bob@example.com', username: 'bob', fullName: 'Bob' },
  };

  it('should successfully execute an atomic transfer between two users', async () => {
    checkIdempotency.mockResolvedValue(null);

    prisma.wallet.findUnique
      .mockResolvedValueOnce(mockSenderWallet) // sender wallet lookup
      .mockResolvedValueOnce(mockReceiverWallet); // receiver wallet lookup

    prisma.$transaction.mockImplementation(async (callback) => {
      return callback({
        wallet: {
          findUnique: jest.fn().mockResolvedValue(mockSenderWallet),
          update: jest.fn().mockImplementation(({ where }) => {
            if (where.id === mockSenderWallet.id) {
              return Promise.resolve({ ...mockSenderWallet, balance: 400.0 });
            }
            return Promise.resolve({ ...mockReceiverWallet, balance: 200.0 });
          }),
        },
        transfer: {
          create: jest.fn().mockResolvedValue({
            id: 'trf-1',
            reference: 'TRF_123',
            amount: 100.0,
            status: 'COMPLETED',
            note: 'Lunch share',
            createdAt: new Date(),
          }),
        },
        transaction: {
          create: jest.fn()
            .mockResolvedValueOnce({ id: 'txn-out', type: 'TRANSFER_OUT', amount: 100.0 })
            .mockResolvedValueOnce({ id: 'txn-in', type: 'TRANSFER_IN', amount: 100.0 }),
        },
      });
    });

    const result = await TransferService.transferFunds('user-sender', {
      recipientIdentifier: 'wallet-receiver-uuid',
      amount: 100.0,
      note: 'Lunch share',
    });

    expect(result.amount).toBe(100.0);
    expect(result.senderBalanceAfter).toBe(400.0);
    expect(result.recipient.username).toBe('bob');
    expect(result.status).toBe('COMPLETED');
  });

  it('should reject transfer when sender has insufficient balance', async () => {
    checkIdempotency.mockResolvedValue(null);

    const poorSenderWallet = {
      ...mockSenderWallet,
      balance: 20.0, // only $20
    };

    prisma.wallet.findUnique.mockResolvedValueOnce(poorSenderWallet);

    await expect(
      TransferService.transferFunds('user-sender', {
        recipientIdentifier: 'wallet-receiver-uuid',
        amount: 100.0,
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('should prevent self-transfer attempt', async () => {
    checkIdempotency.mockResolvedValue(null);

    // sender and recipient are the same wallet
    prisma.wallet.findUnique
      .mockResolvedValueOnce(mockSenderWallet)
      .mockResolvedValueOnce(mockSenderWallet);

    await expect(
      TransferService.transferFunds('user-sender', {
        recipientIdentifier: 'wallet-sender-uuid',
        amount: 50.0,
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('should return cached response when idempotency key is replayed', async () => {
    const cachedPayload = {
      transferId: 'trf-cached-id',
      reference: 'TRF_CACHED_123',
      amount: 50.0,
      senderBalanceAfter: 450.0,
      recipient: { username: 'bob', fullName: 'Bob', walletId: 'wallet-receiver-uuid' },
      status: 'COMPLETED',
    };

    checkIdempotency.mockResolvedValue({
      isCached: true,
      statusCode: 200,
      body: cachedPayload,
    });

    const result = await TransferService.transferFunds(
      'user-sender',
      {
        recipientIdentifier: 'wallet-receiver-uuid',
        amount: 50.0,
      },
      'idempotency-key-test-123'
    );

    expect(result.isCached).toBe(true);
    expect(result.reference).toBe('TRF_CACHED_123');
    // Ensure database transaction was NEVER called because cached response was served!
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should throw ConflictError if idempotency key payload does not match', async () => {
    checkIdempotency.mockResolvedValue({
      isConflict: true,
      message: 'Idempotency key reused with different request payload',
    });

    await expect(
      TransferService.transferFunds(
        'user-sender',
        {
          recipientIdentifier: 'wallet-receiver-uuid',
          amount: 50.0,
        },
        'idempotency-key-test-123'
      )
    ).rejects.toThrow(ConflictError);
  });
});
