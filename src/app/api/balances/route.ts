// =============================================================================
// Balances API — Get balances, simplified debts, and balance traces
// =============================================================================
// GET /api/balances?groupId=xxx — Get all balances for a group
// GET /api/balances?groupId=xxx&simplified=true — Get simplified debts
// GET /api/balances?groupId=xxx&userId=xxx&trace=true — Get balance trace
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  calculateNetBalances,
  simplifyDebts,
  getBalanceTrace,
  calculatePairwiseBalances,
} from "@/lib/balance-engine";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    const simplified = searchParams.get("simplified") === "true";
    const trace = searchParams.get("trace") === "true";
    const userId = searchParams.get("userId");

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: "groupId is required" },
        { status: 400 }
      );
    }

    // Balance trace for a specific user
    if (trace && userId) {
      const traceData = await getBalanceTrace(groupId, userId);
      return NextResponse.json({ success: true, data: traceData });
    }

    // Simplified debts (settlement suggestions)
    if (simplified) {
      const suggestions = await simplifyDebts(groupId);
      return NextResponse.json({ success: true, data: suggestions });
    }

    // Full balance overview
    const [netBalances, pairwiseBalances] = await Promise.all([
      calculateNetBalances(groupId),
      calculatePairwiseBalances(groupId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        netBalances,
        pairwiseBalances,
      },
    });
  } catch (error) {
    console.error("Error calculating balances:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate balances" },
      { status: 500 }
    );
  }
}
