# Scope Document

## Project Objective
Build a full-stack Next.js web application for managing shared expenses, specifically designed to clean up and import a messy, inconsistent CSV export. The app must act as both an expense tracker and a data reconciliation tool, resolving discrepancies for four flatmates + two temporary members.

## User Requirements
1. **Aisha**: "I just want one number per person. Who pays whom, how much, done." (Needs simplified group balances)
2. **Rohan**: "No magic numbers. If the app says I owe ₹2,300, I want to see exactly which expenses make that up." (Needs detailed individual debt breakdowns)
3. **Priya**: "Half the trip was in dollars. The sheet pretends a dollar is a rupee. That can't be right." (Needs multi-currency support with exchange rates)
4. **Sam**: "I moved in mid-April. Why am I being asked to pay for electricity from March?" (Needs membership timelines and date-validation)

## Dataset Reality (`expenses_export.csv`)
The provided CSV has 43 rows, 9 columns (`date,description,paid_by,amount,currency,split_type,split_with,split_details,notes`), and contains 20+ distinct data anomalies:

1. **Duplicates**: Rows 5 and 6 are exact duplicates ("Dinner at Marina Bites" vs "dinner - marina bites"). Rows 24 and 25 have conflicting amounts for the same dinner.
2. **Format Issues**: Comma-formatted amounts (`"1,200"`), excessive precision (`899.995`), white space (` 1450 `).
3. **Date Chaos**: Mixed formats (`YYYY-MM-DD`, `DD/MM/YYYY`, `Mar 14`), ambiguous dates (`04/05/2026`), and a lack of standard ISO dates.
4. **Name Variations**: Payer names have typos (`priya`, `Priya S`, `rohan `).
5. **Missing Data**: Missing payers (Row 13), missing currency (Row 28).
6. **Settlements as Expenses**: Rows 14 ("Rohan paid Aisha back") and 38 ("Sam deposit share") are settlements logged as regular expenses.
7. **Invalid Splits**: Percentages summing to 110% (Row 15), conflicting split info (Row 42 says `equal` but provides `shares`).
8. **Invalid Members**: A non-member ("Dev's friend Kabir") in a split (Row 23).
9. **Timeline Issues**: Meera appears in a split after moving out (Row 36).
10. **Negative/Zero Amounts**: A refund of -30 USD (Row 26) and a 0 INR entry (Row 31).

## Core Features
- **Authentication**: Email/password login with NextAuth v5.
- **Group Management**: Membership timeline with `joinedAt` and `leftAt` tracking.
- **Expense Management**: Multi-currency (INR, USD) expenses with 4 split types (Equal, Exact, Percentage, Shares).
- **Import Wizard**: Multi-step CSV parser with anomaly detection, user review UI, and database import.
- **Balance Engine**: Greedy debt simplification algorithm to calculate "who owes whom".

## Out of Scope
- File attachments/receipts
- Email notifications
- Direct payment integration (e.g., Stripe, UPI)
