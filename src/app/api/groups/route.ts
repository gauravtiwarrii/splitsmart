// =============================================================================
// Groups API — List & Create
// =============================================================================
// GET  /api/groups — List all groups the current user belongs to
// POST /api/groups — Create a new group
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: { userId: session.user.id },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: {
            expenses: { where: { isDeleted: false } },
            settlements: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to include computed stats
    const groupsWithStats = groups.map((group) => ({
      ...group,
      memberCount: group.members.filter((m) => m.isActive).length,
      totalExpenses: group._count.expenses,
      totalSettlements: group._count.settlements,
    }));

    return NextResponse.json({ success: true, data: groupsWithStats });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, currency = "INR" } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Group name is required" },
        { status: 400 }
      );
    }

    // Create group and add creator as admin member
    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        currency,
        createdById: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: "ADMIN",
            isActive: true,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "Group",
        entityId: group.id,
        newValue: { name: group.name, currency: group.currency },
      },
    });

    return NextResponse.json(
      { success: true, data: group, message: "Group created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create group" },
      { status: 500 }
    );
  }
}
