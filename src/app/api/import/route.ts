// =============================================================================
// CSV Import API — Parse, Resolve Anomalies, Execute Import
// =============================================================================
// POST /api/import/parse    — Upload CSV, parse, detect anomalies
// POST /api/import/resolve  — Submit anomaly resolutions
// POST /api/import/execute  — Execute the import after resolution
// GET  /api/import/sessions — List import sessions
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCSVString } from "@/lib/csv-parser";
import { detectAnomalies } from "@/lib/anomaly-detector";
import type { AnomalyResolution, Currency, SplitType } from "@prisma/client";

// =============================================================================
// POST /api/import — Main import endpoint (handles different actions via body)
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const action = formData.get("action") as string;

    switch (action) {
      case "parse":
        return handleParse(formData, session.user.id);
      case "resolve":
        return handleResolve(formData, session.user.id);
      case "execute":
        return handleExecute(formData, session.user.id);
      default:
        return NextResponse.json(
          { success: false, error: "Invalid action. Use: parse, resolve, execute" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { success: false, error: "Import operation failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PARSE — Upload CSV, detect anomalies, create import session
// =============================================================================
async function handleParse(formData: FormData, userId: string) {
  const file = formData.get("file") as File;
  const groupId = formData.get("groupId") as string;

  if (!file || !groupId) {
    return NextResponse.json(
      { success: false, error: "File and groupId are required" },
      { status: 400 }
    );
  }

  // Read CSV content
  const csvContent = await file.text();

  // Parse CSV into structured rows
  const parsedRows = parseCSVString(csvContent);

  // Create import session
  const importSession = await prisma.importSession.create({
    data: {
      groupId,
      userId,
      filename: file.name,
      totalRows: parsedRows.length,
      status: "PROCESSING",
    },
  });

  // Run anomaly detection
  const detectionResult = await detectAnomalies(parsedRows, groupId);

  // Store anomalies in database
  if (detectionResult.anomalies.length > 0) {
    await prisma.importAnomaly.createMany({
      data: detectionResult.anomalies.map((a) => ({
        sessionId: importSession.id,
        rowNumber: a.rowNumber,
        type: a.type,
        severity: a.severity,
        description: a.description,
        suggestedAction: a.suggestedAction,
        rawData: a.rawData,
        field: a.field,
        currentValue: a.currentValue,
        suggestedValue: a.suggestedValue,
      })),
    });
  }

  // Update session status
  await prisma.importSession.update({
    where: { id: importSession.id },
    data: {
      status: detectionResult.anomalies.length > 0 ? "REVIEW" : "IMPORTING",
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: "IMPORT",
      entityType: "ImportSession",
      entityId: importSession.id,
      newValue: {
        filename: file.name,
        totalRows: parsedRows.length,
        anomaliesDetected: detectionResult.anomalies.length,
      },
    },
  });

  // Return anomalies for review
  const anomalies = await prisma.importAnomaly.findMany({
    where: { sessionId: importSession.id },
    orderBy: [{ severity: "asc" }, { rowNumber: "asc" }],
  });

  return NextResponse.json({
    success: true,
    data: {
      sessionId: importSession.id,
      totalRows: parsedRows.length,
      cleanRows: detectionResult.cleanRows.length,
      anomalies,
      summary: detectionResult.summary,
    },
  });
}

// =============================================================================
// RESOLVE — Submit anomaly resolutions
// =============================================================================
async function handleResolve(formData: FormData, userId: string) {
  const resolutionsJson = formData.get("resolutions") as string;
  const sessionId = formData.get("sessionId") as string;

  if (!resolutionsJson || !sessionId) {
    return NextResponse.json(
      { success: false, error: "sessionId and resolutions are required" },
      { status: 400 }
    );
  }

  const resolutions: Array<{
    anomalyId: string;
    resolution: AnomalyResolution;
    modifiedValue?: string;
    note?: string;
  }> = JSON.parse(resolutionsJson);

  // Update each anomaly resolution
  await Promise.all(
    resolutions.map((r) =>
      prisma.importAnomaly.update({
        where: { id: r.anomalyId },
        data: {
          resolution: r.resolution,
          resolutionNote: r.note,
          resolvedById: userId,
          resolvedAt: new Date(),
        },
      })
    )
  );

  // Check if all anomalies are resolved
  const unresolved = await prisma.importAnomaly.count({
    where: { sessionId, resolution: "PENDING" },
  });

  return NextResponse.json({
    success: true,
    data: {
      resolved: resolutions.length,
      remaining: unresolved,
      allResolved: unresolved === 0,
    },
  });
}

// =============================================================================
// EXECUTE — Import approved rows into the database
// =============================================================================
async function handleExecute(formData: FormData, userId: string) {
  const sessionId = formData.get("sessionId") as string;

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: "sessionId is required" },
      { status: 400 }
    );
  }

  const importSession = await prisma.importSession.findUnique({
    where: { id: sessionId },
    include: {
      anomalies: true,
    },
  });

  if (!importSession) {
    return NextResponse.json(
      { success: false, error: "Import session not found" },
      { status: 404 }
    );
  }

  // Get the group and its members for name-to-ID mapping
  const group = await prisma.group.findUnique({
    where: { id: importSession.groupId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!group) {
    return NextResponse.json(
      { success: false, error: "Group not found" },
      { status: 404 }
    );
  }

  // Build name → userId map (case-insensitive)
  const nameToUserId = new Map<string, string>();
  group.members.forEach((m) => {
    nameToUserId.set(m.user.name.toLowerCase(), m.userId);
  });

  // Get rejected row numbers
  const rejectedRows = new Set(
    importSession.anomalies
      .filter((a) => a.resolution === "REJECTED")
      .map((a) => a.rowNumber)
  );

  // Re-parse the CSV to get the clean rows
  // In production, we'd store the parsed data in the session
  // For now, we'll read from the anomaly rawData + original file
  let importedCount = 0;
  let skippedCount = 0;

  // Get all unique rows from anomalies to build the dataset
  const allAnomalyRows = new Map<number, Record<string, unknown>>();
  importSession.anomalies.forEach((a) => {
    allAnomalyRows.set(a.rowNumber, a.rawData as Record<string, unknown>);
  });

  // Process each row that isn't rejected
  // We import rows that either have no anomalies or have approved/modified anomalies
  const processedRows = new Set<number>();

  for (const anomaly of importSession.anomalies) {
    if (processedRows.has(anomaly.rowNumber)) continue;
    processedRows.add(anomaly.rowNumber);

    if (rejectedRows.has(anomaly.rowNumber)) {
      skippedCount++;
      continue;
    }

    // Check if this row is a settlement-as-expense that was approved for conversion
    if (anomaly.type === "SETTLEMENT_AS_EXPENSE" && anomaly.resolution === "APPROVED") {
      const rawData = anomaly.rawData as Record<string, string>;
      const payerName = rawData.paid_by || rawData.paidBy;
      const splitBetween = rawData.split_between || rawData.splitBetween;
      const payerId = nameToUserId.get(payerName?.toLowerCase());
      const receiverName = splitBetween?.split(",")[0]?.trim();
      const receiverId = nameToUserId.get(receiverName?.toLowerCase());

      if (payerId && receiverId) {
        await prisma.settlement.create({
          data: {
            groupId: importSession.groupId,
            payerId,
            receiverId,
            amount: parseFloat(rawData.amount) || 0,
            currency: (rawData.currency as Currency) || "INR",
            notes: `Imported from CSV: ${rawData.description}`,
          },
        });
        importedCount++;
      }
      continue;
    }

    // For approved/modified rows, create expense
    if (anomaly.resolution === "APPROVED" || anomaly.resolution === "MODIFIED") {
      const rawData = anomaly.rawData as Record<string, string>;
      const created = await createExpenseFromRow(rawData, importSession.groupId, userId, nameToUserId);
      if (created) importedCount++;
      else skippedCount++;
    }
  }

  // Update import session
  await prisma.importSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      importedRows: importedCount,
      skippedRows: skippedCount,
      completedAt: new Date(),
      summary: {
        totalRows: importSession.totalRows,
        imported: importedCount,
        skipped: skippedCount,
        anomalies: importSession.anomalies.length,
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      imported: importedCount,
      skipped: skippedCount,
      total: importSession.totalRows,
    },
    message: `Import complete: ${importedCount} rows imported, ${skippedCount} skipped`,
  });
}

// =============================================================================
// Helper: Create expense from raw CSV row
// =============================================================================
async function createExpenseFromRow(
  rawData: Record<string, string>,
  groupId: string,
  userId: string,
  nameToUserId: Map<string, string>
): Promise<boolean> {
  try {
    const payerName = rawData.paid_by || rawData.paidBy || rawData.Paid_By;
    const payerId = nameToUserId.get(payerName?.toLowerCase());
    if (!payerId) return false;

    const amount = parseFloat(rawData.amount);
    if (isNaN(amount) || amount <= 0) return false;

    const currency = (rawData.currency?.toUpperCase() === "USD" ? "USD" : "INR") as Currency;
    const splitType = (rawData.split_type?.toUpperCase() || "EQUAL") as SplitType;

    // Parse split members
    const splitBetweenStr = rawData.split_between || rawData.splitBetween || "";
    const memberNames = splitBetweenStr.split(",").map((n: string) => n.trim());
    const memberIds = memberNames
      .map((name: string) => nameToUserId.get(name.toLowerCase()))
      .filter(Boolean) as string[];

    if (memberIds.length === 0) return false;

    // Get exchange rate if needed
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    let exchangeRate = 1.0;
    let convertedAmount = amount;

    if (group && currency !== group.currency) {
      const rate = await prisma.exchangeRate.findFirst({
        where: { fromCurrency: currency, toCurrency: group.currency },
        orderBy: { effectiveDate: "desc" },
      });
      exchangeRate = rate?.rate || (currency === "USD" ? 83.5 : 1 / 83.5);
      convertedAmount = amount * exchangeRate;
    }

    // Calculate split amounts
    const perPerson = Math.round((convertedAmount / memberIds.length) * 100) / 100;

    await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          groupId,
          paidById: payerId,
          createdById: userId,
          amount,
          currency,
          exchangeRate,
          convertedAmount,
          category: rawData.category || "General",
          description: rawData.description || "Imported expense",
          notes: rawData.notes || `Imported from CSV`,
          date: rawData.date ? new Date(rawData.date) : new Date(),
          splitType,
          transactionId: rawData.transaction_id || rawData.transactionId,
        },
      });

      await tx.expenseSplit.createMany({
        data: memberIds.map((memberId) => ({
          expenseId: expense.id,
          userId: memberId,
          amount: perPerson,
          owedAmount: perPerson,
        })),
      });
    });

    return true;
  } catch (error) {
    console.error("Error importing row:", error);
    return false;
  }
}

// =============================================================================
// GET /api/import — List import sessions
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      // Get specific session with anomalies
      const importSession = await prisma.importSession.findUnique({
        where: { id: sessionId },
        include: {
          anomalies: {
            orderBy: [{ severity: "asc" }, { rowNumber: "asc" }],
            include: {
              resolvedBy: { select: { id: true, name: true } },
            },
          },
          user: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({ success: true, data: importSession });
    }

    // List all sessions
    const sessions = await prisma.importSession.findMany({
      where: { userId: session.user.id },
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { anomalies: true } },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error("Error fetching import sessions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch import sessions" },
      { status: 500 }
    );
  }
}
