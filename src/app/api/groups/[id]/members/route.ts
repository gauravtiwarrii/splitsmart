// =============================================================================
// Group Members API — Add & List Members
// =============================================================================
// GET  /api/groups/[id]/members — List group members
// POST /api/groups/[id]/members — Add a member to the group
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

    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { email, role = "MEMBER", joinedAt } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No user found with this email. They must sign up first." },
        { status: 404 }
      );
    }

    // Check if already an active member
    const existingMember = await prisma.groupMember.findFirst({
      where: { groupId: id, userId: user.id, isActive: true },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: "User is already a member of this group" },
        { status: 409 }
      );
    }

    // Add member
    const member = await prisma.groupMember.create({
      data: {
        userId: user.id,
        groupId: id,
        role,
        joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
        isActive: true,
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
        action: "CREATE",
        entityType: "GroupMember",
        entityId: member.id,
        newValue: {
          groupId: id,
          userId: user.id,
          userName: user.name,
          role,
        },
      },
    });

    return NextResponse.json(
      { success: true, data: member, message: `${user.name} added to the group` },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding member:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add member" },
      { status: 500 }
    );
  }
}
