// =============================================================================
// Expense Detail API — Get, Update, Delete
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, currency: true } },
        splits: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: expense });
  } catch (error) {
    console.error("Error fetching expense:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch expense" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const oldExpense = await prisma.expense.findUnique({ where: { id } });
    if (!oldExpense) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(body.description && { description: body.description }),
        ...(body.amount && { amount: body.amount, convertedAmount: body.amount * (oldExpense.exchangeRate || 1) }),
        ...(body.category && { category: body.category }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.date && { date: new Date(body.date) }),
      },
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        splits: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityType: "Expense",
        entityId: id,
        oldValue: oldExpense as object,
        newValue: expense as object,
      },
    });

    return NextResponse.json({ success: true, data: expense });
  } catch (error) {
    console.error("Error updating expense:", error);
    return NextResponse.json({ success: false, error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Soft delete — preserve for audit trail
    const expense = await prisma.expense.update({
      where: { id },
      data: { isDeleted: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entityType: "Expense",
        entityId: id,
        oldValue: expense as object,
      },
    });

    return NextResponse.json({ success: true, message: "Expense deleted" });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json({ success: false, error: "Failed to delete expense" }, { status: 500 });
  }
}
