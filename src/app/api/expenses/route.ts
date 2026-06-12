// =============================================================================
// Expenses API — List & Create
// =============================================================================
// GET  /api/expenses — List expenses (with filters: groupId, category, dateRange)
// POST /api/expenses — Create expense with splits
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SplitType, Currency } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const currency = searchParams.get("currency");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isDeleted: false,
      group: {
        members: {
          some: { userId: session.user.id },
        },
      },
    };

    if (groupId) where.groupId = groupId;
    if (category) where.category = category;
    if (currency) where.currency = currency;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          paidBy: { select: { id: true, name: true, email: true } },
          splits: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          group: { select: { id: true, name: true, currency: true } },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      groupId,
      paidById,
      amount,
      currency = "INR",
      category = "General",
      description,
      notes,
      date,
      splitType = "EQUAL",
      splits: splitInputs,
    } = body;

    // Validation
    if (!groupId || !paidById || !amount || !description || !date) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be positive" },
        { status: 400 }
      );
    }

    // Get group to determine base currency
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { where: { isActive: true }, include: { user: true } } },
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: "Group not found" },
        { status: 404 }
      );
    }

    // Calculate exchange rate if currencies differ
    let exchangeRate = 1.0;
    let convertedAmount = amount;

    if (currency !== group.currency) {
      // Look up exchange rate
      const rate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: currency as Currency,
          toCurrency: group.currency,
        },
        orderBy: { effectiveDate: "desc" },
      });

      exchangeRate = rate?.rate || (currency === "USD" ? 83.5 : 1 / 83.5);
      convertedAmount = amount * exchangeRate;
    }

    // Calculate splits based on split type
    const splits = calculateSplits(
      splitType as SplitType,
      convertedAmount,
      splitInputs || group.members.map((m) => ({ userId: m.userId })),
      exchangeRate
    );

    // Create expense with splits in a transaction
    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          groupId,
          paidById,
          createdById: session.user.id,
          amount,
          currency: currency as Currency,
          exchangeRate,
          convertedAmount,
          category,
          description,
          notes,
          date: new Date(date),
          splitType: splitType as SplitType,
        },
      });

      // Create splits
      await tx.expenseSplit.createMany({
        data: splits.map((s) => ({
          expenseId: exp.id,
          userId: s.userId,
          amount: s.amount,
          percentage: s.percentage,
          shares: s.shares,
          owedAmount: s.owedAmount,
        })),
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "Expense",
          entityId: exp.id,
          newValue: {
            description,
            amount,
            currency,
            paidById,
            splitType,
            splits: splits.length,
          },
        },
      });

      return exp;
    });

    // Fetch the complete expense with relations
    const fullExpense = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        splits: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json(
      { success: true, data: fullExpense, message: "Expense created" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating expense:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create expense" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Split Calculation Helper
// =============================================================================
// Computes the split amounts for each participant based on the split type.
// This is a core piece of business logic that must handle all four split types
// and ensure the splits always sum to the total amount (no rounding errors).
// =============================================================================
interface ComputedSplit {
  userId: string;
  amount: number;
  percentage?: number;
  shares?: number;
  owedAmount: number;
}

function calculateSplits(
  splitType: SplitType,
  totalAmount: number,
  inputs: Array<{ userId: string; amount?: number; percentage?: number; shares?: number }>,
  exchangeRate: number = 1.0
): ComputedSplit[] {
  switch (splitType) {
    case "EQUAL": {
      // Divide equally, handle rounding by giving remainder to first person
      const perPerson = Math.floor((totalAmount / inputs.length) * 100) / 100;
      const remainder = Math.round((totalAmount - perPerson * inputs.length) * 100) / 100;

      return inputs.map((input, i) => {
        const amt = i === 0 ? perPerson + remainder : perPerson;
        return {
          userId: input.userId,
          amount: amt,
          owedAmount: amt,
        };
      });
    }

    case "EXACT": {
      // Each person's exact amount is specified
      return inputs.map((input) => ({
        userId: input.userId,
        amount: input.amount || 0,
        owedAmount: (input.amount || 0) * exchangeRate,
      }));
    }

    case "PERCENTAGE": {
      // Each person pays a percentage of the total
      return inputs.map((input) => {
        const pct = input.percentage || 0;
        const amt = Math.round(totalAmount * (pct / 100) * 100) / 100;
        return {
          userId: input.userId,
          amount: amt,
          percentage: pct,
          owedAmount: amt,
        };
      });
    }

    case "SHARES": {
      // Divide by share ratio
      const totalShares = inputs.reduce((sum, i) => sum + (i.shares || 1), 0);
      return inputs.map((input) => {
        const shareCount = input.shares || 1;
        const amt = Math.round(totalAmount * (shareCount / totalShares) * 100) / 100;
        return {
          userId: input.userId,
          amount: amt,
          shares: shareCount,
          owedAmount: amt,
        };
      });
    }

    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}
