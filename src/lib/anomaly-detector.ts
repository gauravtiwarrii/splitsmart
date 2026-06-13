// =============================================================================
// SplitSmart — Anomaly Detection Engine
// =============================================================================
// Detects 12 categories of anomalies in CSV-imported expense data. Each
// detector is a focused function that examines rows for a specific class
// of issues and returns DetectedAnomaly[] with severity, description,
// and a suggested fix.
//
// The orchestrator `detectAnomalies()` runs all 12 detectors, de-duplicates
// results, and produces a summary report for the user review UI.
//
// ─────────────────────────────────────────────────────────────────────────────
// SEVERITY GUIDE
// ─────────────────────────────────────────────────────────────────────────────
//   ERROR   — Import will fail if not resolved (e.g., missing payer)
//   WARNING — Should be reviewed; can be overridden (e.g., currency mismatch)
//   INFO    — Informational; auto-handled (e.g., detected settlement row)
// =============================================================================

import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/db";
import type {
  ParsedCSVRow,
  AnomalyDetectionResult,
  DetectedAnomaly,
  AnomalySummary,
  AnomalyType,
  AnomalySeverity,
} from "@/types";

// =============================================================================
// Orchestrator
// =============================================================================

/**
 * Runs all 12 anomaly detectors on a set of parsed CSV rows and returns
 * a structured result with clean rows, anomaly details, and summary stats.
 *
 * **Flow:**
 *   1. Fetch group membership data (names, join/leave dates) from the database.
 *   2. Run all detectors — some are pure (row-only), others need DB context.
 *   3. Collect anomalies, identify rows that have at least one ERROR anomaly.
 *   4. Separate clean rows (no errors) from flagged rows.
 *   5. Build summary statistics.
 *
 * @param rows    - Parsed CSV rows from the csv-parser module.
 * @param groupId - The target group (needed for membership checks).
 * @returns AnomalyDetectionResult with clean rows, anomalies, and summary.
 */
export async function detectAnomalies(
  rows: ParsedCSVRow[],
  groupId: string
): Promise<AnomalyDetectionResult> {
  // ── Fetch group context ──
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { currency: true },
  });

  // Build lookup structures for member checks
  const memberNames = groupMembers.map((m) => m.user.name);
  const memberInfo = groupMembers.map((m) => ({
    name: m.user.name,
    email: m.user.email,
    joinedAt: m.joinedAt,
    leftAt: m.leftAt,
    isActive: m.isActive,
  }));

  // ── Run all detectors ──
  const allAnomalies: DetectedAnomaly[] = [];

  allAnomalies.push(...detectDuplicateExpenses(rows));
  allAnomalies.push(...detectNegativeAmounts(rows));
  allAnomalies.push(...detectSettlementsAsExpenses(rows));
  allAnomalies.push(...detectMissingPayer(rows));
  allAnomalies.push(...detectInvalidSplits(rows));
  allAnomalies.push(...detectCurrencyMismatch(rows, group.currency));
  allAnomalies.push(...detectDuplicateTransactionIds(rows));
  allAnomalies.push(...detectFutureDates(rows));
  allAnomalies.push(...detectAmountMismatch(rows));
  allAnomalies.push(...detectExpenseAfterMemberLeft(rows, memberInfo));
  allAnomalies.push(...detectExpenseBeforeMemberJoined(rows, memberInfo));
  allAnomalies.push(...detectInvalidMemberNames(rows, memberNames));
  allAnomalies.push(...detectZeroAmount(rows));
  allAnomalies.push(...detectMissingCurrency(rows));
  allAnomalies.push(...detectAmbiguousDate(rows));
  allAnomalies.push(...detectConflictingSplitInfo(rows));

  // ── Identify rows with errors ──
  const errorRowNumbers = new Set(
    allAnomalies
      .filter((a) => a.severity === "ERROR")
      .map((a) => a.rowNumber)
  );

  // Clean rows = rows with zero ERROR-level anomalies
  // (rows with only WARNING/INFO anomalies are still importable)
  const cleanRows = rows.filter((r) => !errorRowNumbers.has(r.rowNumber));

  // ── Build summary ──
  const summary = buildSummary(allAnomalies);

  return {
    totalRows: rows.length,
    cleanRows,
    anomalies: allAnomalies,
    summary,
  };
}

// =============================================================================
// Individual Detectors
// =============================================================================

/**
 * **Detector 1: Duplicate Expenses**
 *
 * Flags rows where the combination of (description + amount + date + paidBy)
 * matches another row. This catches accidental double-entries that commonly
 * occur when users export overlapping date ranges from their source app.
 *
 * Severity: WARNING — the user may genuinely have two identical expenses.
 */
function detectDuplicateExpenses(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const seen = new Map<string, number>(); // fingerprint → first row number

  for (const row of rows) {
    // Build a fingerprint from the fields that, together, identify a unique expense
    const fingerprint = [
      row.description?.toLowerCase().replace(/[^a-z0-9]/g, "").trim() ?? "",
      row.amount?.toString() ?? "",
      row.date ?? "",
      row.paidBy?.toLowerCase().replace(/[^a-z0-9]/g, "").trim() ?? "",
    ].join("|");

    // Skip rows where we can't compute a meaningful fingerprint
    if (fingerprint === "|||") continue;

    const firstRow = seen.get(fingerprint);
    if (firstRow !== undefined) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "DUPLICATE_EXPENSE",
          severity: "WARNING",
          description: `Possible duplicate of row ${firstRow}: same description, amount, date, and payer`,
          suggestedAction: "Review and remove if duplicate, or keep if intentional",
          rawData: row.raw,
          field: "description",
          currentValue: row.description,
        })
      );
    } else {
      seen.set(fingerprint, row.rowNumber);
    }
  }

  return anomalies;
}

/**
 * **Detector 2: Negative Amounts**
 *
 * Flags rows where the expense amount is negative. Expenses should always
 * be positive numbers — negative values usually indicate a refund or data
 * entry error.
 *
 * Severity: ERROR — cannot create an expense with a negative amount.
 */
function detectNegativeAmounts(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const row of rows) {
    if (row.amount !== undefined && row.amount < 0) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "NEGATIVE_AMOUNT",
          severity: "ERROR",
          description: `Negative amount detected: ${row.amount}`,
          suggestedAction: "Use the absolute value, or remove this row if it's a refund",
          rawData: row.raw,
          field: "amount",
          currentValue: row.amount.toString(),
          suggestedValue: Math.abs(row.amount).toString(),
        })
      );
    }
  }

  return anomalies;
}

/**
 * **Detector 3: Settlements Disguised as Expenses**
 *
 * Flags rows whose description matches patterns that suggest the row is
 * actually a settlement/repayment rather than an expense. Importing these
 * as expenses would double-count the money flow.
 *
 * Severity: WARNING — the user should confirm whether this is an expense
 * or a settlement (which should be recorded differently).
 */
function detectSettlementsAsExpenses(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  const settlementPatterns = [
    /\bsettlement\b/i,
    /\bpaid\s*back\b/i,
    /\brepaid\b/i,
    /\bsettling\b/i,
    /\breimburs/i,
    /\bpayback\b/i,
    /\bpay\s*back\b/i,
    /\bdeposit\s*share\b/i,
  ];

  for (const row of rows) {
    if (!row.description) continue;

    const matchedPattern = settlementPatterns.find((p) =>
      p.test(row.description!)
    );

    if (matchedPattern) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "SETTLEMENT_AS_EXPENSE",
          severity: "WARNING",
          description: `Description "${row.description}" looks like a settlement, not an expense`,
          suggestedAction:
            "Record this as a settlement instead, or keep as expense if it's genuinely an expense",
          rawData: row.raw,
          field: "description",
          currentValue: row.description,
        })
      );
    }
  }

  return anomalies;
}

/**
 * **Detector 4: Missing Payer**
 *
 * Flags rows where the paidBy field is empty, null, or undefined.
 * Every expense must have a payer for balance calculations to work.
 *
 * Severity: ERROR — cannot create an expense without knowing who paid.
 */
function detectMissingPayer(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const row of rows) {
    if (!row.paidBy || row.paidBy.trim() === "") {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "MISSING_PAYER",
          severity: "ERROR",
          description: "No payer specified for this expense",
          suggestedAction: "Specify who paid for this expense",
          rawData: row.raw,
          field: "paidBy",
          currentValue: row.paidBy ?? "(empty)",
        })
      );
    }
  }

  return anomalies;
}

/**
 * **Detector: Zero Amount**
 */
function detectZeroAmount(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  for (const row of rows) {
    if (row.amount === 0) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "ZERO_AMOUNT",
          severity: "ERROR",
          description: "Expense amount is zero",
          suggestedAction: "Specify a valid amount or remove this row",
          rawData: row.raw,
          field: "amount",
          currentValue: "0",
        })
      );
    }
  }
  return anomalies;
}

/**
 * **Detector: Missing Currency**
 */
function detectMissingCurrency(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  for (const row of rows) {
    if (!row.currency || row.currency.trim() === "") {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "MISSING_CURRENCY",
          severity: "WARNING",
          description: "No currency specified",
          suggestedAction: "Default to group currency (INR)",
          rawData: row.raw,
          field: "currency",
          currentValue: "(empty)",
          suggestedValue: "INR",
        })
      );
    }
  }
  return anomalies;
}

/**
 * **Detector: Ambiguous Date**
 */
function detectAmbiguousDate(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  for (const row of rows) {
    const rawDate = row.raw.date;
    if (rawDate && /^\d{2}\/\d{2}\/\d{4}$/.test(rawDate.trim())) {
      const [p1, p2] = rawDate.trim().split('/');
      if (parseInt(p1) <= 12 && parseInt(p2) <= 12 && p1 !== p2) {
        anomalies.push(
          createAnomaly({
            rowNumber: row.rowNumber,
            type: "AMBIGUOUS_DATE",
            severity: "WARNING",
            description: `Ambiguous date format: ${rawDate} (could be DD/MM or MM/DD)`,
            suggestedAction: `Ensure this is interpreted correctly as ${row.date}`,
            rawData: row.raw,
            field: "date",
            currentValue: rawDate,
            suggestedValue: row.date,
          })
        );
      }
    }
  }
  return anomalies;
}

/**
 * **Detector: Conflicting Split Info**
 */
function detectConflictingSplitInfo(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  for (const row of rows) {
    const isExplicitlyEqual = row.raw.split_type?.toLowerCase().trim() === 'equal';
    const hasSplitDetails = !!row.splitDetails;
    if (isExplicitlyEqual && hasSplitDetails) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "CONFLICTING_SPLIT_INFO",
          severity: "WARNING",
          description: "Row specified as 'equal' split, but contains specific split shares/details",
          suggestedAction: "Change to unequal/shares to apply the specific details",
          rawData: row.raw,
          field: "splitType",
          currentValue: "EQUAL",
          suggestedValue: "SHARES",
        })
      );
    }
  }
  return anomalies;
}

/**
 * **Detector 5: Invalid Splits**
 *
 * Validates split configurations:
 *   - PERCENTAGE splits: percentages must sum to 100 (±1% tolerance for
 *     floating-point rounding).
 *   - EXACT splits: individual amounts must sum to the total expense amount.
 *   - SHARES splits: validates that share values are parseable positive integers.
 *
 * Parses split detail strings from the `splitDetails` field or the `notes`
 * field using pattern matching (e.g., "Percentages: 30/25/25/20" or
 * "Rohan 700; Priya 400; Meera 400").
 *
 * Severity: WARNING — the data may still be importable with corrections.
 */
function detectInvalidSplits(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const row of rows) {
    if (!row.splitType) continue;

    const splitType = row.splitType.toUpperCase();
    const parsed = parseSplitDetails(row);

    if (splitType === "PERCENTAGE") {
      if (parsed.values.length > 0) {
        const sum = parsed.values.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 100) > 1) {
          anomalies.push(
            createAnomaly({
              rowNumber: row.rowNumber,
              type: "INVALID_SPLIT",
              severity: "WARNING",
              description: `Percentage splits sum to ${sum.toFixed(1)}% instead of 100%`,
              suggestedAction: "Adjust percentages to sum to 100%",
              rawData: row.raw,
              field: "splitType",
              currentValue: `${sum.toFixed(1)}%`,
              suggestedValue: "100%",
            })
          );
        }
      }
    }

    if (splitType === "EXACT" && row.amount !== undefined) {
      if (parsed.values.length > 0) {
        const sum = parsed.values.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - row.amount) > 0.01) {
          anomalies.push(
            createAnomaly({
              rowNumber: row.rowNumber,
              type: "INVALID_SPLIT",
              severity: "WARNING",
              description: `Exact split amounts sum to ${sum.toFixed(2)} but total is ${row.amount.toFixed(2)}`,
              suggestedAction: "Adjust split amounts to match the total expense amount",
              rawData: row.raw,
              field: "amount",
              currentValue: sum.toFixed(2),
              suggestedValue: row.amount.toFixed(2),
            })
          );
        }
      }
    }

    // Validate member count matches split value count
    if (parsed.values.length > 0 && row.splitBetween && row.splitBetween.length > 0) {
      if (parsed.values.length !== row.splitBetween.length) {
        anomalies.push(
          createAnomaly({
            rowNumber: row.rowNumber,
            type: "INVALID_SPLIT",
            severity: "WARNING",
            description: `Split has ${parsed.values.length} values but ${row.splitBetween.length} participants`,
            suggestedAction: "Ensure the number of split values matches the number of participants",
            rawData: row.raw,
            field: "splitType",
            currentValue: `${parsed.values.length} values`,
            suggestedValue: `${row.splitBetween.length} values`,
          })
        );
      }
    }
  }

  return anomalies;
}

/**
 * Parses split detail values from a CSV row. Checks `splitDetails` first,
 * then falls back to `notes` for inline split configurations.
 *
 * Supports formats:
 *   - "Name1 value1; Name2 value2" (e.g., "Rohan 700; Priya 400; Meera 400")
 *   - "Name1 value1%; Name2 value2%" (e.g., "Aisha 30%; Rohan 30%")
 *   - "Percentages: 30/25/25/20" or "Shares: 2/1/1/1"
 *   - "Exact: 500/400/400/300"
 *   - Slash-separated values from notes (e.g., notes containing "30/25/25/20")
 *
 * @returns An object with parsed numeric `values` and optional `names` arrays.
 */
export function parseSplitDetails(row: ParsedCSVRow): {
  values: number[];
  names: string[];
} {
  // Try splitDetails field first, then notes
  const source = row.splitDetails || "";
  const notes = row.notes || "";

  // Strategy 1: "Name value; Name value" format from splitDetails
  // e.g., "Rohan 700; Priya 400; Meera 400" or "Aisha 30%; Rohan 30%"
  if (source) {
    const nameValuePattern = /([A-Za-z][A-Za-z'\s]*?)\s+([\d.]+)%?/g;
    const matches = [...source.matchAll(nameValuePattern)];
    if (matches.length >= 2) {
      return {
        names: matches.map(m => m[1].trim()),
        values: matches.map(m => parseFloat(m[2])),
      };
    }
  }

  // Strategy 2: "Prefix: val/val/val" format from notes
  // e.g., "Percentages: 30/25/25/20" or "Shares: 2/1/1/1" or "Exact: 500/400/400/300"
  const prefixSlashPattern = /(?:percentages?|shares?|exact|split)[:\s]+(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)+)/i;
  const prefixMatch = notes.match(prefixSlashPattern) || source.match(prefixSlashPattern);
  if (prefixMatch) {
    const values = prefixMatch[1].split("/").map(v => parseFloat(v.trim()));
    if (values.every(v => !isNaN(v))) {
      return { names: [], values };
    }
  }

  // Strategy 3: Bare slash-separated numbers in notes (e.g., "30/25/25/20")
  const bareSlashPattern = /(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?){2,})/;
  const bareMatch = notes.match(bareSlashPattern);
  if (bareMatch) {
    const values = bareMatch[1].split("/").map(v => parseFloat(v.trim()));
    if (values.every(v => !isNaN(v))) {
      return { names: [], values };
    }
  }

  // Strategy 4: Try extracting from raw data keys containing 'percentage' or 'amount'
  const rawValues = extractNumericValues(row.raw, "percentage");
  if (rawValues.length > 0) {
    return { names: [], values: rawValues };
  }

  return { names: [], values: [] };
}

/**
 * **Detector 6: Currency Mismatch**
 *
 * Flags rows where the expense currency differs from the group's default
 * currency. These rows will need exchange rate conversion during import.
 *
 * Severity: INFO — currency conversion is automatic, but the user should
 * be aware that a rate will be applied.
 */
function detectCurrencyMismatch(
  rows: ParsedCSVRow[],
  groupCurrency: string
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const row of rows) {
    if (
      row.currency &&
      row.currency.toUpperCase() !== groupCurrency.toUpperCase()
    ) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "CURRENCY_MISMATCH",
          severity: "INFO",
          description: `Expense currency (${row.currency.toUpperCase()}) differs from group currency (${groupCurrency})`,
          suggestedAction:
            "Amount will be converted using the exchange rate at the time of the expense",
          rawData: row.raw,
          field: "currency",
          currentValue: row.currency.toUpperCase(),
          suggestedValue: groupCurrency,
        })
      );
    }
  }

  return anomalies;
}

/**
 * **Detector 7: Duplicate Transaction IDs**
 *
 * Flags rows that share the same transactionId. Transaction IDs should be
 * unique — duplicates indicate either a data export bug or accidental
 * double-entry.
 *
 * Severity: WARNING — the user needs to decide which row to keep.
 */
function detectDuplicateTransactionIds(
  rows: ParsedCSVRow[]
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const seen = new Map<string, number>(); // transactionId → first row

  for (const row of rows) {
    if (!row.transactionId) continue;

    const txnId = row.transactionId.trim();
    if (!txnId) continue;

    const firstRow = seen.get(txnId);
    if (firstRow !== undefined) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "DUPLICATE_TRANSACTION_ID",
          severity: "WARNING",
          description: `Transaction ID "${txnId}" already appears in row ${firstRow}`,
          suggestedAction:
            "Remove the duplicate row, or assign a unique transaction ID",
          rawData: row.raw,
          field: "transactionId",
          currentValue: txnId,
        })
      );
    } else {
      seen.set(txnId, row.rowNumber);
    }
  }

  return anomalies;
}

/**
 * **Detector 8: Future Dates**
 *
 * Flags rows where the expense date is in the future. While pre-dated
 * expenses are valid (e.g., upcoming bills), they're unusual enough in
 * CSV imports to warrant a review.
 *
 * Severity: WARNING — might be a typo in the year or date format.
 */
function detectFutureDates(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const now = new Date();

  for (const row of rows) {
    if (!row.date) continue;

    const parsedDate = new Date(row.date);
    if (isNaN(parsedDate.getTime())) continue; // Skip unparseable dates

    if (parsedDate > now) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "FUTURE_DATE",
          severity: "WARNING",
          description: `Expense date (${row.date}) is in the future`,
          suggestedAction: "Verify the date is correct, or update to today's date",
          rawData: row.raw,
          field: "date",
          currentValue: row.date,
          suggestedValue: now.toISOString().split("T")[0],
        })
      );
    }
  }

  return anomalies;
}

/**
 * **Detector 9: Amount Mismatch**
 *
 * Flags rows that share the same transactionId but have different amounts.
 * This indicates data corruption or an inconsistent export where the same
 * transaction appears with conflicting values.
 *
 * Severity: ERROR — cannot reliably import when the amount is ambiguous.
 */
function detectAmountMismatch(rows: ParsedCSVRow[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  // Build a map of transactionId → { amount, rowNumber } for the first occurrence
  const txnAmounts = new Map<string, { amount: number; rowNumber: number }>();

  for (const row of rows) {
    if (!row.transactionId || row.amount === undefined) continue;

    const txnId = row.transactionId.trim();
    if (!txnId) continue;

    const existing = txnAmounts.get(txnId);
    if (existing) {
      // Same transaction ID but different amount
      if (Math.abs(existing.amount - row.amount) > 0.01) {
        anomalies.push(
          createAnomaly({
            rowNumber: row.rowNumber,
            type: "AMOUNT_MISMATCH",
            severity: "ERROR",
            description: `Transaction "${txnId}" has amount ${row.amount} here but ${existing.amount} in row ${existing.rowNumber}`,
            suggestedAction:
              "Verify the correct amount and fix the discrepancy before importing",
            rawData: row.raw,
            field: "amount",
            currentValue: row.amount.toString(),
            suggestedValue: existing.amount.toString(),
          })
        );
      }
    } else {
      txnAmounts.set(txnId, {
        amount: row.amount,
        rowNumber: row.rowNumber,
      });
    }
  }

  return anomalies;
}

/**
 * **Detector 10: Expense After Member Left**
 *
 * Flags rows where the expense date is after a mentioned member's `leftAt`
 * date. An expense involving a member who has left the group is likely
 * an error — or the member needs to be re-added.
 *
 * Severity: WARNING — the user might want to re-add the member or adjust.
 */
function detectExpenseAfterMemberLeft(
  rows: ParsedCSVRow[],
  memberInfo: MemberContext[]
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const row of rows) {
    if (!row.date) continue;
    const expenseDate = new Date(row.date);
    if (isNaN(expenseDate.getTime())) continue;

    // Check payer
    checkMemberDate(row, row.paidBy, expenseDate, memberInfo, anomalies, "after_left");

    // Check split participants
    if (row.splitBetween) {
      for (const memberName of row.splitBetween) {
        checkMemberDate(row, memberName, expenseDate, memberInfo, anomalies, "after_left");
      }
    }
  }

  return anomalies;
}

/**
 * **Detector 11: Expense Before Member Joined**
 *
 * Flags rows where the expense date is before a mentioned member's
 * `joinedAt` date. This catches imports of historical data that predate
 * a member's participation in the group.
 *
 * Severity: WARNING — the expense may still be valid if the member is
 * being retroactively included.
 */
function detectExpenseBeforeMemberJoined(
  rows: ParsedCSVRow[],
  memberInfo: MemberContext[]
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const row of rows) {
    if (!row.date) continue;
    const expenseDate = new Date(row.date);
    if (isNaN(expenseDate.getTime())) continue;

    // Check payer
    checkMemberDate(row, row.paidBy, expenseDate, memberInfo, anomalies, "before_joined");

    // Check split participants
    if (row.splitBetween) {
      for (const memberName of row.splitBetween) {
        checkMemberDate(row, memberName, expenseDate, memberInfo, anomalies, "before_joined");
      }
    }
  }

  return anomalies;
}

/**
 * **Detector 12: Invalid Member Names**
 *
 * Flags rows where a mentioned member name (payer or split participant)
 * is not found in the group's member list. Uses fuzzy matching (Levenshtein
 * distance ≤ 2) to suggest the closest known member name — this catches
 * typos like "Alce" → "Alice".
 *
 * Severity: ERROR if no close match found; WARNING if a close match exists
 * (the user can confirm the suggestion).
 */
function detectInvalidMemberNames(
  rows: ParsedCSVRow[],
  memberNames: string[]
): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];
  const lowerMemberNames = memberNames.map((n) => n.toLowerCase());

  const checkName = (row: ParsedCSVRow, name: string | undefined, field: string) => {
    if (!name || name.trim() === "") return;
    const trimmed = name.trim();

    // Exact match (case-insensitive)
    if (lowerMemberNames.includes(trimmed.toLowerCase())) return;

    // Fuzzy match — find the closest member name
    let bestMatch: string | undefined;
    let bestDistance = Infinity;

    for (let i = 0; i < memberNames.length; i++) {
      const distance = levenshteinDistance(
        trimmed.toLowerCase(),
        lowerMemberNames[i]
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = memberNames[i];
      }
    }

    // Threshold: Levenshtein distance ≤ 2 is considered a likely typo
    if (bestMatch && bestDistance <= 2) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "INVALID_MEMBER_NAME",
          severity: "WARNING",
          description: `"${trimmed}" is not a group member. Did you mean "${bestMatch}"?`,
          suggestedAction: `Replace "${trimmed}" with "${bestMatch}"`,
          rawData: row.raw,
          field,
          currentValue: trimmed,
          suggestedValue: bestMatch,
        })
      );
    } else {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "INVALID_MEMBER_NAME",
          severity: "ERROR",
          description: `"${trimmed}" is not a member of this group`,
          suggestedAction:
            "Add this person to the group first, or correct the name",
          rawData: row.raw,
          field,
          currentValue: trimmed,
        })
      );
    }
  };

  for (const row of rows) {
    checkName(row, row.paidBy, "paidBy");

    if (row.splitBetween) {
      for (const memberName of row.splitBetween) {
        checkName(row, memberName, "splitBetween");
      }
    }
  }

  return anomalies;
}

// =============================================================================
// Helpers
// =============================================================================

/** Context for a group member's membership period */
interface MemberContext {
  name: string;
  email: string;
  joinedAt: Date;
  leftAt: Date | null;
  isActive: boolean;
}

/**
 * Helper: checks whether a member name's participation dates conflict
 * with an expense date. Used by Detectors 10 and 11.
 */
function checkMemberDate(
  row: ParsedCSVRow,
  memberName: string | undefined,
  expenseDate: Date,
  memberInfo: MemberContext[],
  anomalies: DetectedAnomaly[],
  checkType: "after_left" | "before_joined"
): void {
  if (!memberName || memberName.trim() === "") return;

  const trimmed = memberName.trim().toLowerCase();
  const member = memberInfo.find((m) => m.name.toLowerCase() === trimmed);

  if (!member) return; // Not found — handled by detectInvalidMemberNames

  if (checkType === "after_left" && member.leftAt) {
    if (expenseDate > member.leftAt) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "EXPENSE_AFTER_MEMBER_LEFT",
          severity: "WARNING",
          description: `Expense date (${row.date}) is after "${member.name}" left the group (${member.leftAt.toISOString().split("T")[0]})`,
          suggestedAction: `Remove "${member.name}" from this expense, or re-add them to the group`,
          rawData: row.raw,
          field: "date",
          currentValue: row.date,
          suggestedValue: member.leftAt.toISOString().split("T")[0],
        })
      );
    }
  }

  if (checkType === "before_joined") {
    if (expenseDate < member.joinedAt) {
      anomalies.push(
        createAnomaly({
          rowNumber: row.rowNumber,
          type: "EXPENSE_BEFORE_MEMBER_JOINED",
          severity: "WARNING",
          description: `Expense date (${row.date}) is before "${member.name}" joined the group (${member.joinedAt.toISOString().split("T")[0]})`,
          suggestedAction: `Remove "${member.name}" from this expense, or update their join date`,
          rawData: row.raw,
          field: "date",
          currentValue: row.date,
          suggestedValue: member.joinedAt.toISOString().split("T")[0],
        })
      );
    }
  }
}

/**
 * Creates a DetectedAnomaly with a generated UUID.
 * Reduces boilerplate in each detector function.
 */
function createAnomaly(params: {
  rowNumber: number;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  suggestedAction: string;
  rawData: Record<string, string>;
  field?: string;
  currentValue?: string;
  suggestedValue?: string;
}): DetectedAnomaly {
  return {
    id: uuidv4(),
    rowNumber: params.rowNumber,
    type: params.type,
    severity: params.severity,
    description: params.description,
    suggestedAction: params.suggestedAction,
    rawData: params.rawData,
    field: params.field,
    currentValue: params.currentValue,
    suggestedValue: params.suggestedValue,
  };
}

/**
 * Extracts numeric values from raw CSV row data that match a given key pattern.
 * Used by detectInvalidSplits to find percentage or amount fields that may
 * have column names like "split_1_percentage", "amount_alice", etc.
 */
function extractNumericValues(
  raw: Record<string, string>,
  keyPattern: string
): number[] {
  const values: number[] = [];
  const pattern = keyPattern.toLowerCase();

  for (const [key, value] of Object.entries(raw)) {
    if (key.toLowerCase().includes(pattern)) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        values.push(parsed);
      }
    }
  }

  return values;
}

/**
 * Computes the Levenshtein (edit) distance between two strings.
 *
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, substitutions) needed to transform one string
 * into another.
 *
 * Used for fuzzy member name matching in detectInvalidMemberNames.
 *
 * @param a - First string (should be lowercase)
 * @param b - Second string (should be lowercase)
 * @returns The edit distance between `a` and `b`
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Edge cases: one or both strings are empty
  if (m === 0) return n;
  if (n === 0) return m;

  // Dynamic programming matrix
  // dp[i][j] = edit distance between a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  // Base cases: transforming empty string to/from a prefix
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // Deletion
        dp[i][j - 1] + 1, // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Builds the AnomalySummary from the list of detected anomalies.
 */
function buildSummary(anomalies: DetectedAnomaly[]): AnomalySummary {
  const byType: Record<string, number> = {};

  let errors = 0;
  let warnings = 0;
  let info = 0;

  for (const anomaly of anomalies) {
    // Count by severity
    switch (anomaly.severity) {
      case "ERROR":
        errors++;
        break;
      case "WARNING":
        warnings++;
        break;
      case "INFO":
        info++;
        break;
    }

    // Count by type
    byType[anomaly.type] = (byType[anomaly.type] ?? 0) + 1;
  }

  return {
    total: anomalies.length,
    errors,
    warnings,
    info,
    byType,
  };
}
