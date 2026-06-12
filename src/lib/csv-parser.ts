// =============================================================================
// SplitSmart — CSV Parser Module
// =============================================================================
// Parses CSV files uploaded by users for bulk expense import. Handles the
// messy reality of user-generated CSV data:
//
//   - Multiple column naming conventions (snake_case, camelCase, Title Case)
//   - Empty rows and whitespace
//   - Various date and number formats
//   - Missing optional fields
//
// The output is an array of normalised ParsedCSVRow objects ready for
// anomaly detection.
// =============================================================================

import Papa from "papaparse";
import type { ParsedCSVRow } from "@/types";

// =============================================================================
// Column Name Mapping
// =============================================================================

/**
 * Maps known variations of column headers to our canonical field names.
 *
 * Users export CSV files from many sources (bank apps, spreadsheets, other
 * split apps), so column names vary wildly. This mapping normalises them.
 *
 * Keys are lowercase (we lowercase the input before matching).
 * Values are the canonical ParsedCSVRow field names.
 */
const COLUMN_NAME_MAP: Record<string, string> = {
  // Transaction ID variations
  transaction_id: "transactionId",
  transactionid: "transactionId",
  "transaction id": "transactionId",
  txn_id: "transactionId",
  txnid: "transactionId",
  "txn id": "transactionId",
  id: "transactionId",
  ref: "transactionId",
  reference: "transactionId",

  // Date variations
  date: "date",
  expense_date: "date",
  expensedate: "date",
  "expense date": "date",
  created_at: "date",
  createdat: "date",
  "created at": "date",
  transaction_date: "date",
  "transaction date": "date",

  // Description variations
  description: "description",
  desc: "description",
  title: "description",
  name: "description",
  expense: "description",
  details: "description",
  memo: "description",
  note: "description",

  // Amount variations
  amount: "amount",
  total: "amount",
  cost: "amount",
  price: "amount",
  value: "amount",
  expense_amount: "amount",
  "expense amount": "amount",

  // Currency variations
  currency: "currency",
  curr: "currency",
  ccy: "currency",
  currency_code: "currency",
  "currency code": "currency",

  // Payer variations
  paid_by: "paidBy",
  paidby: "paidBy",
  "paid by": "paidBy",
  payer: "paidBy",
  paid_by_name: "paidBy",
  "paid by name": "paidBy",
  who_paid: "paidBy",
  "who paid": "paidBy",

  // Split between variations
  split_between: "splitBetween",
  splitbetween: "splitBetween",
  "split between": "splitBetween",
  participants: "splitBetween",
  members: "splitBetween",
  shared_with: "splitBetween",
  "shared with": "splitBetween",
  split_with: "splitBetween",
  "split with": "splitBetween",

  // Split type variations
  split_type: "splitType",
  splittype: "splitType",
  "split type": "splitType",
  type: "splitType",

  // Category variations
  category: "category",
  cat: "category",
  group: "category",
  tag: "category",
  label: "category",

  // Notes variations
  notes: "notes",
  comments: "notes",
  comment: "notes",
  remarks: "notes",
  remark: "notes",
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Parses a CSV File object (from a browser file input or FormData).
 *
 * Uses PapaParse's streaming parser in complete mode — suitable for files
 * up to several MB. For very large files, consider switching to streaming.
 *
 * @param file - A File or Blob containing CSV data.
 * @returns Promise resolving to an array of normalised rows.
 * @throws Error if PapaParse encounters fatal parsing errors.
 */
export async function parseCSVFile(file: File): Promise<ParsedCSVRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const csvContent = event.target?.result;
      if (typeof csvContent !== "string") {
        reject(new Error("Failed to read file as text"));
        return;
      }

      try {
        const rows = parseCSVString(csvContent);
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`));
    };

    // Read as UTF-8 text. For other encodings, the user would need to
    // convert the file first (or we could add encoding detection).
    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Parses a CSV string into normalised rows.
 *
 * @param csvContent - Raw CSV text content.
 * @returns Array of normalised ParsedCSVRow objects.
 * @throws Error if PapaParse encounters fatal errors or no data is found.
 */
export function parseCSVString(csvContent: string): ParsedCSVRow[] {
  // Trim BOM (Byte Order Mark) that some spreadsheet apps prepend
  const cleanContent = csvContent.replace(/^\uFEFF/, "").trim();

  if (!cleanContent) {
    throw new Error("CSV content is empty");
  }

  const result = Papa.parse<Record<string, string>>(cleanContent, {
    header: true,
    skipEmptyLines: "greedy", // Skip lines that are empty or only whitespace
    transformHeader: (header: string) => header.trim(),
    transform: (value: string) => value.trim(),
  });

  if (result.errors.length > 0) {
    // Filter out non-fatal warnings (e.g., TooFewFields on trailing rows)
    const fatalErrors = result.errors.filter((e) => e.type === "Quotes" || e.type === "FieldMismatch");
    if (fatalErrors.length > 0) {
      const errorMessages = fatalErrors
        .slice(0, 5)
        .map((e) => `Row ${e.row}: ${e.message}`)
        .join("; ");
      throw new Error(`CSV parsing errors: ${errorMessages}`);
    }
  }

  if (!result.data || result.data.length === 0) {
    throw new Error("CSV file contains no data rows");
  }

  // Build column name mapping from the actual headers
  const headers = result.meta.fields ?? [];
  const columnMap = normalizeColumnNames(headers);

  // Normalise each row
  const rows: ParsedCSVRow[] = [];
  for (let i = 0; i < result.data.length; i++) {
    const rawRow = result.data[i];

    // Skip rows where every value is empty (belt-and-suspenders with PapaParse's skipEmptyLines)
    const hasData = Object.values(rawRow).some((v) => v && v.trim() !== "");
    if (!hasData) continue;

    // Row numbers are 1-indexed (header = row 1, first data row = row 2)
    const row = normalizeRow(rawRow, i + 2, columnMap);
    rows.push(row);
  }

  return rows;
}

/**
 * Maps actual CSV column headers to canonical field names.
 *
 * For each header in the CSV, we:
 *   1. Lowercase and trim it.
 *   2. Look it up in COLUMN_NAME_MAP.
 *   3. If found, record the mapping from original header → canonical name.
 *
 * @param headers - Array of raw column header strings from the CSV.
 * @returns Map from original header name → canonical field name.
 */
export function normalizeColumnNames(
  headers: string[]
): Map<string, string> {
  const mapping = new Map<string, string>();

  for (const header of headers) {
    const normalised = header.toLowerCase().trim();
    const canonical = COLUMN_NAME_MAP[normalised];
    if (canonical) {
      mapping.set(header, canonical);
    }
  }

  return mapping;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Converts a raw CSV row (keyed by original header names) into a normalised
 * ParsedCSVRow using the column mapping.
 *
 * @param rawRow    - The raw key→value pairs from PapaParse.
 * @param rowNumber - 1-indexed row number in the CSV file (for error reporting).
 * @param columnMap - Mapping from original header → canonical field name.
 * @returns A normalised ParsedCSVRow.
 */
function normalizeRow(
  rawRow: Record<string, string>,
  rowNumber: number,
  columnMap?: Map<string, string>
): ParsedCSVRow;

/**
 * Overload for when called without a columnMap (rebuilds from raw keys).
 */
function normalizeRow(
  rawRow: Record<string, string>,
  rowNumber: number,
  columnMap?: Map<string, string>
): ParsedCSVRow {
  // Build a mapped version of the row using canonical field names
  const mapped: Record<string, string> = {};
  const effectiveMap = columnMap ?? normalizeColumnNames(Object.keys(rawRow));

  for (const [originalKey, value] of Object.entries(rawRow)) {
    const canonical = effectiveMap.get(originalKey);
    if (canonical) {
      mapped[canonical] = value;
    }
  }

  // Parse the amount field — handle commas, currency symbols, whitespace
  let amount: number | undefined;
  if (mapped.amount) {
    const cleaned = mapped.amount
      .replace(/[₹$,\s]/g, "") // Remove currency symbols and commas
      .trim();
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed)) {
      amount = parsed;
    }
  }

  // Parse the splitBetween field — typically a comma or semicolon separated list
  let splitBetween: string[] | undefined;
  if (mapped.splitBetween) {
    splitBetween = mapped.splitBetween
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return {
    rowNumber,
    transactionId: mapped.transactionId || undefined,
    date: mapped.date || undefined,
    description: mapped.description || undefined,
    amount,
    currency: mapped.currency?.toUpperCase() || undefined,
    paidBy: mapped.paidBy || undefined,
    splitBetween,
    splitType: mapped.splitType?.toUpperCase() || undefined,
    category: mapped.category || undefined,
    notes: mapped.notes || undefined,
    raw: rawRow,
  };
}

export { normalizeRow };
