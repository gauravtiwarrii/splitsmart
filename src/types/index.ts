// =============================================================================
// SplitSmart — TypeScript Type Definitions
// =============================================================================
// Centralised type definitions for the entire application.
// These types augment Prisma's generated types with application-specific
// interfaces for API requests/responses, balance calculations, and imports.
// =============================================================================

import type {
  User,
  Group,
  GroupMember,
  Expense,
  ExpenseSplit,
  Settlement,
  ImportSession,
  ImportAnomaly,
  ExchangeRate,
  AuditLog,
  SplitType,
  Currency,
  AnomalyType,
  AnomalySeverity,
  AnomalyResolution,
  ImportStatus,
} from "@prisma/client";

// Re-export Prisma types for convenience
export type {
  User,
  Group,
  GroupMember,
  Expense,
  ExpenseSplit,
  Settlement,
  ImportSession,
  ImportAnomaly,
  ExchangeRate,
  AuditLog,
  SplitType,
  Currency,
  AnomalyType,
  AnomalySeverity,
  AnomalyResolution,
  ImportStatus,
};

// =============================================================================
// API Request Types
// =============================================================================

/** Create a new group */
export interface CreateGroupInput {
  name: string;
  description?: string;
  currency: Currency;
}

/** Add a member to a group */
export interface AddMemberInput {
  email: string;
  role?: "ADMIN" | "MEMBER";
  joinedAt?: string; // ISO date string
}

/** Create a new expense */
export interface CreateExpenseInput {
  groupId: string;
  paidById: string;
  amount: number;
  currency: Currency;
  category: string;
  description: string;
  notes?: string;
  date: string; // ISO date string
  splitType: SplitType;
  splits: SplitInput[];
}

/** Individual split within an expense */
export interface SplitInput {
  userId: string;
  amount?: number; // For EXACT splits
  percentage?: number; // For PERCENTAGE splits
  shares?: number; // For SHARES splits
}

/** Record a settlement between two members */
export interface CreateSettlementInput {
  groupId: string;
  payerId: string;
  receiverId: string;
  amount: number;
  currency: Currency;
  notes?: string;
}

// =============================================================================
// Balance Engine Types
// =============================================================================

/**
 * Net balance for a single user within a group.
 * Positive = user is owed money (creditor)
 * Negative = user owes money (debtor)
 */
export interface UserBalance {
  userId: string;
  userName: string;
  netBalance: number; // In group's base currency
  totalPaid: number;
  totalOwed: number;
  currency: Currency;
}

/**
 * A pairwise debt relationship: 'from' owes 'to' the specified amount.
 * Used for the "who owes whom" view.
 */
export interface PairwiseBalance {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency: Currency;
}

/**
 * A simplified settlement suggestion produced by the debt simplification
 * algorithm. Minimises the number of transactions needed to settle all debts.
 */
export interface SettlementSuggestion {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
  currency: Currency;
}

/**
 * Full balance trace for audit — shows every contributing transaction
 * to a user's current balance.
 */
export interface BalanceTrace {
  userId: string;
  userName: string;
  netBalance: number;
  currency: Currency;
  contributions: BalanceContribution[];
}

/** A single contribution to a user's balance */
export interface BalanceContribution {
  type: "expense_paid" | "expense_owed" | "settlement_paid" | "settlement_received";
  id: string;
  description: string;
  amount: number;
  date: Date;
  relatedUsers: string[];
}

// =============================================================================
// CSV Import Types
// =============================================================================

/** A single parsed row from the CSV file */
export interface ParsedCSVRow {
  rowNumber: number;
  transactionId?: string;
  date?: string;
  description?: string;
  amount?: number;
  currency?: string;
  paidBy?: string;
  splitBetween?: string[];
  splitType?: string;
  splitDetails?: string; // Raw split detail string (e.g., "Rohan 700; Priya 400; Meera 400")
  category?: string;
  notes?: string;
  raw: Record<string, string>; // Original unparsed row data
}

/** Result of the anomaly detection phase */
export interface AnomalyDetectionResult {
  totalRows: number;
  cleanRows: ParsedCSVRow[];
  anomalies: DetectedAnomaly[];
  summary: AnomalySummary;
}

/** A detected anomaly with all context for user review */
export interface DetectedAnomaly {
  id: string;
  rowNumber: number;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  suggestedAction: string;
  rawData: Record<string, string>;
  field?: string;
  currentValue?: string;
  suggestedValue?: string;
}

/** Summary counts by severity */
export interface AnomalySummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  byType: Record<string, number>;
}

/** User's resolution for a detected anomaly */
export interface AnomalyResolutionInput {
  anomalyId: string;
  resolution: AnomalyResolution;
  modifiedValue?: string;
  note?: string;
}

/** Complete import report data */
export interface ImportReport {
  sessionId: string;
  filename: string;
  importedAt: Date;
  importedBy: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  anomalies: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    details: ImportReportAnomaly[];
  };
  summary: string;
}

/** Anomaly detail for the report */
export interface ImportReportAnomaly {
  rowNumber: number;
  type: string;
  severity: string;
  description: string;
  resolution: string;
  resolutionNote?: string;
}

// =============================================================================
// Dashboard Types
// =============================================================================

export interface DashboardStats {
  totalSpent: number;
  totalSettled: number;
  outstandingBalance: number;
  groupCount: number;
  currency: Currency;
}

export interface MonthlySpending {
  month: string; // "Jan 2025"
  amount: number;
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface TopSpender {
  userId: string;
  userName: string;
  totalSpent: number;
}

export interface ActivityItem {
  id: string;
  type: "expense" | "settlement" | "member_joined" | "member_left" | "import";
  title: string;
  description: string;
  amount?: number;
  currency?: Currency;
  userName: string;
  createdAt: Date;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Extended group with computed stats */
export interface GroupWithStats extends Group {
  memberCount: number;
  totalExpenses: number;
  members: (GroupMember & { user: Pick<User, "id" | "name" | "email" | "image"> })[];
}

/** Extended expense with splits and payer info */
export interface ExpenseWithDetails extends Expense {
  paidBy: Pick<User, "id" | "name" | "email">;
  splits: (ExpenseSplit & { user: Pick<User, "id" | "name" | "email"> })[];
}

/** Session info for NextAuth */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string;
}
