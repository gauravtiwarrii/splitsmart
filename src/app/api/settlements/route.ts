// =============================================================================
// Settlements API — List & Create
// =============================================================================
// GET  /api/settlements — List settlements
// POST /api/settlements — Record a new settlement
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Currency } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");

    const settlements = await prisma.settlement.findMany({
      where: {
        ...(groupId && { groupId }),
        group: {
          members: { some: { userId: session.user.id } },
        },
      },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: { settledAt: "desc" },
    });

    return NextResponse.json({ success: true, data: settlements });
  } catch (error) {
    console.error("Error fetching settlements:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settlements" },
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
    const { groupId, payerId, receiverId, amount, currency = "INR", notes } = body;

    if (!groupId || !payerId || !receiverId || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (payerId === receiverId) {
      return NextResponse.json(
        { success: false, error: "Payer and receiver must be different" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be positive" },
        { status: 400 }
      );
    }

    const settlement = await prisma.$transaction(async (tx) => {
      const s = await tx.settlement.create({
        data: {
          groupId,
          payerId,
          receiverId,
          amount,
          currency: currency as Currency,
          notes,
        },
        include: {
          payer: { select: { id: true, name: true, email: true } },
          receiver: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SETTLE",
          entityType: "Settlement",
          entityId: s.id,
          newValue: {
            payerName: s.payer.name,
            receiverName: s.receiver.name,
            amount,
            currency,
          },
        },
      });

      return s;
    });

    return NextResponse.json(
      { success: true, data: settlement, message: "Settlement recorded" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating settlement:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record settlement" },
      { status: 500 }
    );
  }
}
