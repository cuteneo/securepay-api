const AuthService = require('../../src/services/auth.service');
const prisma = require('../../src/config/prisma');
const bcrypt = require('bcryptjs');
const { ConflictError, UnauthorizedError, NotFoundError } = require('../../src/utils/errors');

jest.mock('../../src/config/prisma', () => ({
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  wallet: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
}));

describe('AuthService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user and create a default wallet', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const mockUser = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword',
        fullName: 'Test User',
        phoneNumber: null,
        role: 'USER',
        createdAt: new Date(),
      };

      const mockWallet = {
        id: 'wallet-uuid-1',
        userId: 'user-uuid-1',
        balance: 0.0,
        currency: 'USD',
        status: 'ACTIVE',
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: { create: jest.fn().mockResolvedValue(mockUser) },
          wallet: { create: jest.fn().mockResolvedValue(mockWallet) },
        });
      });

      const result = await AuthService.register({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!',
        fullName: 'Test User',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('wallet');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.wallet.balance).toBe(0);
    });

    it('should throw ConflictError if email is already taken', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-id',
        email: 'test@example.com',
        username: 'differentuser',
      });

      await expect(
        AuthService.register({
          email: 'test@example.com',
          username: 'newuser',
          password: 'Password123!',
          fullName: 'New User',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError if username is already taken', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'existing-id',
        email: 'other@example.com',
        username: 'testuser',
      });

      await expect(
        AuthService.register({
          email: 'new@example.com',
          username: 'testuser',
          password: 'Password123!',
          fullName: 'New User',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    it('should authenticate user and return token on valid credentials', async () => {
      const plainPassword = 'Password123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      prisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
        fullName: 'Test User',
        role: 'USER',
        createdAt: new Date(),
        wallet: {
          id: 'wallet-1',
          balance: 100,
          currency: 'USD',
          status: 'ACTIVE',
        },
      });

      const result = await AuthService.login({
        identifier: 'test@example.com',
        password: plainPassword,
      });

      expect(result).toHaveProperty('token');
      expect(result.user.username).toBe('testuser');
      expect(result.wallet.balance).toBe(100);
    });

    it('should throw UnauthorizedError when user is not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        AuthService.login({
          identifier: 'nonexistent@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError on incorrect password', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);

      prisma.user.findFirst.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
      });

      await expect(
        AuthService.login({
          identifier: 'test@example.com',
          password: 'WrongPassword!',
        })
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('getProfile', () => {
    it('should return profile details with wallet balance', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        phoneNumber: null,
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
        wallet: {
          id: 'wallet-uuid-1',
          balance: 250.5,
          currency: 'USD',
          status: 'ACTIVE',
          createdAt: new Date(),
        },
      });

      const profile = await AuthService.getProfile('user-uuid-1');
      expect(profile.username).toBe('testuser');
      expect(profile.wallet.balance).toBe(250.5);
    });

    it('should throw NotFoundError if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(AuthService.getProfile('invalid-id')).rejects.toThrow(NotFoundError);
    });
  });
});
