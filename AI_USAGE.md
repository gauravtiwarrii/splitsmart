# AI Usage Documentation

As per assignment instructions, I acted as the Developer and partnered with an AI Coding Assistant (Antigravity) to rapidly architect and implement the SplitSmart application.

## High-Level Architecture & DB Design
- **Prisma Schema**: Prompted the AI to draft a schema that supports multi-currency (storing both raw amount and `convertedAmount`), timeline-based group memberships (`joinedAt`, `leftAt`), and an audit/anomaly track.
- **Why AI for this?**: Boilerplate schema generation is highly error-prone. The AI generated the `schema.prisma` file perfectly aligned with the domain requirements.

## CSV Anomaly Detection Engine
- **Initial Setup**: Supplied the AI with the CSV parsing constraints. The AI wrote the orchestrator (`detectAnomalies`) and the 16 independent rule functions.
- **The "Real vs Synthetic CSV" Discovery**: The AI initially built the app against a synthetic CSV located in the `data/` folder. Halfway through the project, the AI realized there was a different `expenses_export.csv` file in the root directory that represented the *real* assignment data, containing entirely different columns, date formats (e.g., `Mar 14`, `DD/MM/YYYY`), and edge cases (e.g., `unequal` instead of `EXACT`, comma-formatted amounts like `"1,200"`).
- **Course Correction**: The AI and I completely pivoted to handle the real CSV. We added date normalization algorithms, split type aliases (`unequal` → `EXACT`), and 4 new detectors (`ZERO_AMOUNT`, `MISSING_CURRENCY`, `AMBIGUOUS_DATE`, `CONFLICTING_SPLIT_INFO`).

## UI & Design System
- **Implementation**: Prompted the AI to use modern aesthetics (glassmorphism, clean typography). We avoided Tailwind and stuck to standard CSS/Next.js conventions for tighter control.
- **Bug Fix**: Next.js App Router caching caused the CSV import summary to be stale between runs. I instructed the AI to ensure dynamic routes were properly revalidated.

## Greedy Debt Simplification
- **The Algorithm**: Wrote the core "who owes whom" logic using the standard greedy algorithm (matching max debtor to max creditor).
- **AI's Role**: The AI refactored the logic into `balance-engine.ts` and wired it up to the API route, ensuring multi-currency conversions were correctly aggregated into the group's base currency (INR) before simplification.

## Interview Defense Readiness
I am fully prepared to defend every line of code in this repository. I directed the AI's architectural choices (e.g., separating Edge Auth from Server Auth to avoid Prisma middleware constraints, selecting the greedy algorithm for debt simplification, and pivoting the parser to handle the real CSV's unique anomalies). I understand the entire data flow from CSV upload → Parser → Anomaly Engine → Database → Balance Engine.
