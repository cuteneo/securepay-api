# SecurePay REST API Documentation

Base URL: `http://localhost:5000/api/v1`  
Interactive Swagger UI: `http://localhost:5000/api-docs`

---

## 1. System & Health

### 1.1 Health Check
- **Endpoint:** `GET /health`
- **Auth:** None
- **Description:** Verifies service uptime, operational status, and server clock.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-30T08:44:49.000Z",
  "uptime": 12.45,
  "service": "SecurePay API"
}
```

---

## 2. Authentication

### 2.1 User Registration
- **Endpoint:** `POST /auth/register`
- **Auth:** None
- **Description:** Registers a new user account, securely hashes the password with bcrypt (12 rounds), and atomically provisions a default wallet with `$0.00` balance.

**Request Body:**
```json
{
  "email": "alex.morgan@example.com",
  "username": "alex_morgan",
  "password": "SecurePassword123!",
  "fullName": "Alex Morgan",
  "phoneNumber": "+14155552671"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered and wallet initialized successfully",
  "data": {
    "user": {
      "id": "c7a8b9f1-4321-4f12-8921-2a1e948123ef",
      "email": "alex.morgan@example.com",
      "username": "alex_morgan",
      "fullName": "Alex Morgan",
      "phoneNumber": "+14155552671",
      "role": "USER",
      "createdAt": "2026-10-30T08:45:00.000Z"
    },
    "wallet": {
      "id": "e1f2a3b4-9876-4321-a1b2-c3d4e5f6a7b8",
      "balance": 0.0,
      "currency": "USD",
      "status": "ACTIVE"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2.2 User Login
- **Endpoint:** `POST /auth/login`
- **Auth:** None
- **Description:** Authenticates user via email or username. Returns a signed JWT token valid for 24 hours.

**Request Body:**
```json
{
  "identifier": "alex_morgan",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Authentication successful",
  "data": {
    "user": {
      "id": "c7a8b9f1-4321-4f12-8921-2a1e948123ef",
      "email": "alex.morgan@example.com",
      "username": "alex_morgan",
      "fullName": "Alex Morgan",
      "phoneNumber": "+14155552671",
      "role": "USER",
      "createdAt": "2026-10-30T08:45:00.000Z"
    },
    "wallet": {
      "id": "e1f2a3b4-9876-4321-a1b2-c3d4e5f6a7b8",
      "balance": 0.0,
      "currency": "USD",
      "status": "ACTIVE"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2.3 User Profile
- **Endpoint:** `GET /auth/profile`
- **Auth:** `Bearer <JWT_TOKEN>`

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User profile fetched successfully",
  "data": {
    "id": "c7a8b9f1-4321-4f12-8921-2a1e948123ef",
    "email": "alex.morgan@example.com",
    "username": "alex_morgan",
    "fullName": "Alex Morgan",
    "phoneNumber": "+14155552671",
    "role": "USER",
    "createdAt": "2026-10-30T08:45:00.000Z",
    "updatedAt": "2026-10-30T08:45:00.000Z",
    "wallet": {
      "id": "e1f2a3b4-9876-4321-a1b2-c3d4e5f6a7b8",
      "balance": 500.0,
      "currency": "USD",
      "status": "ACTIVE",
      "createdAt": "2026-10-30T08:45:00.000Z"
    }
  }
}
```

---

## 3. Wallet Management

### 3.1 Get Wallet Overview
- **Endpoint:** `GET /wallet`
- **Auth:** `Bearer <JWT_TOKEN>`

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Wallet details retrieved successfully",
  "data": {
    "id": "e1f2a3b4-9876-4321-a1b2-c3d4e5f6a7b8",
    "userId": "c7a8b9f1-4321-4f12-8921-2a1e948123ef",
    "balance": 1500.0,
    "currency": "USD",
    "status": "ACTIVE",
    "createdAt": "2026-10-30T08:45:00.000Z",
    "updatedAt": "2026-10-30T08:50:00.000Z",
    "user": {
      "id": "c7a8b9f1-4321-4f12-8921-2a1e948123ef",
      "email": "alex.morgan@example.com",
      "username": "alex_morgan",
      "fullName": "Alex Morgan"
    }
  }
}
```

### 3.2 Deposit Funds
- **Endpoint:** `POST /wallet/deposit`
- **Auth:** `Bearer <JWT_TOKEN>`
- **Description:** Simulates funding the wallet. Runs within an atomic database transaction and creates an immutable ledger entry.

**Request Body:**
```json
{
  "amount": 250.0,
  "description": "Salary deposit bonus"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Funds deposited successfully",
  "data": {
    "reference": "DEP_MVUQ8K12_3FA109E2",
    "walletId": "e1f2a3b4-9876-4321-a1b2-c3d4e5f6a7b8",
    "amount": 250.0,
    "newBalance": 1750.0,
    "currency": "USD",
    "type": "DEPOSIT",
    "status": "COMPLETED",
    "timestamp": "2026-10-30T08:52:10.000Z"
  }
}
```

### 3.3 Withdraw Funds
- **Endpoint:** `POST /wallet/withdraw`
- **Auth:** `Bearer <JWT_TOKEN>`
- **Description:** Deducts funds from wallet. Verifies active status and validates `balance >= amount` to strictly prevent negative balances.

**Request Body:**
```json
{
  "amount": 100.0,
  "description": "ATM payout"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Funds withdrawn successfully",
  "data": {
    "reference": "WTH_MVUQ8L45_A982FC01",
    "walletId": "e1f2a3b4-9876-4321-a1b2-c3d4e5f6a7b8",
    "amount": 100.0,
    "newBalance": 1650.0,
    "currency": "USD",
    "type": "WITHDRAWAL",
    "status": "COMPLETED",
    "timestamp": "2026-10-30T08:53:00.000Z"
  }
}
```

---

## 4. Money Transfers

### 4.1 Peer-to-Peer Transfer
- **Endpoint:** `POST /transfers`
- **Auth:** `Bearer <JWT_TOKEN>`
- **Headers:** `Idempotency-Key: <unique-uuid-or-token>` (Optional but recommended)
- **Description:** Atomically debits sender and credits recipient inside a single PostgreSQL transaction. Sequences updates deterministically by wallet ID to guarantee deadlock freedom.

**Request Body:**
```json
{
  "recipientIdentifier": "bob_builder",
  "amount": 150.0,
  "note": "Office party contribution"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Funds transferred successfully",
  "data": {
    "transferId": "4a5b6c7d-8e9f-0a1b-2c3d-4e5f6a7b8c9d",
    "reference": "TRF_MVUQ8N10_7F28BC33",
    "amount": 150.0,
    "senderBalanceAfter": 1500.0,
    "recipient": {
      "username": "bob_builder",
      "fullName": "Bob Builder",
      "walletId": "f9e8d7c6-b5a4-3210-9876-543210fedcba"
    },
    "note": "Office party contribution",
    "status": "COMPLETED",
    "timestamp": "2026-10-30T08:55:00.000Z"
  }
}
```

---

## 5. Transactions & Ledger

### 5.1 Query Transactions
- **Endpoint:** `GET /transactions`
- **Auth:** `Bearer <JWT_TOKEN>`
- **Query Parameters:**
  - `page`: Page number (default: 1)
  - `limit`: Records per page (default: 10, max: 100)
  - `type`: `DEPOSIT`, `WITHDRAWAL`, `TRANSFER_IN`, `TRANSFER_OUT`
  - `status`: `PENDING`, `COMPLETED`, `FAILED`, `REVERSED`
  - `startDate`: Filter beginning `YYYY-MM-DD`
  - `endDate`: Filter ending `YYYY-MM-DD`

**Sample Request:**
```
GET /transactions?page=1&limit=5&type=TRANSFER_OUT
```

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Transactions fetched successfully",
  "data": [
    {
      "id": "txn-uuid-1",
      "reference": "TXN_OUT_MVUQ8N11_981BC30A",
      "type": "TRANSFER_OUT",
      "amount": 150.0,
      "balanceAfter": 1500.0,
      "status": "COMPLETED",
      "description": "Office party contribution",
      "transferDetails": {
        "reference": "TRF_MVUQ8N10_7F28BC33",
        "note": "Office party contribution",
        "sender": "alex_morgan",
        "receiver": "bob_builder"
      },
      "createdAt": "2026-10-30T08:55:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 5,
    "totalRecords": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

## 6. Dashboard & Analytics

### 6.1 Dashboard Summary
- **Endpoint:** `GET /reports/dashboard`
- **Auth:** `Bearer <JWT_TOKEN>`

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dashboard metrics fetched successfully",
  "data": {
    "wallet": {
      "id": "e1f2a3b4-9876-4321-a1b2-c3d4e5f6a7b8",
      "currency": "USD",
      "currentBalance": 1500.0,
      "status": "ACTIVE"
    },
    "summary": {
      "netFlow": 1500.0,
      "totalVolume": 2000.0,
      "deposits": {
        "totalAmount": 1750.0,
        "count": 2
      },
      "withdrawals": {
        "totalAmount": 100.0,
        "count": 1
      },
      "transfersSent": {
        "totalAmount": 150.0,
        "count": 1
      },
      "transfersReceived": {
        "totalAmount": 0.0,
        "count": 0
      },
      "totalTransactions": 4
    },
    "period": {
      "startDate": "ALL_TIME",
      "endDate": "CURRENT"
    }
  }
}
```

### 6.2 Monthly Financial Breakdown
- **Endpoint:** `GET /reports/monthly?year=2026`
- **Auth:** `Bearer <JWT_TOKEN>`

**Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Monthly breakdown fetched successfully",
  "data": {
    "year": 2026,
    "currency": "USD",
    "currentBalance": 1500.0,
    "monthlyBreakdown": [
      {
        "month": 10,
        "monthName": "October",
        "deposits": 1750.0,
        "withdrawals": 100.0,
        "transfersSent": 150.0,
        "transfersReceived": 0.0,
        "netChange": 1500.0,
        "count": 4
      }
    ]
  }
}
```
