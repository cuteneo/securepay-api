# SecurePay — Digital Wallet & Transaction Management API

![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)
![Express.js](https://img.shields.io/badge/Express-4.21-lightgrey.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)
![Prisma](https://img.shields.io/badge/Prisma-5.22-indigo.svg)
![Jest](https://img.shields.io/badge/Jest-Tests%20Passing-brightgreen.svg)
![OpenAPI](https://img.shields.io/badge/Swagger-OpenAPI%203.0-orange.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

> A production-grade financial REST API simulating a high-throughput digital wallet platform. Demonstrates atomic peer-to-peer transfers, double-entry financial ledgering, idempotency key guarantees, deadlock mitigation, and defense-in-depth security.

---

##  Executive Summary

In fintech systems, a minor glitch can cause unauthorized money creation, race conditions, or duplicate debits. **SecurePay** was engineered to solve these core challenges using production-standard backend principles:
- **Atomic Double-Entry Bookkeeping:** Every balance modification records mirrored debits/credits with point-in-time balance snapshots.
- **ACID Database Transactions:** Transfers run under strict isolation using Prisma `$transaction` blocks.
- **Deadlock Mitigation:** Database rows are sorted deterministically by primary key before acquisition, eliminating cyclic locking deadlocks.
- **Idempotency Protection:** Clients transmit unique `Idempotency-Key` headers to guarantee safe network retries without duplicate debits.
- **Stateless JWT Security & Zod Validation:** Strict request sanitization and schema contracts prevent injection and parameter tampering.

---

##  Technology Stack

| Layer | Technologies |
|---|---|
| **Runtime & Language** | Node.js (v18+ / v20+), JavaScript (ES6+ CommonJS) |
| **Framework & Router** | Express.js 4.x |
| **Database & ORM** | PostgreSQL 16, Prisma ORM 5.x |
| **Authentication & Auth** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` (12 salt rounds) |
| **Request Validation** | `zod` |
| **Security & Headers** | `helmet`, `cors`, `express-rate-limit` |
| **API Documentation** | Swagger UI (`swagger-ui-express`), OpenAPI 3.0 (`swagger-jsdoc`) |
| **Logging & Monitoring** | `winston` (structured JSON logging, data masking), `morgan` |
| **Automated Testing** | `jest`, `supertest` |
| **Containerization** | Docker, Docker Compose |

---

##  Architecture & Project Structure

SecurePay enforces a strict 3-tier modular architecture:

```
securepay/
├── prisma/
│   ├── schema.prisma           # Prisma Data Models & Relations
│   └── seed.js                 # Database Seeding Script (Alice & Bob test users)
├── src/
│   ├── config/
│   │   ├── env.js              # Environment Variable Sanitization
│   │   ├── prisma.js           # Singleton Prisma Client Instance
│   │   └── swagger.js          # OpenAPI 3.0 Specifications
│   ├── controllers/            # HTTP Request Handlers
│   │   ├── auth.controller.js
│   │   ├── wallet.controller.js
│   │   ├── transfer.controller.js
│   │   ├── transaction.controller.js
│   │   └── report.controller.js
│   ├── middleware/             # Interceptors & Guards
│   │   ├── auth.middleware.js          # JWT Verification & Role Authorization
│   │   ├── error.middleware.js         # Centralized Error & Exception Catcher
│   │   ├── rateLimiter.middleware.js   # DoS & Brute Force Protection
│   │   └── validate.middleware.js      # Zod Schema Validator
│   ├── routes/                 # Express Router Endpoints
│   │   ├── auth.routes.js
│   │   ├── wallet.routes.js
│   │   ├── transfer.routes.js
│   │   ├── transaction.routes.js
│   │   ├── report.routes.js
│   │   └── index.js
│   ├── services/               # Core Domain & Business Logic
│   │   ├── auth.service.js
│   │   ├── wallet.service.js
│   │   ├── transfer.service.js
│   │   ├── transaction.service.js
│   │   └── report.service.js
│   ├── utils/
│   │   ├── apiResponse.js      # Standardized JSON Response Formatter
│   │   ├── errors.js           # Custom AppError Hierarchy
│   │   ├── idempotency.js      # SHA-256 Idempotency Cache Manager
│   │   └── logger.js           # Masked Winston Structured Logger
│   ├── validations/            # Zod Validation Schemas
│   ├── app.js                  # Express Application Configuration
│   └── server.js               # HTTP Server Lifecycle & Graceful Shutdown
├── tests/
│   ├── unit/                   # Isolated Service Unit Tests
│   └── integration/            # HTTP Route & Security Integration Tests
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── ARCHITECTURE.md
├── API_DOCUMENTATION.md
└── package.json
```

---

## Quick Start Guide

### Prerequisites
- Node.js (v18.0.0 or higher)
- PostgreSQL 14+ (or Docker)
- Git

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/securepay-api.git
cd securepay-api
npm install
```

### 2. Environment Configuration
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```
Ensure your `DATABASE_URL` matches your local or cloud PostgreSQL instance:
```env
PORT=5000
NODE_ENV=development
API_PREFIX=/api/v1
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/securepay_db?schema=public
JWT_SECRET=super_secure_jwt_secret_change_in_production_min_32_chars
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

### 3. Initialize Database & Run Seed
```bash
# Generate Prisma Client
npx prisma generate

# Apply Database Schema Migrations
npx prisma migrate dev --name init

# Seed Default Test Accounts (Alice: $1500, Bob: $250)
npm run seed
```

### 4. Start the Application
```bash
# Development Mode (Hot Reloading with nodemon)
npm run dev

# Production Mode
npm start
```
The server will boot on `http://localhost:5000`.  
Explore interactive API docs at: `http://localhost:5000/api-docs`.

---

##  Docker Deployment

Run the complete stack (PostgreSQL + SecurePay API) with one command:
```bash
docker-compose up --build -d
```
To stop the services:
```bash
docker-compose down
```

---

## Automated Testing

SecurePay features a comprehensive automated test suite testing business rules, validation constraints, and security defenses:

```bash
# Run all unit and integration tests
npm test

# Run tests with code coverage report
npm run test:coverage
```

### What is tested:
-  **Atomic Transfers:** Balances update simultaneously with double-entry transaction records.
-  **Overdraft Prevention:** Transfers with amounts exceeding available balances throw `400 Bad Request`.
-  **Self-Transfer Guard:** Users cannot send funds to their own wallet.
-  **Idempotency Replay:** Repeated calls with the same `Idempotency-Key` return the cached response without debiting again.
-  **Input Validation:** Zod rejects invalid emails, weak passwords, and non-positive numbers.
-  **Security Guards:** Protected endpoints deny requests without valid Bearer tokens.

---

##  API Endpoints Overview

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | System health and uptime |
| `POST` | `/api/v1/auth/register` | Public (Rate Limited) | Register user and initialize wallet |
| `POST` | `/api/v1/auth/login` | Public (Rate Limited) | Authenticate user and receive JWT |
| `GET` | `/api/v1/auth/profile` | Bearer JWT | Fetch user profile and wallet overview |
| `PATCH` | `/api/v1/auth/profile` | Bearer JWT | Update user full name / phone |
| `GET` | `/api/v1/wallet` | Bearer JWT | Get current wallet balance |
| `POST` | `/api/v1/wallet/deposit` | Bearer JWT | Simulated deposit with ledger entry |
| `POST` | `/api/v1/wallet/withdraw` | Bearer JWT | Simulated withdrawal |
| `POST` | `/api/v1/transfers` | Bearer JWT | Atomic transfer (Supports `Idempotency-Key`) |
| `GET` | `/api/v1/transactions` | Bearer JWT | Paginated ledger history with filters |
| `GET` | `/api/v1/transactions/:id` | Bearer JWT | Single transaction audit record |
| `GET` | `/api/v1/reports/dashboard` | Bearer JWT | Financial metrics (net flow, volume, totals) |
| `GET` | `/api/v1/reports/monthly` | Bearer JWT | 12-month calendar transaction breakdown |

*For complete request/response schemas and cURL examples, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).*

---

##  Cloud Deployment Instructions

### Option 1: Render / Railway (Recommended)
1. Fork or push this repository to your GitHub account.
2. Create a free PostgreSQL database on Render or Railway.
3. Create a new **Web Service**, link your GitHub repo.
4. Set Build Command: `npm install && npx prisma generate`
5. Set Start Command: `npm start`
6. Add Environment Variables:
   - `DATABASE_URL`: Your managed Postgres connection string.
   - `JWT_SECRET`: A secure 64-character random string.
   - `NODE_ENV`: `production`

---

##  Resume Bullet Points for Final-Year Students

Add these impact-focused bullet points to your resume:

- *Architected a production-grade digital wallet REST API in Node.js and PostgreSQL (Prisma ORM) handling atomic peer-to-peer transfers and double-entry financial ledgering.*
- *Implemented distributed idempotency key validation with SHA-256 payload hashing to prevent duplicate debits during network timeouts and client retries.*
- *Engineered deadlock-free database transactions by sequencing row locks deterministically by wallet UUID, preventing cyclic locking under high concurrency.*
- *Hardened API perimeter with Zod schema validation, Helmet HTTP headers, multi-tier rate limiting, and bcrypt password hashing (12 rounds).*
- *Authored 25+ automated unit and integration tests using Jest and Supertest, achieving comprehensive branch coverage across transaction failure modes.*
- *Designed interactive OpenAPI 3.0 documentation and containerized the full stack with Docker Compose for seamless cloud deployment.*

---

##  Backend Interview Questions & Answers

### Q1: Why did you use database transactions for transfers? What happens if the server crashes halfway?
> **Answer:** In a money transfer, debiting the sender and crediting the recipient must be **atomic**. If the server crashes or the database disconnects after debiting the sender, money would vanish from the system without reaching the recipient. By wrapping both operations, the transfer record, and the ledger transactions in a single Prisma/PostgreSQL transaction (`prisma.$transaction`), we ensure atomicity: either every update commits permanently, or the entire operation rolls back to the previous state with zero side effects.

### Q2: What is an Idempotency Key, and why is it essential in fintech APIs?
> **Answer:** In distributed systems, client network timeouts are common. If a user clicks "Transfer $100", the server processes the debit, but the mobile connection drops before receiving the HTTP 200 response, the client will retry the request. Without idempotency, the user would be charged twice. With an `Idempotency-Key` header, the server hashes the payload and caches the response. On subsequent retries with the same key, the server identifies the duplicate and immediately returns the cached confirmation without executing another debit.

### Q3: How do you prevent database deadlocks when two users send money to each other simultaneously?
> **Answer:** A classic cyclic deadlock occurs when Transaction 1 locks Wallet A and tries to lock Wallet B, while Transaction 2 locks Wallet B and tries to lock Wallet A. SecurePay prevents this by **deterministic resource ordering**: before acquiring row locks, we sort the two wallet UUIDs lexicographically (`min(WalletA, WalletB)` is always locked first). Because both concurrent transactions acquire locks in the exact same sequence, a circular wait condition is mathematically impossible.

### Q4: Why use a double-entry ledger instead of just updating a balance column?
> **Answer:** In financial systems, mutating only a `balance` column leaves no audit trail. If a balance is incorrect, there is no way to prove whether it was caused by a software bug, fraud, or an unauthorized admin update. SecurePay maintains an immutable `Transaction` ledger that records every deposit, withdrawal, and transfer with `type`, `amount`, and `balanceAfter` point-in-time snapshots. The current balance can always be independently audited and mathematically reconciled from historical ledger entries.

---

##  License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
