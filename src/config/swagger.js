const swaggerJSDoc = require('swagger-jsdoc');
const config = require('./env');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'SecurePay — Digital Wallet & Transaction Management API',
    version: '1.0.0',
    description: `
**SecurePay API** is a production-grade, secure digital wallet and financial ledger backend system built with Node.js, Express, and PostgreSQL (Prisma ORM).

### Key Architectural Highlights:
- **Double-Entry Ledger:** Every balance modification creates immutable audit records.
- **Atomic Transfers:** Multi-party balance transfers run in isolated ACID database transactions.
- **Deadlock Mitigation:** Row-level operations are sequenced deterministically by Wallet ID.
- **Idempotency Protection:** Avoids duplicate debits/transfers via \`Idempotency-Key\` headers.
- **Defense in Depth:** Zod schema validation, Helmet security headers, rate limiting, and bcrypt hashing.
    `,
    contact: {
      name: 'SecurePay Engineering Team',
      email: 'engineering@securepay.local',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.port}${config.apiPrefix}`,
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from /auth/login or /auth/register',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer', example: 400 },
          message: { type: 'string', example: 'Insufficient balance' },
          errors: { type: 'array', items: { type: 'object' } },
        },
      },
      UserRegisterRequest: {
        type: 'object',
        required: ['email', 'username', 'password', 'fullName'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alex@example.com' },
          username: { type: 'string', example: 'alex_dev' },
          password: { type: 'string', example: 'SecureP@ss123' },
          fullName: { type: 'string', example: 'Alex Morgan' },
          phoneNumber: { type: 'string', example: '+1234567890' },
        },
      },
      UserLoginRequest: {
        type: 'object',
        required: ['identifier', 'password'],
        properties: {
          identifier: { type: 'string', example: 'alex@example.com' },
          password: { type: 'string', example: 'SecureP@ss123' },
        },
      },
      DepositRequest: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', format: 'float', example: 500.0 },
          description: { type: 'string', example: 'Initial deposit' },
        },
      },
      WithdrawRequest: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', format: 'float', example: 100.0 },
          description: { type: 'string', example: 'ATM withdrawal' },
        },
      },
      TransferRequest: {
        type: 'object',
        required: ['recipientIdentifier', 'amount'],
        properties: {
          recipientIdentifier: {
            type: 'string',
            description: 'Recipient username, email address, or Wallet UUID',
            example: 'sarah_jones',
          },
          amount: { type: 'number', format: 'float', example: 75.5 },
          note: { type: 'string', example: 'Dinner share' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'System health check',
        tags: ['System'],
        responses: {
          200: { description: 'API service is healthy and operational' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register a new user & initialize digital wallet',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserRegisterRequest' } } },
        },
        responses: {
          201: { description: 'User registered and wallet initialized successfully' },
          409: { description: 'Email, username, or phone already exists' },
          422: { description: 'Validation failed' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user & receive JWT token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserLoginRequest' } } },
        },
        responses: {
          200: { description: 'Authentication successful' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/profile': {
      get: {
        summary: 'Get current user profile and wallet overview',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Profile retrieved successfully' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/wallet': {
      get: {
        summary: 'Get wallet details and live balance',
        tags: ['Wallet Management'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Wallet retrieved successfully' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/wallet/deposit': {
      post: {
        summary: 'Deposit simulated funds into wallet',
        tags: ['Wallet Management'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DepositRequest' } } },
        },
        responses: {
          200: { description: 'Funds deposited successfully' },
          400: { description: 'Invalid amount or wallet inactive' },
        },
      },
    },
    '/wallet/withdraw': {
      post: {
        summary: 'Withdraw funds from wallet',
        tags: ['Wallet Management'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/WithdrawRequest' } } },
        },
        responses: {
          200: { description: 'Funds withdrawn successfully' },
          400: { description: 'Insufficient funds or invalid amount' },
        },
      },
    },
    '/transfers': {
      post: {
        summary: 'Transfer funds atomically to another user',
        tags: ['Money Transfers'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            description: 'Unique client key preventing duplicate transfers on network retries',
            schema: { type: 'string', example: 'idem-uuid-9876-5432-1' },
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TransferRequest' } } },
        },
        responses: {
          200: { description: 'Funds transferred successfully (or idempotent cached result returned)' },
          400: { description: 'Insufficient balance or self-transfer attempt' },
          404: { description: 'Recipient not found' },
          409: { description: 'Idempotency key payload mismatch' },
        },
      },
    },
    '/transactions': {
      get: {
        summary: 'Query transaction ledger with pagination and filters',
        tags: ['Transactions & Ledger'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', example: '2026-01-01' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', example: '2026-12-31' } },
        ],
        responses: {
          200: { description: 'Paginated transactions list' },
        },
      },
    },
    '/transactions/{id}': {
      get: {
        summary: 'Get single transaction details by ID or reference',
        tags: ['Transactions & Ledger'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Transaction details' },
          403: { description: 'Forbidden (belongs to another user)' },
          404: { description: 'Transaction not found' },
        },
      },
    },
    '/reports/dashboard': {
      get: {
        summary: 'Get financial dashboard summary (totals, volume, net flow)',
        tags: ['Dashboard & Analytics'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', example: '2026-01-01' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', example: '2026-12-31' } },
        ],
        responses: {
          200: { description: 'Dashboard metrics retrieved' },
        },
      },
    },
    '/reports/monthly': {
      get: {
        summary: 'Get month-by-month financial breakdown',
        tags: ['Dashboard & Analytics'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer', example: 2026 } },
        ],
        responses: {
          200: { description: 'Monthly metrics retrieved' },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJSDoc({
  swaggerDefinition,
  apis: [],
});

module.exports = swaggerSpec;
