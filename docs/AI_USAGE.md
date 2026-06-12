# SplitSmart — AI Usage Documentation

This document details how AI was used during the development of SplitSmart, which parts were AI-generated vs human-designed, and the verification steps taken.

---

## AI Tools Used

| Tool | Version | Purpose |
|---|---|---|
| **Antigravity (Claude)** | Opus 4.6 | Primary development assistant |

---

## How AI Was Used

### 1. Architecture & Planning
- **AI-generated**: Initial project architecture, file structure, database schema design
- **Human-reviewed**: Schema normalisation decisions, API route design, algorithm selection
- **Verification**: Schema validated with `npx prisma validate`, all relations tested via seed data

### 2. Database Schema (Prisma)
- **AI-generated**: Complete schema with 10 models, enums, indexes, and relations
- **Key design decisions by AI**:
  - Dual amount pattern (original + converted) for multi-currency
  - GroupMember joinedAt/leftAt for membership history
  - JSON oldValue/newValue in AuditLog for complete traceability
- **Verification**: Migration tested, seed data validated, all relations confirmed working

### 3. Core Business Logic
- **AI-generated**: Balance engine, anomaly detector, CSV parser, currency converter, report generator
- **Most critical AI contribution**: The 12-rule anomaly detection system with severity classification
- **Algorithm choice**: Greedy debt simplification (AI recommended over NP-hard optimal based on group size analysis)
- **Verification**: Manual testing with sample CSV containing all 12 anomaly types

### 4. API Routes
- **AI-generated**: All Next.js API route handlers
- **Patterns applied by AI**: Consistent error handling, auth checks, audit logging, pagination
- **Verification**: Tested via UI and manual API calls

### 5. UI Components
- **AI-generated**: All React components, pages, and styling
- **Design system by AI**: Fintech-style dark theme, glassmorphism, gradient accents
- **Verification**: Visual inspection, responsive testing, dark/light mode toggle

### 6. CSV Import Wizard
- **AI-generated**: Complete multi-step wizard with anomaly review UI
- **Key AI decisions**:
  - Three-phase workflow (parse → review → execute)
  - Per-anomaly approve/reject/modify UX
  - PDF/JSON report generation
- **Verification**: Tested with the sample `expenses_export.csv` containing all anomaly types

---

## What AI Did NOT Do
- ❌ Did not make database hosting decisions (user chose Neon/Supabase)
- ❌ Did not create the project requirements (provided by user)
- ❌ Did not deploy the application
- ❌ Did not write automated tests (out of current scope)

---

## Verification Steps

1. **Schema Validation**: `npx prisma validate` — passed
2. **Type Checking**: `npx tsc --noEmit` — verified
3. **Build**: `npm run build` — successful
4. **Seed Data**: Database seeded with 6 users, groups, expenses, settlements
5. **CSV Import**: Sample CSV with 50 rows and 12+ anomaly types tested
6. **UI Review**: All pages verified for dark/light mode, responsive design

---

## Prompts Used

The primary development prompt specified:
- Complete feature requirements for the expense management system
- Specific anomaly types to detect in CSV import
- Tech stack constraints (Next.js 15, Prisma, NextAuth, etc.)
- Quality requirements (TypeScript, comments, clean architecture)

---

## Assessment

AI was used as a **pair programming partner** throughout development. All generated code was reviewed for:
- **Correctness**: Business logic accuracy (balance calculations, split math)
- **Security**: Proper auth checks, password hashing, input validation
- **Performance**: Database query optimisation, pagination, indexing
- **Maintainability**: Code comments, type safety, consistent patterns
