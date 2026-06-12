# SplitSmart — Shared Expenses Manager

<div align="center">
  <h3>Split expenses, not friendships.</h3>
  <p>A production-ready full-stack application for tracking and managing shared expenses among groups.</p>
</div>

---

## ✨ Features

### Core
- **🔐 Authentication** — Sign up, login, logout with protected routes (NextAuth v5)
- **👥 Group Management** — Create groups, add/remove members, track membership history
- **💰 Expense Management** — Create, edit, delete expenses with 4 split types (Equal, Exact, Percentage, Shares)
- **💱 Multi-Currency** — Support for INR and USD with exchange rate tracking
- **⚖️ Balance Engine** — Individual/group balances, who-owes-whom, debt simplification
- **🤝 Settlements** — One-click settlement suggestions, settlement recording

### CSV Import (Primary Feature)
- **📤 CSV Import Wizard** — Multi-step import with drag-and-drop upload
- **🔍 12 Anomaly Detectors** — Duplicate expenses, negative amounts, settlements-as-expenses, missing payers, invalid splits, currency mismatches, duplicate transaction IDs, future dates, amount mismatches, membership violations, invalid names
- **✅ Manual Review** — Every anomaly shown to user with approve/reject/edit options
- **📊 Import Reports** — Downloadable PDF and JSON reports with full audit trail

### Dashboard & Audit
- **📈 Analytics Dashboard** — Total spending, monthly charts, category breakdown, top spenders
- **🔎 Full Audit Trail** — Every balance traceable to contributing expenses, splits, settlements
- **🌙 Dark/Light Mode** — Beautiful fintech-style UI with responsive design

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 15** | Full-stack React framework (App Router) |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Component library |
| **PostgreSQL** | Relational database |
| **Prisma ORM** | Type-safe database access |
| **NextAuth v5** | Authentication |
| **Recharts** | Data visualizations |
| **PapaParse** | CSV parsing |
| **jsPDF** | PDF report generation |
| **Zod** | Runtime validation |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or hosted via [Neon](https://neon.tech) / [Supabase](https://supabase.com))
- npm

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd splitsmart

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and AUTH_SECRET

# 4. Generate Prisma client
npx prisma generate

# 5. Run database migrations
npx prisma migrate dev --name init

# 6. Seed the database
npx prisma db seed

# 7. Start development server
npm run dev
```

### Seed Data Login
All seed users share the same password:
- **Email**: `<name>@splitsmart.app` (e.g., `aisha@splitsmart.app`)
- **Password**: `password123`

Available users: Aisha, Rohan, Priya, Meera, Dev, Sam

---

## 📁 Project Structure

```
splitsmart/
├── prisma/                    # Database schema, migrations, seed
│   ├── schema.prisma          # 10 normalized models
│   └── seed.ts                # Realistic test data
├── data/
│   └── expenses_export.csv    # Sample CSV with all anomaly types
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Login, signup pages
│   │   ├── (dashboard)/       # Protected dashboard pages
│   │   └── api/               # API routes
│   ├── components/            # Reusable UI components
│   │   ├── ui/                # Base components (shadcn-style)
│   │   ├── layout/            # Sidebar, navbar, theme
│   │   ├── charts/            # Recharts visualizations
│   │   └── import/            # CSV import wizard steps
│   ├── lib/                   # Core business logic
│   │   ├── balance-engine.ts  # Balance calculation & debt simplification
│   │   ├── anomaly-detector.ts # 12 anomaly detection rules
│   │   ├── csv-parser.ts      # CSV parsing & normalization
│   │   ├── currency.ts        # Currency conversion
│   │   ├── report-generator.ts # PDF/JSON report generation
│   │   └── validators.ts      # Zod validation schemas
│   └── types/                 # TypeScript type definitions
├── docs/                      # Documentation
└── data/                      # Sample data files
```

---

## 🔧 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `AUTH_SECRET` | NextAuth encryption secret | ✅ |
| `NEXTAUTH_URL` | Application URL | ✅ |
| `DEFAULT_USD_TO_INR_RATE` | Default exchange rate | ❌ (default: 83.5) |

---

## 📊 Database Schema

10 normalized models:
- `User` — Application users
- `Group` — Expense sharing groups
- `GroupMember` — Membership with join/leave dates
- `Expense` — Multi-currency expense records
- `ExpenseSplit` — How expenses are divided
- `Settlement` — Debt payment records
- `ImportSession` — CSV import tracking
- `ImportAnomaly` — Detected import issues
- `ExchangeRate` — Historical exchange rates
- `AuditLog` — Full change audit trail

---

## 🧪 Testing the CSV Import

1. Log in as any user
2. Navigate to **Import** in the sidebar
3. Select the "Flatmates" group
4. Upload `data/expenses_export.csv`
5. Review detected anomalies (12 different types)
6. Resolve each anomaly (approve/reject/modify)
7. Execute import
8. Download the import report (PDF/JSON)

---

## 🚢 Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Set environment variables
4. Vercel auto-detects Next.js and deploys

```bash
# Build verification
npm run build
```

---

## 📄 License

MIT
