# SplitSmart — Shared Expenses Manager

SplitSmart is a premium, corporate-grade shared expenses manager designed with a clean, stable fintech user interface modeled after Stripe and Linear. It helps flatmates, travelers, and project teams log expenses, split bills flexibly, detect anomalies in CSV spreadsheets, and settle debts automatically using a greedy simplification algorithm.

🚀 **GitHub Repository**: [github.com/gauravtiwarrii/splitsmart](https://github.com/gauravtiwarrii/splitsmart)  
🌐 **Live Application**: [assignment-cyan-five.vercel.app](https://assignment-cyan-five.vercel.app)

---

## 🛠️ Technology Stack

* **Framework**: Next.js 16 (App Router, Turbopack, React 19)
* **Language**: TypeScript
* **Database & ORM**: PostgreSQL + Prisma ORM (Prisma 7 Adapter architecture)
* **Authentication**: NextAuth (Auth.js v5 Beta) with Credentials provider
* **Styling**: Tailwind CSS v4 + custom HSL design tokens (frosted glass, fine borders, responsive transitions)
* **Data Visualization**: Recharts (responsive spending area charts, category breakdowns, spender bars)
* **File Utilities**: PapaParse (CSV parser) + jsPDF (PDF invoice/report generator)

---

## ✨ Core Features

1. **Authentication & Protection**
   * Secure registration, login, and sessions using NextAuth v5.
   * Route protection enforced at the Edge runtime using Next.js Middleware (cookie-based session validation).
2. **Flexible Splits**
   * Equal splits, exact splits, percentages (totaling 100%), and shares (custom ratios).
   * Supports active and inactive timelines (roommates only pay for expenses logged during their active duration).
3. **Multi-Currency Converter**
   * Support for **INR (₹)** and **USD ($)** with live rate mappings and historical overrides.
4. **Greedy Debt Simplification**
   * Minimizes the total number of transactions required to settle balances within a group. Matches the highest debtor with the highest creditor recursively.
5. **CSV Import Wizard**
   * Stepper-based workflow: Upload ➡️ Map Columns ➡️ Review Anomalies ➡️ Confirm ➡️ PDF Summary.
   * Runs **12 anomaly detection rules** (duplicates, invalid splits, transactions outside member active dates, fuzzy spelling checks using Levenshtein distance).
6. **Immutable Audit Logs**
   * Chronological ledger of all system edits (CREATE, UPDATE, DELETE, SETTLE, IMPORT) tracking JSON diff changes (`oldValue` vs `newValue`).

---

## 📂 Project Structure

```text
assignment/
├── prisma/
│   ├── schema.prisma       # Database models (User, Group, Expense, etc.)
│   └── seed.ts             # Seeding script with mock data
├── src/
│   ├── app/
│   │   ├── (auth)/         # Login / Signup forms
│   │   ├── (dashboard)/    # Main dashboard, groups, expenses, import wizard, audits
│   │   ├── api/            # REST API endpoints (audits, import, groups, balances)
│   │   ├── globals.css     # Design system, theme variables, custom card tokens
│   │   └── layout.tsx      # Main layout wrapped in NextAuth SessionProvider
│   ├── components/
│   │   ├── charts/         # Area charts, Donut charts, Bar charts using Recharts
│   │   ├── layout/         # Sidebar, collapsible Navbar
│   │   └── ui/             # Premium shadcn-style component wrappers (Button, Card, etc.)
│   ├── lib/
│   │   ├── anomaly-detector.ts # 12 anomaly rules core
│   │   ├── balance-engine.ts   # Debt calculation & greedy simplifier
│   │   ├── currency.ts         # Currency rates & converters
│   │   ├── db.ts               # PrismaPg database pool adapter
│   │   ├── report-generator.ts # PDF & JSON report generators
│   │   ├── validators.ts       # Zod schemas
│   │   └── auth.ts             # NextAuth configuration
│   └── middleware.ts       # Edge middleware session checks
├── DEPLOYMENT.md           # Live production hosting instructions (Vercel)
└── package.json            # Script targets and dependencies
```

---

## 💾 Database Schema

The PostgreSQL schema contains the following relational models:
* `User`: Profiles with names, emails, and hashed passwords.
* `Group`: Expense ledgers created by users.
* `GroupMember`: Maps user memberships with `joinedAt`, `leftAt`, and role details.
* `Expense`: Logs payments specifying descriptions, currency conversions, and payees.
* `ExpenseSplit`: Tracks individual shares owed by each group member per expense.
* `Settlement`: Records direct payouts between debtors and creditors.
* `ExchangeRate`: Stores currency exchange histories.
* `ImportSession` & `ImportAnomaly`: Tracks CSV uploads, audit trails, and skipped/overridden rows.
* `AuditLog`: System change diffs tracking record revisions.

---

## 🚀 Local Setup & Development

### 1. Prerequisites
Ensure you have **Node.js 18+** and **PostgreSQL** installed and running.

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/splitsmart?schema=public"
AUTH_SECRET="splitsmart-dev-secret-key-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
DEFAULT_USD_TO_INR_RATE="83.5"
```
*Note: Adjust database credentials (`postgres:root` to your local PostgreSQL setup).*

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup
Push the schema to your local PostgreSQL instance and seed mock data:
```bash
# Push database structure
npx prisma db push

# Generate Prisma client
npx prisma generate

# Populate database
npx prisma db seed
```

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Test Login Credentials

All seed accounts share the password **`password123`**:

| User | Email | Role in "Flatmates" Group | Timeline |
| :--- | :--- | :--- | :--- |
| **Aisha** | `aisha@splitsmart.app` | Admin (Creator) | Active since Jan 1, 2025 |
| **Rohan** | `rohan@splitsmart.app` | Member | Active since Jan 1, 2025 |
| **Priya** | `priya@splitsmart.app` | Member | Active since Jan 1, 2025 |
| **Meera** | `meera@splitsmart.app` | Member | Active Jan 1 – Mar 31, 2025 (Left) |
| **Dev** | `dev@splitsmart.app` | Member | Active Mar 12 – Mar 16, 2025 (Trip member) |
| **Sam** | `sam@splitsmart.app` | Member | Active since Apr 15, 2025 (Joined late) |

---

## ☁️ Production Deployment

The project is hosted live on **Vercel** with a serverless **Neon PostgreSQL** database.

* **Live Deployment URL**: [assignment-cyan-five.vercel.app](https://assignment-cyan-five.vercel.app)
* **Hosting Platform**: Vercel
* **Database Provider**: Neon (Serverless Postgres)

For detailed instructions on configuring your own deployment pipeline or database instances, please refer to the [DEPLOYMENT.md](DEPLOYMENT.md) file.

---

## 🤖 AI Tools Used

This project was built with the assistance of **Antigravity**, an agentic AI coding assistant designed by **Google DeepMind**. Antigravity co-authored the business logic engine, designed the premium fintech UI, resolved Edge middleware compatibility constraints, and configured the live Vercel and Neon PostgreSQL cloud integration.

For full details on AI usage, key prompts, and concrete cases where the AI produced incorrect output, see [AI_USAGE.md](AI_USAGE.md).

