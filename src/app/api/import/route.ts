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
import { detectAnomalies, parseSplitDetails } from "@/lib/anomaly-detector";
import type { AnomalyResolution, Currency, SplitType } from "@prisma/client";
import type { ParsedCSVRow } from "@/types";

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

  // Create import session — store parsed rows in summary for later execution
  const importSession = await prisma.importSession.create({
    data: {
      groupId,
      userId,
      filename: file.name,
      totalRows: parsedRows.length,
      status: "PROCESSING",
      summary: { parsedRows: JSON.parse(JSON.stringify(parsedRows)) },
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

  // Update session status (keep parsed rows in summary)
  await prisma.importSession.update({
    where: { id: importSession.id },
    data: {
      status: detectionResult.anomalies.length > 0 ? "REVIEW" : "IMPORTING",
      summary: { parsedRows: JSON.parse(JSON.stringify(parsedRows)) },
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

  // Build anomaly lookup: rowNumber → list of anomalies for that row
  const anomaliesByRow = new Map<number, typeof importSession.anomalies>();
  for (const anomaly of importSession.anomalies) {
    const existing = anomaliesByRow.get(anomaly.rowNumber) || [];
    existing.push(anomaly);
    anomaliesByRow.set(anomaly.rowNumber, existing);
  }

  // Get rejected row numbers (any anomaly on the row was REJECTED → skip entire row)
  const rejectedRows = new Set(
    importSession.anomalies
      .filter((a) => a.resolution === "REJECTED")
      .map((a) => a.rowNumber)
  );

  // Retrieve the parsed rows that were stored in summary during the parse phase
  const summary = importSession.summary as Record<string, unknown> | null;
  const parsedRows: ParsedCSVRow[] = (summary?.parsedRows as ParsedCSVRow[]) || [];

  let importedCount = 0;
  let skippedCount = 0;

  // Process ALL parsed rows — both clean rows and anomaly rows
  for (const row of parsedRows) {
    // Skip rejected rows
    if (rejectedRows.has(row.rowNumber)) {
      skippedCount++;
      continue;
    }

    const rowAnomalies = anomaliesByRow.get(row.rowNumber) || [];

    // Check if any ERROR anomaly on this row was not approved/modified
    const hasUnresolvedError = rowAnomalies.some(
      (a) =>
        a.severity === "ERROR" &&
        a.resolution !== "APPROVED" &&
        a.resolution !== "MODIFIED" &&
        a.resolution !== "AUTO_RESOLVED"
    );
    if (hasUnresolvedError) {
      skippedCount++;
      continue;
    }

    // Check if this row is a settlement-as-expense that was approved for conversion
    const settlementAnomaly = rowAnomalies.find(
      (a) => a.type === "SETTLEMENT_AS_EXPENSE" && a.resolution === "APPROVED"
    );
    if (settlementAnomaly) {
      const payerName = row.paidBy;
      const payerId = nameToUserId.get(payerName?.toLowerCase() || "");
      const receiverName = row.splitBetween?.[0]?.trim();
      const receiverId = nameToUserId.get(receiverName?.toLowerCase() || "");

      if (payerId && receiverId && row.amount !== undefined) {
        await prisma.settlement.create({
          data: {
            groupId: importSession.groupId,
            payerId,
            receiverId,
            amount: Math.abs(row.amount),
            currency: (row.currency?.toUpperCase() === "USD" ? "USD" : "INR") as Currency,
            notes: `Imported from CSV: ${row.description}`,
          },
        });
        importedCount++;
      } else {
        skippedCount++;
      }
      continue;
    }

    // Import as a regular expense
    const created = await createExpenseFromRow(row, importSession.groupId, userId, nameToUserId);
    if (created) importedCount++;
    else skippedCount++;
  }

  // Update import session with final results
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
// Helper: Create expense from a parsed CSV row with full split type support
// =============================================================================
async function createExpenseFromRow(
  row: ParsedCSVRow,
  groupId: string,
  userId: string,
  nameToUserId: Map<string, string>
): Promise<boolean> {
  try {
    // Resolve payer — try parsed field, then raw fallbacks
    const payerName = row.paidBy || row.raw?.paid_by || row.raw?.paidBy;
    const payerId = nameToUserId.get(payerName?.toLowerCase()?.trim() || "");
    if (!payerId) return false;

    const amount = row.amount;
    if (amount === undefined || isNaN(amount) || amount <= 0) return false;

    const currency = (row.currency?.toUpperCase() === "USD" ? "USD" : "INR") as Currency;
    const splitType = (row.splitType?.toUpperCase() || "EQUAL") as SplitType;

    // Resolve split members
    const memberNames = row.splitBetween || [];
    const memberIds = memberNames
      .map((name: string) => nameToUserId.get(name.toLowerCase().trim()))
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

    // ── Calculate splits based on split type ──
    const splitAmounts: { userId: string; amount: number; owedAmount: number; percentage?: number; shares?: number }[] = [];
    const parsed = parseSplitDetails(row);

    switch (splitType) {
      case "PERCENTAGE": {
        if (parsed.values.length === memberIds.length) {
          // Use parsed percentage values
          for (let i = 0; i < memberIds.length; i++) {
            const pct = parsed.values[i];
            const amt = Math.round(convertedAmount * (pct / 100) * 100) / 100;
            splitAmounts.push({
              userId: memberIds[i],
              amount: amt,
              owedAmount: amt,
              percentage: pct,
            });
          }
        } else {
          // Fallback: equal split
          const perPerson = Math.round((convertedAmount / memberIds.length) * 100) / 100;
          for (const memberId of memberIds) {
            splitAmounts.push({ userId: memberId, amount: perPerson, owedAmount: perPerson });
          }
        }
        break;
      }

      case "SHARES": {
        if (parsed.values.length === memberIds.length) {
          const totalShares = parsed.values.reduce((a, b) => a + b, 0);
          for (let i = 0; i < memberIds.length; i++) {
            const shareCount = parsed.values[i];
            const amt = Math.round(convertedAmount * (shareCount / totalShares) * 100) / 100;
            splitAmounts.push({
              userId: memberIds[i],
              amount: amt,
              owedAmount: amt,
              shares: shareCount,
            });
          }
        } else {
          // Fallback: equal split
          const perPerson = Math.round((convertedAmount / memberIds.length) * 100) / 100;
          for (const memberId of memberIds) {
            splitAmounts.push({ userId: memberId, amount: perPerson, owedAmount: perPerson });
          }
        }
        break;
      }

      case "EXACT": {
        if (parsed.values.length === memberIds.length) {
          for (let i = 0; i < memberIds.length; i++) {
            const amt = parsed.values[i];
            splitAmounts.push({
              userId: memberIds[i],
              amount: amt,
              owedAmount: amt * exchangeRate,
            });
          }
        } else {
          // Fallback: equal split
          const perPerson = Math.round((convertedAmount / memberIds.length) * 100) / 100;
          for (const memberId of memberIds) {
            splitAmounts.push({ userId: memberId, amount: perPerson, owedAmount: perPerson });
          }
        }
        break;
      }

      case "EQUAL":
      default: {
        // Divide equally, give rounding remainder to first person
        const perPerson = Math.floor((convertedAmount / memberIds.length) * 100) / 100;
        const remainder = Math.round((convertedAmount - perPerson * memberIds.length) * 100) / 100;
        for (let i = 0; i < memberIds.length; i++) {
          const amt = i === 0 ? perPerson + remainder : perPerson;
          splitAmounts.push({ userId: memberIds[i], amount: amt, owedAmount: amt });
        }
        break;
      }
    }

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
          category: row.category || row.raw?.category || "General",
          description: row.description || "Imported expense",
          notes: row.notes || row.raw?.notes || "Imported from CSV",
          date: row.date ? new Date(row.date) : new Date(),
          splitType,
          transactionId: row.transactionId || row.raw?.transaction_id,
        },
      });

      await tx.expenseSplit.createMany({
        data: splitAmounts.map((split) => ({
          expenseId: expense.id,
          userId: split.userId,
          amount: split.amount,
          owedAmount: split.owedAmount,
          percentage: split.percentage,
          shares: split.shares,
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
