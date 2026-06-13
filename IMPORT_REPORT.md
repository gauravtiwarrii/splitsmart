# Import Pipeline Report

## Overview
The provided `expenses_export.csv` data file is heavily polluted with inconsistencies, manual overrides, and typos. Standard one-shot imports would fail immediately or corrupt the ledger. We designed an orchestrator and 16 detector rules to parse, flag, and help the user resolve these issues safely.

## Data Characteristics (Real CSV)
- **Total Rows**: 43 (1 header, 42 data rows)
- **Timeframe**: Feb 2026 – Apr 2026
- **Currencies**: INR, USD
- **Members**: Aisha, Rohan, Priya, Meera (left Mar 31), Dev (visited Feb/Mar), Sam (joined Apr 8).

## Detected Anomalies & Resolutions

| # | Anomaly Type | Occurrences | Resolution Strategy |
|:---|:---|:---|:---|
| 1 | `DUPLICATE_EXPENSE` | 2 | Flags exact duplicates (e.g. Marina Bites dinner). User reviews and deletes one. |
| 2 | `FORMAT_ISSUES` | 3 | Addressed entirely in the parsing layer (`1,200` stripped, whitespace trimmed, floating point math rounded). |
| 3 | `AMBIGUOUS_DATE` | 1 | "04/05/2026" flagged for manual confirmation. |
| 4 | `INVALID_MEMBER_NAME` | 3 | Identifies typos (`priya`, `Priya S`, `rohan `). Levenshtein fuzzy matching suggests the correct user. |
| 5 | `MISSING_PAYER` | 1 | Row 13 has no `paid_by`. Hard blocker (ERROR level). User must select a payer to import. |
| 6 | `MISSING_CURRENCY` | 1 | Row 28 has empty currency. Defaults to INR but warns user. |
| 7 | `SETTLEMENT_AS_EXPENSE` | 2 | Rows 14 and 38 flagged. Approving the anomaly routes the data to the `Settlement` table instead of the `Expense` table. |
| 8 | `INVALID_SPLIT` | 1 | Row 15 (Percentages sum to 110%) flagged. User must adjust percentages. |
| 9 | `CONFLICTING_SPLIT_INFO`| 1 | Row 42 claims `equal` but provides shares in `split_details`. User prompted to change split type to `SHARES`. |
| 10| `EXPENSE_AFTER_MEMBER_LEFT`| 1 | Meera included in April Groceries (she left in March). User must remove her from the split. |
| 11| `NEGATIVE_AMOUNT` | 1 | -30 USD refund. Suggested action: convert to absolute value or discard. |
| 12| `ZERO_AMOUNT` | 1 | 0 INR entry. Suggested action: provide amount or discard. |

## Import Flow Experience
1. User uploads the `expenses_export.csv`.
2. The parsing engine standardizes dates (e.g., converting "Mar 14" to "2026-03-14") and aliases split types (`unequal` → `EXACT`).
3. The orchestrator runs all 16 detectors.
4. The user is presented with a Review screen where ERRORs must be fixed, and WARNINGs can be approved or modified.
5. The Execution phase maps the final data to `Expense`, `ExpenseSplit`, or `Settlement` tables appropriately.
