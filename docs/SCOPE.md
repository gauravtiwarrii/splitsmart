# SplitSmart — Project Scope

## Project Context

Four flatmates (Aisha, Rohan, Priya, Meera) have been tracking shared expenses in a spreadsheet. Over time, the data became messy:
- Dev joined temporarily for a trip
- Meera moved out at the end of March
- Sam joined in mid-April
- The spreadsheet contains duplicates, inconsistent formats, settlements logged as expenses, and USD transactions mixed with INR

SplitSmart replaces the spreadsheet with a proper expense management system that can import the existing data while detecting and resolving all data quality issues.

---

## Feature Scope

### 1. Authentication
- [x] Sign up with email/password
- [x] Login with credentials
- [x] Logout
- [x] Protected routes via middleware
- [x] JWT-based sessions

### 2. Group Management
- [x] Create groups with name, description, currency
- [x] Add members by email
- [x] Remove members (soft delete with leave date)
- [x] Track membership history (joinedAt, leftAt)
- [x] Support changing group membership over time
- [x] Admin role for group management

### 3. Expense Management
- [x] Create expenses with all details
- [x] Edit and soft-delete expenses
- [x] Expense categories (Groceries, Utilities, Rent, Dining, Travel, etc.)
- [x] Notes field
- [x] Multi-currency support (INR, USD)
- [x] Four split types: Equal, Exact Amount, Percentage, Shares
- [x] Expense history with filtering and pagination

### 4. Balance Engine
- [x] Net balance calculation per user
- [x] Pairwise balance calculation (who owes whom)
- [x] Greedy debt simplification algorithm
- [x] One-click settlement suggestions
- [x] Settlement recording with audit trail
- [x] Balance traceability (click any balance → see contributing items)

### 5. CSV Import Module
- [x] Multi-step import wizard UI
- [x] PapaParse-based CSV parsing
- [x] Column name normalization
- [x] 12 anomaly detection rules
- [x] Severity classification (ERROR, WARNING, INFO)
- [x] User review for every anomaly
- [x] Approve/reject/modify per anomaly
- [x] Settlement-as-expense conversion
- [x] Import session tracking
- [x] Audit trail for all import decisions

### 6. Currency Conversion
- [x] INR and USD support
- [x] Store original amount and currency
- [x] Store exchange rate used
- [x] Historical exchange rate storage
- [x] Automatic conversion during import

### 7. Audit & Transparency
- [x] AuditLog table for all changes
- [x] Balance trace API
- [x] Old/new value tracking
- [x] Entity-level audit history

### 8. Dashboard
- [x] Total spent card
- [x] Monthly spending area chart
- [x] Category breakdown donut chart
- [x] Top spenders bar chart
- [x] Outstanding balances
- [x] Recent activity feed

### 9. Import Report
- [x] JSON report generation
- [x] PDF report generation (jsPDF)
- [x] Summary statistics
- [x] Anomaly detail table
- [x] Resolution status tracking
- [x] Downloadable from UI

### 10. Documentation
- [x] README.md
- [x] SCOPE.md
- [x] DECISIONS.md
- [x] AI_USAGE.md

---

## Non-Functional Requirements

### Performance
- Database queries optimised with indexes
- Pagination for list views
- Lazy loading of chart components

### Security
- Password hashing with bcrypt (12 rounds)
- JWT-based sessions with HTTP-only cookies
- Input validation with Zod
- Protected API routes
- SQL injection prevention via Prisma

### Accessibility
- Semantic HTML
- Keyboard navigation
- Screen reader support
- Sufficient colour contrast

### Maintainability
- Clean architecture with separation of concerns
- Comprehensive TypeScript types
- JSDoc comments on business logic
- Consistent coding patterns

---

## Future Enhancements (Not in Scope)
- Receipt image upload and OCR
- Push notifications
- Multiple group currencies
- Real-time exchange rate API integration
- Social login (Google, GitHub)
- Mobile native app
- Export to Excel/CSV
- Recurring expenses
- Budget limits and alerts
