const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const config = require('../config/env');
const { ConflictError, UnauthorizedError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

class AuthService {
  static generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  static async register({ email, username, password, fullName, phoneNumber }) {
    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username },
          ...(phoneNumber ? [{ phoneNumber }] : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        throw new ConflictError('An account with this email already exists');
      }
      if (existingUser.username === username) {
        throw new ConflictError('Username is already taken');
      }
      if (phoneNumber && existingUser.phoneNumber === phoneNumber) {
        throw new ConflictError('Phone number is already associated with another account');
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Atomically create user and default wallet
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          username,
          password: hashedPassword,
          fullName,
          phoneNumber: phoneNumber || null,
        },
      });

      const newWallet = await tx.wallet.create({
        data: {
          userId: newUser.id,
          balance: 0.0,
          currency: 'USD',
          status: 'ACTIVE',
        },
      });

      return { user: newUser, wallet: newWallet };
    });

    const token = this.generateToken(result.user);

    logger.info(`User registered successfully: ${result.user.id} (${result.user.username})`);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        fullName: result.user.fullName,
        phoneNumber: result.user.phoneNumber,
        role: result.user.role,
        createdAt: result.user.createdAt,
      },
      wallet: {
        id: result.wallet.id,
        balance: Number(result.wallet.balance),
        currency: result.wallet.currency,
        status: result.wallet.status,
      },
      token,
    };
  }

  static async login({ identifier, password }) {
    const isEmail = identifier.includes('@');
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: identifier.toLowerCase() }
        : { username: identifier },
      include: {
        wallet: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = this.generateToken(user);

    logger.info(`User logged in: ${user.id} (${user.username})`);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        createdAt: user.createdAt,
      },
      wallet: user.wallet
        ? {
            id: user.wallet.id,
            balance: Number(user.wallet.balance),
            currency: user.wallet.currency,
            status: user.wallet.status,
          }
        : null,
      token,
    };
  }

  static async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        wallet: {
          select: {
            id: true,
            balance: true,
            currency: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    return {
      ...user,
      wallet: user.wallet
        ? {
            ...user.wallet,
            balance: Number(user.wallet.balance),
          }
        : null,
    };
  }

  static async updateProfile(userId, { fullName, phoneNumber }) {
    if (phoneNumber) {
      const existing = await prisma.user.findFirst({
        where: {
          phoneNumber,
          NOT: { id: userId },
        },
      });
      if (existing) {
        throw new ConflictError('Phone number is already associated with another account');
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}

module.exports = AuthService;
