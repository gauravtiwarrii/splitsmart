# SplitSmart — CSV Import Report

This report summarizes the results of importing the CSV expense export sheet into the **Flatmates** group. It lists all data anomalies detected by our 12-rule parser engine and the resolution actions taken by the administrator.

---

## 📈 Session Summary

*   **File Name**: `expenses_export.csv`
*   **Import Group**: `Flatmates`
*   **Base Currency**: `INR (₹)`
*   **Triggered By**: `Aisha` (Group Administrator)
*   **Execution Time**: June 12, 2026 — 21:14 UTC
*   **Status**: `COMPLETED`

### 📊 Import Statistics

| Metric | Count | Details |
| :--- | :--- | :--- |
| **Total Rows Processed** | 52 | Total spreadsheet entries. |
| **Imported Successfully** | 48 | Appended to the ledger. |
| **Skipped / Excluded** | 4 | Dropped due to errors or redundancies. |
| **Anomalies Detected** | 15 | Anomalous items flagged for verification. |
| **Auto-Resolved** | 2 | Auto-converted currencies. |
| **Manual / Approved Fixes** | 9 | Adjusted by user in the wizard. |

---

## ⚠️ Anomaly Audit Log & Resolution Actions

The table below lists every anomaly flagged by the system, its severity, type, and the exact resolution action taken during the wizard stage:

| Row | Transaction ID | Field | Anomaly Type | Severity | Description | Resolution / Action Taken |
| :---: | :--- | :--- | :--- | :---: | :--- | :--- |
| **12** | `TXN001` | `description` | `DUPLICATE_EXPENSE` | 🟡 **WARNING** | Row 12 is a duplicate of Row 2 (same description, amount, date, paidBy). | **REJECTED**: Row was skipped and excluded from import to prevent double-billing. |
| **12** | `TXN001` | `transactionId` | `DUPLICATE_TRANSACTION_ID` | 🟡 **WARNING** | Transaction ID `TXN001` already appeared in Row 2. | **REJECTED**: Auto-excluded along with the duplicate row. |
| **16** | `TXN014` | `description` | `SETTLEMENT_AS_EXPENSE` | 🟡 **WARNING** | Description "Settlement - Rohan to Priya" looks like a payback, not a shared expense. | **APPROVED**: Converted to a proper Settlement record in the database rather than an Expense. |
| **22** | `TXN020` | `currency` | `CURRENCY_MISMATCH` | 🔵 **INFO** | Transaction in `USD` differs from group base currency `INR`. | **AUTO_RESOLVED**: Exchange rate converter applied (USD/INR @ `83.5`), logging $2,500 USD as ₹2,08,750 INR. |
| **23** | `TXN021` | `amount` | `NEGATIVE_AMOUNT` | 🔴 **ERROR** | Negative amount detected (`-500`) for "Cab to Airport". | **APPROVED**: Converted amount to absolute positive value (`500`) as verified by the user. |
| **26** | `TXN024` | `description` | `SETTLEMENT_AS_EXPENSE` | 🟡 **WARNING** | Description "Settlement - Meera to Aisha" looks like a payback, not a shared expense. | **APPROVED**: Converted to a proper Settlement record in the database. |
| **30** | `TXN028` | `date` | `EXPENSE_AFTER_MEMBER_LEFT` | 🟡 **WARNING** | Expense date `2025-04-10` is after "Meera" left the group (`2025-03-31`). | **MODIFIED**: Removed Meera from the split; divided the internet bill equally among remaining members (Aisha, Rohan, Priya). |
| **31** | `TXN029` | `paidBy` | `MISSING_PAYER` | 🔴 **ERROR** | Paid by field is empty for "Amazon Prime Subscription". | **MODIFIED**: Manually mapped to "Aisha" who verified she paid for the subscription. |
| **37** | `TXN035` | `splitType` | `INVALID_SPLIT` | 🟡 **WARNING** | Percentage splits sum to `110%` instead of `100%` for "Groceries Special". | **MODIFIED**: Re-split the percentages equally among active members to total 100%. |
| **40** | `TXN038` | `paidBy` | `INVALID_MEMBER_NAME` | 🟡 **WARNING** | Payer name "Rohaan" is not a group member. | **APPROVED**: Accepted fuzzy suggestion (Levenshtein distance 1) mapping "Rohaan" ➡️ "Rohan". |
| **41** | `TXN039` | `currency` | `CURRENCY_MISMATCH` | 🔵 **INFO** | Transaction in `USD` differs from group base currency `INR`. | **AUTO_RESOLVED**: Converted using current rate (USD/INR @ `83.5`), logging $49.99 USD as ₹4,174.17 INR. |
| **42** | `TXN040` | `description` | `SETTLEMENT_AS_EXPENSE` | 🟡 **WARNING** | Description "Paid back Aisha for course" looks like a payback, not a shared expense. | **APPROVED**: Recorded as a USD-to-INR converted Settlement record in the database. |
| **45** | `TXN043` | `date` | `FUTURE_DATE` | 🟡 **WARNING** | Expense date `2025-12-25` is in the future. | **APPROVED**: Allowed import since it was a pre-dated booking transaction for Christmas party. |
| **47** | `TXN036` | `amount` | `AMOUNT_MISMATCH` | 🔴 **ERROR** | Same Transaction ID `TXN036` has amount `48500` here but `48000` in Row 38. | **REJECTED**: Skipped the conflicting row. Rent remains recorded as ₹48,000 INR from Row 38. |
| **49** | `TXN046` | `paidBy` | `INVALID_MEMBER_NAME` | 🔴 **ERROR** | Payer "Dev" is no longer a member of the group on `2025-05-25` (left `2025-03-16`). | **REJECTED**: Row skipped. Dev had already checked out of the flat and could not be billed. |
| **50** | `TXN047` | `date` | `EXPENSE_BEFORE_MEMBER_JOINED` | 🟡 **WARNING** | Expense date `2025-03-01` is before "Sam" joined the group (`2025-04-15`). | **MODIFIED**: Removed Sam from the bill split; split only among members who were active in March. |

---

## 🛡️ Database Verification Log

After completing the import resolutions:
1. **Expenses Table**: Created 44 new records in the `expenses` table.
2. **Expense Splits**: Populated 140 participant debt splits in the `expense_splits` table.
3. **Settlements Table**: Recorded 4 repayments in the `settlements` table.
4. **Audit Logs Table**: Appended 48 `CREATE`/`IMPORT` entries with complete database change logs in the `audit_logs` table.
