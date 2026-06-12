// =============================================================================
// SplitSmart — Zod Validation Schemas (Zod v4)
// =============================================================================
// Centralised validation schemas for all user-facing inputs. Each schema
// mirrors a corresponding TypeScript interface in @/types and is used by
// API route handlers and server actions to validate incoming payloads.
//
// NOTE: This project uses Zod v4. Key differences from v3:
//   - `error` replaces `message`, `required_error`, `invalid_type_error`
//   - `z.email()`, `z.uuid()` etc. are top-level helpers
//   - `z.record(keySchema, valueSchema)` requires two args
// =============================================================================

import { z } from "zod";

// =============================================================================
// Shared Enums & Primitives
// =============================================================================

/** Valid currencies matching the Prisma Currency enum */
const CurrencyEnum = z.enum(["INR", "USD"], {
  error: "Currency must be either INR or USD",
});

/** Valid split types matching the Prisma SplitType enum */
const SplitTypeEnum = z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"], {
  error: "Split type must be one of: EQUAL, EXACT, PERCENTAGE, or SHARES",
});

/** Valid group roles matching the Prisma GroupRole enum */
const GroupRoleEnum = z.enum(["ADMIN", "MEMBER"], {
  error: "Role must be either ADMIN or MEMBER",
});

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

/**
 * Validates login credentials.
 * Email is normalised to lowercase; password must be at least 8 characters.
 */
export const LoginSchema = z.object({
  email: z
    .email({ error: "Please enter a valid email address" })
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string({ error: "Password is required" })
    .min(1, { error: "Password is required" }),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Validates sign-up data. Enforces minimum password length and requires
 * a display name for the user profile.
 */
export const SignupSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(2, { error: "Name must be at least 2 characters" })
    .max(100, { error: "Name must be at most 100 characters" })
    .transform((v) => v.trim()),
  email: z
    .email({ error: "Please enter a valid email address" })
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string({ error: "Password is required" })
    .min(8, { error: "Password must be at least 8 characters" })
    .max(128, { error: "Password must be at most 128 characters" }),
});
export type SignupInput = z.infer<typeof SignupSchema>;

// =============================================================================
// GROUP SCHEMAS
// =============================================================================

/**
 * Validates input for creating a new expense group.
 * Group name is trimmed; description is optional.
 */
export const CreateGroupSchema = z.object({
  name: z
    .string({ error: "Group name is required" })
    .min(1, { error: "Group name cannot be empty" })
    .max(100, { error: "Group name must be at most 100 characters" })
    .transform((v) => v.trim()),
  description: z
    .string()
    .max(500, { error: "Description must be at most 500 characters" })
    .optional(),
  currency: CurrencyEnum,
});
export type CreateGroupSchemaInput = z.infer<typeof CreateGroupSchema>;

/**
 * Validates input for updating an existing group. All fields are optional
 * (partial update), but if provided they must pass the same constraints
 * as the creation schema.
 */
export const UpdateGroupSchema = z.object({
  name: z
    .string()
    .min(1, { error: "Group name cannot be empty" })
    .max(100, { error: "Group name must be at most 100 characters" })
    .transform((v) => v.trim())
    .optional(),
  description: z
    .string()
    .max(500, { error: "Description must be at most 500 characters" })
    .nullable()
    .optional(),
  currency: CurrencyEnum.optional(),
});
export type UpdateGroupSchemaInput = z.infer<typeof UpdateGroupSchema>;

// =============================================================================
// MEMBER SCHEMA
// =============================================================================

/**
 * Validates input for adding a member to a group.
 * The member is identified by email. An optional role can be assigned
 * (defaults to MEMBER on the server side).
 */
export const AddMemberSchema = z.object({
  email: z
    .email({ error: "Please enter a valid email address" })
    .transform((v) => v.toLowerCase().trim()),
  role: GroupRoleEnum.optional(),
  joinedAt: z.iso.datetime({ error: "joinedAt must be a valid ISO 8601 date string" }).optional(),
});
export type AddMemberSchemaInput = z.infer<typeof AddMemberSchema>;

// =============================================================================
// EXPENSE SCHEMAS
// =============================================================================

/** Schema for an individual split entry within an expense */
const SplitInputSchema = z.object({
  userId: z.string({ error: "User ID is required for each split" }).min(1),
  amount: z.number().nonnegative({ error: "Split amount cannot be negative" }).optional(),
  percentage: z
    .number()
    .min(0, { error: "Percentage cannot be negative" })
    .max(100, { error: "Percentage cannot exceed 100" })
    .optional(),
  shares: z
    .number()
    .int({ error: "Shares must be a whole number" })
    .positive({ error: "Shares must be positive" })
    .optional(),
});

/**
 * Validates input for creating a new expense.
 *
 * Business Rules:
 * - At least one split must be provided.
 * - For EXACT splits: the sum of individual amounts must equal the total.
 * - For PERCENTAGE splits: percentages must sum to 100 (±1% tolerance for
 *   floating-point rounding).
 * - For SHARES splits: every split entry must include a shares value.
 * - For EQUAL splits: no amount/percentage/shares required — the server
 *   calculates equal portions.
 *
 * @see superRefine block below for cross-field validation logic.
 */
export const CreateExpenseSchema = z
  .object({
    groupId: z.string({ error: "Group ID is required" }).min(1),
    paidById: z.string({ error: "Payer ID is required" }).min(1),
    amount: z
      .number({ error: "Amount must be a number" })
      .positive({ error: "Amount must be greater than zero" }),
    currency: CurrencyEnum,
    category: z
      .string()
      .max(50, { error: "Category must be at most 50 characters" })
      .default("General"),
    description: z
      .string({ error: "Description is required" })
      .min(1, { error: "Description cannot be empty" })
      .max(200, { error: "Description must be at most 200 characters" }),
    notes: z
      .string()
      .max(500, { error: "Notes must be at most 500 characters" })
      .optional(),
    date: z.iso.datetime({ error: "Date must be a valid ISO 8601 date string" }),
    splitType: SplitTypeEnum,
    splits: z
      .array(SplitInputSchema)
      .min(1, { error: "At least one split is required" }),
  })
  .superRefine((data, ctx) => {
    const { splitType, splits, amount } = data;

    // ------------------------------------------------------------------
    // EXACT: each split must have an `amount` and their sum must match
    // the total expense amount (within a small rounding tolerance).
    // ------------------------------------------------------------------
    if (splitType === "EXACT") {
      const missingAmounts = splits.filter((s) => s.amount === undefined);
      if (missingAmounts.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["splits"],
          message: "Every split must have an amount for EXACT split type",
        });
        return;
      }

      const splitSum = splits.reduce((sum, s) => sum + (s.amount ?? 0), 0);
      const tolerance = 0.01;
      if (Math.abs(splitSum - amount) > tolerance) {
        ctx.addIssue({
          code: "custom",
          path: ["splits"],
          message: `Split amounts sum to ${splitSum.toFixed(2)} but expense total is ${amount.toFixed(2)}. They must be equal.`,
        });
      }
    }

    // ------------------------------------------------------------------
    // PERCENTAGE: each split must have a `percentage` and their sum must
    // be 100% (±1% tolerance for floating-point rounding artefacts).
    // ------------------------------------------------------------------
    if (splitType === "PERCENTAGE") {
      const missingPcts = splits.filter((s) => s.percentage === undefined);
      if (missingPcts.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["splits"],
          message:
            "Every split must have a percentage for PERCENTAGE split type",
        });
        return;
      }

      const percentSum = splits.reduce(
        (sum, s) => sum + (s.percentage ?? 0),
        0
      );
      if (Math.abs(percentSum - 100) > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["splits"],
          message: `Percentages sum to ${percentSum.toFixed(1)}% — they must total 100%.`,
        });
      }
    }

    // ------------------------------------------------------------------
    // SHARES: each split must have a positive integer `shares` value.
    // ------------------------------------------------------------------
    if (splitType === "SHARES") {
      const missingShares = splits.filter((s) => s.shares === undefined);
      if (missingShares.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["splits"],
          message: "Every split must have a shares value for SHARES split type",
        });
      }
    }

    // ------------------------------------------------------------------
    // Check for duplicate user IDs in splits (a user cannot appear twice
    // in the same expense).
    // ------------------------------------------------------------------
    const userIds = splits.map((s) => s.userId);
    const uniqueUserIds = new Set(userIds);
    if (uniqueUserIds.size !== userIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: "Duplicate user IDs found in splits — each user can only appear once per expense",
      });
    }
  });
export type CreateExpenseSchemaInput = z.infer<typeof CreateExpenseSchema>;

// =============================================================================
// SETTLEMENT SCHEMA
// =============================================================================

/**
 * Validates input for recording a debt settlement between two members.
 * Ensures payer and receiver are different users.
 */
export const CreateSettlementSchema = z
  .object({
    groupId: z.string({ error: "Group ID is required" }).min(1),
    payerId: z.string({ error: "Payer ID is required" }).min(1),
    receiverId: z.string({ error: "Receiver ID is required" }).min(1),
    amount: z
      .number({ error: "Amount must be a number" })
      .positive({ error: "Settlement amount must be greater than zero" }),
    currency: CurrencyEnum,
    notes: z
      .string()
      .max(500, { error: "Notes must be at most 500 characters" })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.payerId === data.receiverId) {
      ctx.addIssue({
        code: "custom",
        path: ["receiverId"],
        message: "Payer and receiver must be different users",
      });
    }
  });
export type CreateSettlementSchemaInput = z.infer<
  typeof CreateSettlementSchema
>;

// =============================================================================
// CSV IMPORT SCHEMA
// =============================================================================

/**
 * Validates CSV import metadata. The actual CSV content is parsed separately
 * by the csv-parser module — this schema validates the surrounding request.
 */
export const ImportCSVSchema = z.object({
  groupId: z.string({ error: "Group ID is required" }).min(1),
  filename: z
    .string({ error: "Filename is required" })
    .min(1, { error: "Filename cannot be empty" })
    .refine(
      (name) => name.toLowerCase().endsWith(".csv"),
      { message: "File must be a .csv file" }
    ),
});
export type ImportCSVSchemaInput = z.infer<typeof ImportCSVSchema>;
