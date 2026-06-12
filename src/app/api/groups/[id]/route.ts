// =============================================================================
// Group Detail API — Get, Update, Delete
// =============================================================================
// GET    /api/groups/[id] — Get group details with members and stats
// PUT    /api/groups/[id] — Update group info
// DELETE /api/groups/[id] — Delete group
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
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        expenses: {
          where: { isDeleted: false },
          include: {
            paidBy: {
              select: { id: true, name: true, email: true },
            },
            splits: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
          orderBy: { date: "desc" },
          take: 50,
        },
        settlements: {
          include: {
            payer: {
              select: { id: true, name: true, email: true },
            },
            receiver: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { settledAt: "desc" },
        },
        _count: {
          select: {
            expenses: { where: { isDeleted: false } },
            settlements: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: "Group not found" },
        { status: 404 }
      );
    }

    // Verify user is a member
    const isMember = group.members.some(
      (m) => m.userId === session.user.id
    );
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    console.error("Error fetching group:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch group" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, currency } = body;

    // Verify user is admin
    const membership = await prisma.groupMember.findFirst({
      where: { groupId: id, userId: session.user.id, role: "ADMIN" },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: "Only admins can update the group" },
        { status: 403 }
      );
    }

    const oldGroup = await prisma.group.findUnique({ where: { id } });

    const group = await prisma.group.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(currency && { currency }),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityType: "Group",
        entityId: group.id,
        oldValue: oldGroup as object,
        newValue: group as object,
      },
    });

    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    console.error("Error updating group:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update group" },
      { status: 500 }
    );
  }
}
