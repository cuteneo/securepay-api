const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

async function main() {
  console.log('Seeding SecurePay database...');

  // Clean existing records (in order of relations)
  await prisma.transaction.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('SecureP@ss123', 10);

  // User 1: Alice (Sender)
  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      username: 'alice_wonder',
      password: passwordHash,
      fullName: 'Alice Wonderland',
      phoneNumber: '+19876543210',
      wallet: {
        create: {
          balance: 1500.0,
          currency: 'USD',
          status: 'ACTIVE',
        },
      },
    },
    include: { wallet: true },
  });

  // User 2: Bob (Recipient)
  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      username: 'bob_builder',
      password: passwordHash,
      fullName: 'Bob Builder',
      phoneNumber: '+19876543211',
      wallet: {
        create: {
          balance: 250.0,
          currency: 'USD',
          status: 'ACTIVE',
        },
      },
    },
    include: { wallet: true },
  });

  // Initial deposit transaction records
  await prisma.transaction.create({
    data: {
      reference: 'DEP_INIT_ALICE',
      walletId: alice.wallet.id,
      type: 'DEPOSIT',
      amount: 1500.0,
      balanceAfter: 1500.0,
      status: 'COMPLETED',
      description: 'Initial seed deposit',
      metadata: { method: 'SEED' },
    },
  });

  await prisma.transaction.create({
    data: {
      reference: 'DEP_INIT_BOB',
      walletId: bob.wallet.id,
      type: 'DEPOSIT',
      amount: 250.0,
      balanceAfter: 250.0,
      status: 'COMPLETED',
      description: 'Initial seed deposit',
      metadata: { method: 'SEED' },
    },
  });

  console.log('Seed completed successfully!');
  console.log(`User 1: alice@example.com / SecureP@ss123 (Balance: $1500.00)`);
  console.log(`User 2: bob@example.com / SecureP@ss123 (Balance: $250.00)`);
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
