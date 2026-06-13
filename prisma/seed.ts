// =============================================================================
// Database Seed Script
// =============================================================================
// Seeds the database with realistic test data matching the project context:
// - 6 users: Aisha, Rohan, Priya, Meera, Dev, Sam
// - "Flatmates" group with membership timeline
// - Exchange rates (INR/USD)
// - Sample expenses across categories
// - Sample settlements
// =============================================================================

import { PrismaClient, SplitType, Currency } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Hash password for all seed users (password: "password123")
  const passwordHash = await bcrypt.hash("password123", 12);

  // =========================================================================
  // 1. CREATE USERS
  // =========================================================================
  console.log("👤 Creating users...");

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "aisha@splitsmart.app" },
      update: {},
      create: {
        name: "Aisha",
        email: "aisha@splitsmart.app",
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "rohan@splitsmart.app" },
      update: {},
      create: {
        name: "Rohan",
        email: "rohan@splitsmart.app",
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "priya@splitsmart.app" },
      update: {},
      create: {
        name: "Priya",
        email: "priya@splitsmart.app",
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "meera@splitsmart.app" },
      update: {},
      create: {
        name: "Meera",
        email: "meera@splitsmart.app",
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "dev@splitsmart.app" },
      update: {},
      create: {
        name: "Dev",
        email: "dev@splitsmart.app",
        passwordHash,
      },
    }),
    prisma.user.upsert({
      where: { email: "sam@splitsmart.app" },
      update: {},
      create: {
        name: "Sam",
        email: "sam@splitsmart.app",
        passwordHash,
      },
    }),
  ]);

  const [aisha, rohan, priya, meera, dev, sam] = users;
  console.log(`   ✅ Created ${users.length} users`);

  // =========================================================================
  // 2. CREATE GROUP
  // =========================================================================
  console.log("🏠 Creating group...");

  const group = await prisma.group.upsert({
    where: { id: "flatmates-group" },
    update: {},
    create: {
      id: "flatmates-group",
      name: "Flatmates",
      description: "Monthly shared expenses for our flat",
      currency: Currency.INR,
      createdById: aisha.id,
    },
  });

  // =========================================================================
  // 3. ADD GROUP MEMBERS WITH MEMBERSHIP TIMELINE
  // =========================================================================
  // - Aisha, Rohan, Priya, Meera: joined Jan 1, 2025
  // - Dev: joined Mar 12 (for trip), left Mar 16
  // - Meera: left Mar 31
  // - Sam: joined Apr 15
  // =========================================================================
  console.log("👥 Adding group members...");

  const memberData = [
    {
      userId: aisha.id,
      groupId: group.id,
      role: "ADMIN" as const,
      joinedAt: new Date("2026-01-01"),
      isActive: true,
    },
    {
      userId: rohan.id,
      groupId: group.id,
      role: "MEMBER" as const,
      joinedAt: new Date("2026-01-01"),
      isActive: true,
    },
    {
      userId: priya.id,
      groupId: group.id,
      role: "MEMBER" as const,
      joinedAt: new Date("2026-01-01"),
      isActive: true,
    },
    {
      userId: meera.id,
      groupId: group.id,
      role: "MEMBER" as const,
      joinedAt: new Date("2026-01-01"),
      leftAt: new Date("2026-03-31"),
      isActive: false,
    },
    {
      userId: dev.id,
      groupId: group.id,
      role: "MEMBER" as const,
      joinedAt: new Date("2026-02-08"),
      leftAt: new Date("2026-03-14"),
      isActive: false,
    },
    {
      userId: sam.id,
      groupId: group.id,
      role: "MEMBER" as const,
      joinedAt: new Date("2026-04-08"),
      isActive: true,
    },
  ];

  for (const member of memberData) {
    await prisma.groupMember.upsert({
      where: {
        userId_groupId_joinedAt: {
          userId: member.userId,
          groupId: member.groupId,
          joinedAt: member.joinedAt,
        },
      },
      update: {},
      create: member,
    });
  }
  console.log(`   ✅ Added ${memberData.length} members`);

  // =========================================================================
  // 4. SEED EXCHANGE RATES
  // =========================================================================
  console.log("💱 Seeding exchange rates...");

  await prisma.exchangeRate.upsert({
    where: {
      fromCurrency_toCurrency_effectiveDate: {
        fromCurrency: Currency.USD,
        toCurrency: Currency.INR,
        effectiveDate: new Date("2026-01-01"),
      },
    },
    update: {},
    create: {
      fromCurrency: Currency.USD,
      toCurrency: Currency.INR,
      rate: 83.5,
      source: "manual",
      effectiveDate: new Date("2026-01-01"),
    },
  });

  await prisma.exchangeRate.upsert({
    where: {
      fromCurrency_toCurrency_effectiveDate: {
        fromCurrency: Currency.INR,
        toCurrency: Currency.USD,
        effectiveDate: new Date("2026-01-01"),
      },
    },
    update: {},
    create: {
      fromCurrency: Currency.INR,
      toCurrency: Currency.USD,
      rate: 0.012,
      source: "manual",
      effectiveDate: new Date("2026-01-01"),
    },
  });
  console.log("   ✅ Exchange rates seeded");

  // =========================================================================
  // 5. SEED SAMPLE EXPENSES
  // =========================================================================
  console.log("💰 Creating sample expenses...");

  const expenses = [
    {
      groupId: group.id,
      paidById: aisha.id,
      createdById: aisha.id,
      amount: 2400,
      currency: Currency.INR,
      convertedAmount: 2400,
      category: "Groceries",
      description: "Weekly Groceries",
      date: new Date("2026-01-05"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id, priya.id, meera.id],
    },
    {
      groupId: group.id,
      paidById: rohan.id,
      createdById: rohan.id,
      amount: 3200,
      currency: Currency.INR,
      convertedAmount: 3200,
      category: "Utilities",
      description: "Electricity Bill January",
      date: new Date("2026-01-10"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id, priya.id, meera.id],
    },
    {
      groupId: group.id,
      paidById: priya.id,
      createdById: priya.id,
      amount: 1500,
      currency: Currency.INR,
      convertedAmount: 1500,
      category: "Utilities",
      description: "Internet Bill",
      date: new Date("2026-01-15"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id, priya.id, meera.id],
    },
    {
      groupId: group.id,
      paidById: meera.id,
      createdById: meera.id,
      amount: 4800,
      currency: Currency.INR,
      convertedAmount: 4800,
      category: "Dining",
      description: "Birthday Dinner at Olive Garden",
      date: new Date("2026-01-20"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id, priya.id, meera.id],
    },
    {
      groupId: group.id,
      paidById: rohan.id,
      createdById: rohan.id,
      amount: 48000,
      currency: Currency.INR,
      convertedAmount: 48000,
      category: "Rent",
      description: "Rent - March",
      date: new Date("2026-03-01"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id, priya.id, meera.id],
    },
    {
      groupId: group.id,
      paidById: aisha.id,
      createdById: aisha.id,
      amount: 45000,
      currency: Currency.INR,
      convertedAmount: 45000,
      category: "Travel",
      description: "Goa Trip - Flights",
      date: new Date("2026-03-12"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id, priya.id, meera.id, dev.id],
    },
    {
      groupId: group.id,
      paidById: rohan.id,
      createdById: rohan.id,
      amount: 48000,
      currency: Currency.INR,
      convertedAmount: 48000,
      category: "Rent",
      description: "Rent - April",
      date: new Date("2026-04-01"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id, priya.id],
    },
    {
      groupId: group.id,
      paidById: sam.id,
      createdById: sam.id,
      amount: 2300,
      currency: Currency.INR,
      convertedAmount: 2300,
      category: "Groceries",
      description: "First Grocery by Sam",
      date: new Date("2026-04-18"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id, priya.id, sam.id],
    },
    {
      groupId: group.id,
      paidById: rohan.id,
      createdById: rohan.id,
      amount: 48000,
      currency: Currency.INR,
      convertedAmount: 48000,
      category: "Rent",
      description: "Rent - May",
      date: new Date("2026-05-01"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id, priya.id, sam.id],
    },
    {
      groupId: group.id,
      paidById: aisha.id,
      createdById: aisha.id,
      amount: 49.99,
      currency: Currency.USD,
      convertedAmount: 4174.17, // 49.99 * 83.5
      exchangeRate: 83.5,
      category: "Education",
      description: "Online Course",
      date: new Date("2026-05-08"),
      splitType: SplitType.EQUAL,
      members: [aisha.id, rohan.id],
    },
  ];

  for (const exp of expenses) {
    const { members, ...expenseData } = exp;
    const perPerson = Math.round((expenseData.convertedAmount / members.length) * 100) / 100;

    const expense = await prisma.expense.create({
      data: {
        ...expenseData,
        exchangeRate: expenseData.exchangeRate || 1.0,
      },
    });

    await prisma.expenseSplit.createMany({
      data: members.map((userId) => ({
        expenseId: expense.id,
        userId,
        amount: perPerson,
        owedAmount: perPerson,
      })),
    });
  }
  console.log(`   ✅ Created ${expenses.length} expenses`);

  // =========================================================================
  // 6. SEED SAMPLE SETTLEMENTS
  // =========================================================================
  console.log("🤝 Creating sample settlements...");

  await prisma.settlement.create({
    data: {
      groupId: group.id,
      payerId: rohan.id,
      receiverId: priya.id,
      amount: 1200,
      currency: Currency.INR,
      notes: "Settling up for past expenses",
      settledAt: new Date("2026-03-08"),
    },
  });

  await prisma.settlement.create({
    data: {
      groupId: group.id,
      payerId: meera.id,
      receiverId: aisha.id,
      amount: 3500,
      currency: Currency.INR,
      notes: "Final settlement before leaving",
      settledAt: new Date("2026-03-30"),
    },
  });

  console.log("   ✅ Created 2 settlements");

  console.log("\n🎉 Seed completed successfully!");
  console.log("\n📋 Login credentials for all users:");
  console.log("   Email: <name>@splitsmart.app");
  console.log("   Password: password123");
  console.log("\n   Example: aisha@splitsmart.app / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
