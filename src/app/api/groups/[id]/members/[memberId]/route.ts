// =============================================================================
// Member Detail API — Update (set leave date) & Remove
// =============================================================================
// PUT    /api/groups/[id]/members/[memberId] — Update member (set leftAt)
// DELETE /api/groups/[id]/members/[memberId] — Remove member
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id, memberId } = await params;
    const body = await request.json();
    const { leftAt, role } = body;

    const oldMember = await prisma.groupMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { name: true } } },
    });

    if (!oldMember || oldMember.groupId !== id) {
      return NextResponse.json(
        { success: false, error: "Member not found in this group" },
        { status: 404 }
      );
    }

    const member = await prisma.groupMember.update({
      where: { id: memberId },
      data: {
        ...(leftAt && { leftAt: new Date(leftAt), isActive: false }),
        ...(role && { role }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityType: "GroupMember",
        entityId: memberId,
        oldValue: oldMember as object,
        newValue: member as object,
      },
    });

    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id, memberId } = await params;

    const member = await prisma.groupMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { name: true } } },
    });

    if (!member || member.groupId !== id) {
      return NextResponse.json(
        { success: false, error: "Member not found" },
        { status: 404 }
      );
    }

    // Soft delete — mark as inactive with leave date
    await prisma.groupMember.update({
      where: { id: memberId },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entityType: "GroupMember",
        entityId: memberId,
        oldValue: member as object,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${member.user.name} removed from the group`,
    });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { success: false, error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
