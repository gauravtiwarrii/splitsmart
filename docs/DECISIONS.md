# SplitSmart — Architecture & Design Decisions

This document explains the key technical decisions made during development and the rationale behind each.

---

## 1. Framework: Next.js 15 App Router

**Decision**: Use Next.js 15 with App Router instead of Pages Router.

**Rationale**:
- App Router provides better layouts, loading states, and error boundaries
- Server Components reduce client-side JavaScript bundle
- Server Actions simplify form handling
- Built-in route groups for organizing auth vs dashboard pages
- Better TypeScript support

---

## 2. Authentication: NextAuth v5 with Credentials Provider

**Decision**: Use NextAuth v5 (Auth.js) with email/password credentials, not OAuth.

**Rationale**:
- The app is a portfolio project; credentials auth is simpler to demo
- No dependency on external OAuth providers
- Seed data users can log in immediately
- JWT strategy avoids database session lookups on every request
- Split auth config: `auth.config.ts` (Edge-compatible) + `auth.ts` (Node-only with Prisma)

**Trade-off**: OAuth would provide better security in production. Can be added later.

---

## 3. Database: PostgreSQL with Prisma ORM

**Decision**: PostgreSQL via Prisma ORM instead of MongoDB or raw SQL.

**Rationale**:
- Expenses involve complex relational data (many-to-many splits, group memberships)
- Prisma provides type-safe queries that match our TypeScript-first approach
- Schema migrations are version-controlled
- PostgreSQL's ACID compliance is critical for financial data
- Neon/Supabase provide free PostgreSQL hosting for deployment

---

## 4. Membership History: joinedAt/leftAt Pattern

**Decision**: Store explicit `joinedAt` and `leftAt` dates on GroupMember instead of a simple `isActive` boolean.

**Rationale**:
- Required for CSV import anomaly detection (expenses after member left, before member joined)
- Supports the scenario where Meera left and Sam joined at specific dates
- Allows members to potentially rejoin (unique constraint on userId + groupId + joinedAt)
- Historical accuracy for balance calculations

---

## 5. Expense Storage: Dual Amount Pattern

**Decision**: Store both `amount`/`currency` (original) AND `convertedAmount`/`exchangeRate` (converted).

**Rationale**:
- Preserves original transaction data exactly as recorded
- Balance calculations always use `convertedAmount` for consistency
- Exchange rate at time of conversion is preserved for audit
- Users can see both original and converted amounts

---

## 6. Split Calculation: Pre-computed owedAmount

**Decision**: Store the computed `owedAmount` on each ExpenseSplit, regardless of split type.

**Rationale**:
- Simplifies balance engine — just sum `owedAmount` across all splits
- Avoids re-computing percentages/shares on every balance query
- The percentage/shares fields are kept for display and audit purposes
- Rounding is handled once at creation time

---

## 7. Debt Simplification: Greedy Algorithm

**Decision**: Use a greedy "highest debtor ↔ highest creditor" matching algorithm instead of optimal (NP-hard) subset-sum approach.

**Rationale**:
- Finding the absolute minimum number of transactions is NP-hard (reducible to Subset Sum)
- For small groups (4-6 people), the greedy approach produces near-optimal results
- O(N log N) time complexity vs exponential for optimal
- Splitwise also uses a similar heuristic approach
- Guarantees settlement in at most N-1 transactions

**Algorithm**:
1. Compute net balances for all members
2. Separate into creditors (+) and debtors (-)
3. Sort both by absolute amount (descending)
4. Match highest debtor with highest creditor
5. Create settlement for min(|debt|, |credit|)
6. Adjust balances, repeat until all zero

---

## 8. CSV Import: Three-Phase Architecture

**Decision**: Import follows Parse → Review → Execute workflow, never auto-importing.

**Rationale**:
- **Never silently modify data** — every issue shown to user
- Phase 1 (Parse): PapaParse reads CSV, normalises columns, detects anomalies
- Phase 2 (Review): User sees all anomalies classified by severity, approves/rejects each
- Phase 3 (Execute): Only approved rows are imported, rejected rows are skipped
- Complete audit trail of every decision

---

## 9. Anomaly Detection: 12 Independent Rules

**Decision**: Each anomaly type has its own detector function, run independently.

**Rationale**:
- Single Responsibility: each detector is focused and testable
- A row can have multiple anomalies (e.g., both duplicate AND invalid member)
- Severity is rule-specific (some are always ERROR, others WARNING)
- New rules can be added without modifying existing ones
- Each produces a standard `DetectedAnomaly` object

---

## 10. Soft Delete for Expenses

**Decision**: Expenses use an `isDeleted` flag instead of actual deletion.

**Rationale**:
- Audit trail requires historical data
- Balance trace needs to show "deleted" expenses for context
- All queries filter on `isDeleted: false`
- Can be "undeleted" if needed

---

## 11. Audit Logging: Entity + Old/New Value Pattern

**Decision**: Store audit logs with entityType, entityId, oldValue, and newValue as JSON.

**Rationale**:
- Enables "click any balance → see all contributing changes"
- JSON values capture complete state at each point
- Can query all changes for any specific entity
- User attribution for every change
- Supports compliance and dispute resolution

---

## 12. UI: Fintech-Style Dark Theme

**Decision**: Premium dark mode with emerald/teal accents, glassmorphism cards.

**Rationale**:
- Financial applications benefit from a professional, premium aesthetic
- Dark mode reduces eye strain for frequent use
- Glassmorphism creates depth without heavy visual weight
- Consistent color palette reinforces trust
- Light mode also fully supported via CSS variables and next-themes

---

## 13. Chart Library: Recharts

**Decision**: Use Recharts for all data visualizations.

**Rationale**:
- Built specifically for React
- SVG-based (crisp at any resolution)
- Good TypeScript support
- shadcn/ui's chart component is built on Recharts
- Responsive containers work well with dashboard layouts
- Gradient fills create premium visual quality

---

## 14. PDF Generation: jsPDF (Server-side)

**Decision**: Use jsPDF for PDF report generation instead of @react-pdf/renderer.

**Rationale**:
- Simpler API for tabular reports
- Works on both client and server
- No React dependency for PDF generation
- Smaller bundle size
- Sufficient for import reports (tables, text, summary)
