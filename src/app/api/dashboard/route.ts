// =============================================================================
// Dashboard Stats API
// =============================================================================
// GET /api/dashboard — Returns aggregated stats for the logged-in user
// =============================================================================

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's groups
    const userGroups = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = userGroups.map((g) => g.groupId);

    // Total spent (expenses paid by this user)
    const totalSpentResult = await prisma.expense.aggregate({
      where: {
        paidById: userId,
        isDeleted: false,
        groupId: { in: groupIds },
      },
      _sum: { convertedAmount: true },
    });
    const totalSpent = totalSpentResult._sum.convertedAmount || 0;

    // Total settled
    const totalSettledResult = await prisma.settlement.aggregate({
      where: {
        OR: [
          { payerId: userId },
          { receiverId: userId },
        ],
        groupId: { in: groupIds },
      },
      _sum: { amount: true },
    });
    const totalSettled = totalSettledResult._sum.amount || 0;

    // Monthly spending (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyExpenses = await prisma.expense.findMany({
      where: {
        groupId: { in: groupIds },
        isDeleted: false,
        date: { gte: sixMonthsAgo },
      },
      select: {
        date: true,
        convertedAmount: true,
      },
      orderBy: { date: "asc" },
    });

    // Group by month
    const monthlySpending = new Map<string, number>();
    monthlyExpenses.forEach((e) => {
      const month = e.date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      monthlySpending.set(
        month,
        (monthlySpending.get(month) || 0) + e.convertedAmount
      );
    });

    // Category breakdown
    const categoryExpenses = await prisma.expense.groupBy({
      by: ["category"],
      where: {
        groupId: { in: groupIds },
        isDeleted: false,
      },
      _sum: { convertedAmount: true },
      orderBy: { _sum: { convertedAmount: "desc" } },
    });

    const totalCategoryAmount = categoryExpenses.reduce(
      (sum, c) => sum + (c._sum.convertedAmount || 0),
      0
    );

    // Top spenders
    const topSpenders = await prisma.expense.groupBy({
      by: ["paidById"],
      where: {
        groupId: { in: groupIds },
        isDeleted: false,
      },
      _sum: { convertedAmount: true },
      orderBy: { _sum: { convertedAmount: "desc" } },
      take: 5,
    });

    // Get user names for top spenders
    const spenderIds = topSpenders.map((s) => s.paidById);
    const spenderUsers = await prisma.user.findMany({
      where: { id: { in: spenderIds } },
      select: { id: true, name: true },
    });
    const spenderNameMap = new Map(spenderUsers.map((u) => [u.id, u.name]));

    // Recent activity
    const [recentExpenses, recentSettlements] = await Promise.all([
      prisma.expense.findMany({
        where: { groupId: { in: groupIds }, isDeleted: false },
        include: {
          paidBy: { select: { name: true } },
          group: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.settlement.findMany({
        where: { groupId: { in: groupIds } },
        include: {
          payer: { select: { name: true } },
          receiver: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    // Format activity feed
    const activity = [
      ...recentExpenses.map((e) => ({
        id: e.id,
        type: "expense" as const,
        title: e.description,
        description: `${e.paidBy.name} paid in ${e.group.name}`,
        amount: e.convertedAmount,
        currency: e.currency,
        userName: e.paidBy.name,
        createdAt: e.createdAt,
      })),
      ...recentSettlements.map((s) => ({
        id: s.id,
        type: "settlement" as const,
        title: `Settlement`,
        description: `${s.payer.name} paid ${s.receiver.name}`,
        amount: s.amount,
        currency: s.currency,
        userName: s.payer.name,
        createdAt: s.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalSpent,
          totalSettled,
          outstandingBalance: totalSpent - totalSettled,
          groupCount: groupIds.length,
          currency: "INR",
        },
        monthlySpending: Array.from(monthlySpending.entries()).map(
          ([month, amount]) => ({
            month,
            amount: Math.round(amount * 100) / 100,
          })
        ),
        categoryBreakdown: categoryExpenses.map((c) => ({
          category: c.category,
          amount: Math.round((c._sum.convertedAmount || 0) * 100) / 100,
          percentage:
            totalCategoryAmount > 0
              ? Math.round(
                  ((c._sum.convertedAmount || 0) / totalCategoryAmount) * 100
                )
              : 0,
        })),
        topSpenders: topSpenders.map((s) => ({
          userId: s.paidById,
          userName: spenderNameMap.get(s.paidById) || "Unknown",
          totalSpent: Math.round((s._sum.convertedAmount || 0) * 100) / 100,
        })),
        recentActivity: activity,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
