# SplitSmart — Architectural & Design Decision Log

This document lists the critical technical and architectural decisions made during the design, implementation, and deployment of the SplitSmart Shared Expenses Manager.

---

## 1. Database Driver Adapter & Prisma 7 Migration
*   **Context**: Prisma 7 has transitioned away from implicit direct database connection management, encouraging the use of explicit database driver adapters.
*   **Options Considered**:
    1.  **Option A (Legacy)**: Use native direct Prisma Client without driver adapters (relying entirely on `DATABASE_URL` in `schema.prisma`).
    2.  **Option B (Prisma 7 PG Adapter)**: Initialize the client using `@prisma/adapter-pg` coupled with a node-postgres (`pg`) connection pool, and declare schema paths explicitly in `prisma.config.ts`.
*   **Decision**: **Option B**.
*   **Rationale**: Prisma 7 requires driver adapters to ensure consistent connection pooling and transactions. By utilizing `@prisma/adapter-pg` inside `src/lib/db.ts` and standardizing config in `prisma.config.ts`, we ensure the application compiles cleanly under the strict TypeScript check guidelines.

---

## 2. NextAuth v5 Middleware Edge Runtime Separation
*   **Context**: Next.js App Router enforces that any file matching `middleware.ts` runs in the Edge runtime. NextAuth v5 integrates with databases using adapters (e.g. Prisma), but native PostgreSQL socket drivers cannot run in the Edge runtime (throwing errors like `net`, `dns`, and `tls` modules not found).
*   **Options Considered**:
    1.  **Option A**: Import the primary `auth.ts` instance directly into the middleware, which bundles the database adapter.
    2.  **Option B**: Create a separated, Edge-compatible configuration `auth.config.ts` containing strictly route checks, providers (Credentials), and callback schemas. Bind this to `middleware.ts`, and initialize the full database adapter only inside database-dependent API routers/actions.
*   **Decision**: **Option B**.
*   **Rationale**: Setting up `auth.config.ts` separately ensures the Edge middleware checks JWT session cookies and redirects unauthenticated requests *without* importing database drivers. This resolved the login redirection loops.

---

## 3. Temporal Membership Validation (`joinedAt`/`leftAt`)
*   **Context**: Roommates or travelers frequently join or leave groups midway. Charging a member who joined late (or left early) for historical/future bills is a major data integrity issue.
*   **Options Considered**:
    1.  **Option A**: Maintain a simple binary relationship (`isActive: boolean`) between users and groups.
    2.  **Option B**: Store explicit `joinedAt` and `leftAt` timestamps on a `GroupMember` model to support multiple active membership periods.
*   **Decision**: **Option B**.
*   **Rationale**: Having explicit membership duration records allows the CSV anomaly parser and manual expense form validator to verify if a member was active in the group on the specific `expense.date`. This powers **Rule 10** and **Rule 11** in the anomaly detection engine.

---

## 4. Double-Entry Multi-Currency Logging
*   **Context**: Expenses can be logged in various currencies (e.g., USD or INR), but outstanding debts must be calculated in the group's default currency.
*   **Options Considered**:
    1.  **Option A**: Convert currencies dynamically on read (on-the-fly) by querying exchange rate records.
    2.  **Option B**: Store both the original `amount`/`currency` and the converted base-currency `convertedAmount` along with the `exchangeRate` at insertion time.
*   **Decision**: **Option B**.
*   **Rationale**: Pre-converting and saving the `convertedAmount` during creation guarantees that historical exchange rates are frozen (immutable). Even if exchange rates change later, past calculations remain accurate. This also optimizes database reads since the balance engine only has to sum the `convertedAmount` column.

---

## 5. Greedy Match Debt Simplification Algorithm
*   **Context**: A group of 5 members can easily accumulate complex, redundant debt webs (e.g., A owes B $10, B owes C $10, C owes A $10).
*   **Options Considered**:
    1.  **Option A**: Pairwise settlement tracking (repaying the exact person who paid).
    2.  **Option B**: Greedy debt simplification (recursively matching the largest debtor with the largest creditor to resolve the net balance in the minimum number of transactions).
*   **Decision**: **Option B**.
*   **Rationale**: Greedy matching reduces the transaction volume drastically (reducing $N$ transactions to a maximum of $N-1$). This is the standard expected in premium fintech applications like Splitwise.

---

## 6. Multi-Step CSV Import Wizard vs. Instant Fail
*   **Context**: Importing raw CSV sheets often introduces minor data errors (typos in names, negative numbers, overlapping duplicates).
*   **Options Considered**:
    1.  **Option A**: Fail the entire import batch immediately if any anomaly is found.
    2.  **Option B**: Build an interactive wizard: `Upload ➡️ Preview ➡️ Review Anomalies ➡️ Confirm ➡️ Done`. Expose interactive cards to let users Approve, Reject, or Edit values directly on-screen.
*   **Decision**: **Option B**.
*   **Rationale**: Option B offers a vastly superior user experience. Users can fix spelling mistakes (leveraging our Levenshtein fuzzy matching suggestions) or exclude duplicate rows on the fly without having to edit the CSV file and start over.

---

## 7. Slate/Zinc Fintech Design Language (Stripe & Linear Visuals)
*   **Context**: Default AI generation patterns tend to overuse bright gradient backgrounds, neon button borders, and floating bouncy animations, making dashboards look amateurish.
*   **Options Considered**:
    1.  **Option A**: Use glowing neon cards, animated translation transitions on hover, and multi-colored text gradients.
    2.  **Option B**: Enforce a strict slate/zinc theme with solid dark panels, fine borders (`1px border-border/85`), monochrome metric values, and tinted minimalist badges, mimicking Stripe and Linear.
*   **Decision**: **Option B**.
*   **Rationale**: Adhering to solid, high-contrast typography, flat structural grids, and low-opacity depth elements produces a professional UI/UX that looks like a high-end corporate product.
