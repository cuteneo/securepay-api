# SecurePay Architecture & System Design Documentation

This document provides a comprehensive technical overview of the architecture, database schema, transaction processing mechanics, and concurrency management designed for **SecurePay — Digital Wallet & Transaction Management API**.

---

## 1. System Architecture Overview

SecurePay is engineered following the **Modular Layered Architecture (Separation of Concerns)** pattern:

```mermaid
flowchart TD
    Client["Client Applications\n(Web, Mobile, Postman, cURL)"]
    
    subgraph Security_Perimeter ["Security & Network Perimeter"]
        Helmet["Helmet (HTTP Security Headers)"]
        Cors["CORS Policy Middleware"]
        RateLimiter["express-rate-limit\n(API & Auth Limiters)"]
        BodyParser["Express JSON Parser (10KB limit)"]
    end

    subgraph Routing_Layer ["Routing & Validation Layer (/api/v1)"]
        AuthRoutes["/auth/*"]
        WalletRoutes["/wallet/*"]
        TransferRoutes["/transfers/*"]
        TxnRoutes["/transactions/*"]
        ReportRoutes["/reports/*"]
        ZodValidator["Zod Schema Validation Middleware"]
        AuthMiddleware["JWT Authentication Middleware"]
    end

    subgraph Business_Logic ["Service Layer (Business Rules & Domain Logic)"]
        AuthService["AuthService\n(Bcrypt Hashing, JWT Sign/Verify)"]
        WalletService["WalletService\n(Balance Credit/Debit, Ledger Entry)"]
        TransferService["TransferService\n(Atomic $transaction, Deadlock Prevention)"]
        TxnService["TransactionService\n(Ledger Querying, Pagination, Filters)"]
        ReportService["ReportService\n(Financial Aggregations & Analytics)"]
        IdempotencyUtil["Idempotency Engine\n(SHA-256 Hashing, Replay Protection)"]
    end

    subgraph Data_Layer ["Persistence & ORM Layer"]
        PrismaORM["Prisma ORM (PrismaClient)"]
        PostgresDB[("PostgreSQL 16 Database\n(ACID Compliant)")]
    end

    Client --> Security_Perimeter
    Security_Perimeter --> Routing_Layer
    Routing_Layer --> ZodValidator
    ZodValidator --> AuthMiddleware
    AuthMiddleware --> Business_Logic
    Business_Logic --> IdempotencyUtil
    Business_Logic --> PrismaORM
    PrismaORM --> PostgresDB
```

---

## 2. Database Schema (Entity-Relationship Diagram)

The database schema enforces data integrity through foreign keys, cascade deletes, unique constraints, and B-tree indexes.

```mermaid
erDiagram
    User ||--o| Wallet : "owns (1:1)"
    Wallet ||--o{ Transaction : "records (1:N)"
    Wallet ||--o{ Transfer : "sends (1:N)"
    Wallet ||--o{ Transfer : "receives (1:N)"
    Transfer ||--o{ Transaction : "generates (1:2)"
    User ||--o{ IdempotencyKey : "issues"

    User {
        string id PK "UUID"
        string email UK "Unique lowercase"
        string username UK "Unique alphanumeric"
        string password "Bcrypt hash (12 salt rounds)"
        string fullName "Full legal name"
        string phoneNumber UK "E.164 format (optional)"
        string role "USER or ADMIN"
        datetime createdAt "Creation timestamp"
        datetime updatedAt "Last modification"
    }

    Wallet {
        string id PK "UUID"
        string userId FK, UK "Owner User ID"
        decimal balance "14, 2 scale (precision currency)"
        string currency "Default USD"
        string status "ACTIVE, FROZEN, CLOSED"
        int version "Optimistic lock counter"
        datetime createdAt
        datetime updatedAt
    }

    Transaction {
        string id PK "UUID"
        string reference UK "Unique TXN_ reference"
        string walletId FK "Target Wallet ID"
        string type "DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT"
        decimal amount "Transaction value"
        decimal balanceAfter "Snapshot of wallet balance after txn"
        string status "PENDING, COMPLETED, FAILED, REVERSED"
        string description "Description / Note"
        string transferId FK "Optional link to Transfer"
        json metadata "Structured audit context"
        datetime createdAt
    }

    Transfer {
        string id PK "UUID"
        string reference UK "Unique TRF_ reference"
        string senderWalletId FK "Sender Wallet"
        string receiverWalletId FK "Receiver Wallet"
        decimal amount "Transfer amount"
        string status "PENDING, COMPLETED, FAILED"
        string note "Transfer remark"
        datetime createdAt
    }

    IdempotencyKey {
        string key PK "Client provided unique key"
        string userId FK "Requesting user"
        string endpoint "API Route"
        string requestHash "SHA-256 hash of payload"
        int responseCode "HTTP status code"
        json responseBody "Cached response payload"
        datetime createdAt
        datetime expiresAt "TTL expiration (24 hours)"
    }
```

---

## 3. Atomic Money Transfer & Double-Entry Ledger

In financial engineering, transfers must strictly adhere to **ACID** properties:
- **Atomicity:** Both sender debit and recipient credit succeed, or both fail.
- **Consistency:** The total sum of money in the system is invariant (no money is magically created or lost).
- **Isolation:** Concurrent transfers to/from the same wallet cannot see intermediate states or produce race conditions.
- **Durability:** Committed transactions survive system crashes.

### Sequence Diagram: Fund Transfer Execution

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Sender)
    participant API as TransferController
    participant Service as TransferService
    participant Idem as Idempotency Engine
    participant DB as PostgreSQL (Prisma $transaction)
    actor Bob as Bob (Recipient)

    Alice->>API: POST /api/v1/transfers (Headers: Idempotency-Key, Bearer JWT)
    API->>Service: transferFunds(senderId, recipientId, amount, note, idemKey)
    
    Service->>Idem: checkIdempotency(idemKey, senderId, payload)
    alt Idempotency Hit (Cached Request)
        Idem-->>Service: Return Cached Result
        Service-->>API: Return Cached HTTP 200 Response
        API-->>Alice: 200 OK (Served from Cache, No Re-execution)
    else First Time Request (Cache Miss)
        Service->>DB: Find sender wallet & verify status == ACTIVE
        Service->>DB: Find recipient wallet & verify recipient exists
        
        alt Balance Insufficient or Self-Transfer
            Service-->>API: Throw BadRequestError
            API-->>Alice: 400 Bad Request
        else Valid Conditions
            Note over Service, DB: Sort Wallet IDs deterministically to eliminate Deadlocks!
            Service->>DB: BEGIN TRANSACTION (ISOLATION LEVEL: READ COMMITTED)
            DB->>DB: Verify sender balance >= amount inside transaction
            DB->>DB: Decrement Alice's wallet balance by $amount
            DB->>DB: Increment Bob's wallet balance by $amount
            DB->>DB: Insert Transfer record (TRF_...)
            DB->>DB: Insert Alice's Transaction record (TRANSFER_OUT, balanceAfter)
            DB->>DB: Insert Bob's Transaction record (TRANSFER_IN, balanceAfter)
            DB->>DB: COMMIT TRANSACTION
            
            Service->>Idem: saveIdempotency(idemKey, senderId, payload, response)
            Service-->>API: Return Transfer Confirmation
            API-->>Alice: 200 OK (Transfer Completed)
        end
    end
```

---

## 4. Concurrency & Deadlock Prevention Strategy

### The Mutual Deadlock Problem
Consider two users transferring money to each other at the exact same millisecond:
- **Thread 1:** User A transfers \$100 to User B. Thread 1 updates/locks Wallet A, then tries to update/lock Wallet B.
- **Thread 2:** User B transfers \$50 to User A. Thread 2 updates/locks Wallet B, then tries to update/lock Wallet A.

Without defensive ordering:
- Thread 1 holds lock on Wallet A, waiting for lock on Wallet B.
- Thread 2 holds lock on Wallet B, waiting for lock on Wallet A.
- **Result:** Classical Cyclic Deadlock! PostgreSQL detects the deadlock and aborts one transaction with error code `40P01`.

### The SecurePay Solution: Deterministic Resource Ordering
SecurePay orders database row updates **lexicographically by Primary Key (Wallet UUID)**:

```javascript
// Deterministic resource sequencing prevents cyclic dependency locks
const firstWalletId = senderWallet.id < recipientWallet.id ? senderWallet.id : recipientWallet.id;
const isSenderFirst = firstWalletId === senderWallet.id;

if (isSenderFirst) {
  await tx.wallet.update({ where: { id: senderWallet.id }, data: { balance: { decrement: amount } } });
  await tx.wallet.update({ where: { id: recipientWallet.id }, data: { balance: { increment: amount } } });
} else {
  await tx.wallet.update({ where: { id: recipientWallet.id }, data: { balance: { increment: amount } } });
  await tx.wallet.update({ where: { id: senderWallet.id }, data: { balance: { decrement: amount } } });
}
```

Because both concurrent transactions acquire row locks in identical chronological order (`Wallet_A` before `Wallet_B`), a cyclic lock cycle is mathematically impossible. One thread cleanly awaits the other and completes without deadlocking.

---

## 5. Security & Defense-in-Depth Mechanisms

| Defense Layer | Mechanism | Vulnerability Mitigated |
|---|---|---|
| **Header Hardening** | `helmet()` | XSS, Clickjacking, MIME sniffing, HSTS enforcement |
| **Origin Isolation** | `cors()` | Cross-Origin resource theft |
| **Rate Limiting** | `express-rate-limit` | Brute force login, Credential stuffing, DoS |
| **Input Validation** | `zod` schemas | SQL Injection, prototype pollution, parameter tampering |
| **Password Hashing** | `bcryptjs` (12 rounds) | Rainbow tables, dictionary attacks, database breach exposure |
| **Session Control** | Stateless JWT (Bearer tokens) | Broken object level authorization, session fixation |
| **Ledger Consistency** | Double-Entry with `balanceAfter` | Audit tampering, phantom balances, race conditions |
| **Idempotency** | SHA-256 request payload hashing | Double debit on client network retries / disconnects |
