# Technical Decisions

This document outlines key technical decisions made while building SplitSmart, particularly focusing on how we handled the messy data realities of the real CSV export.

## 1. CSV Importer Architecture
**Decision**: Multi-step import (Parse → Detect → Review → Execute)
**Reasoning**: The provided `expenses_export.csv` is extremely messy (43 rows, mixed date formats, typos, missing data). A one-shot import would fail or corrupt the database. We built an orchestrator that runs 16 anomaly detectors on the parsed rows, presents them for user review, and applies fixes before touching the database.

## 2. Date Format Normalization
**Decision**: Normalize `DD/MM/YYYY`, `MMM DD` ("Mar 14") to standard ISO `YYYY-MM-DD` during the parse phase.
**Reasoning**: The real CSV mixes formats extensively. By unifying the date formats early, we prevent downstream sorting and timeline anomalies (like checking `joinedAt` and `leftAt`) from breaking.

## 3. Membership Timeline (`joinedAt` / `leftAt`)
**Decision**: Store group membership as a timeline rather than a boolean.
**Reasoning**: Sam joined in April, Meera left in March, and Dev was only present for the Goa trip (Feb–March). By tracking dates, we correctly surface `EXPENSE_AFTER_MEMBER_LEFT` and `EXPENSE_BEFORE_MEMBER_JOINED` anomalies.

## 4. Multi-Currency Support (USD & INR)
**Decision**: Store both the original currency/amount and a `convertedAmount` in the group's base currency (INR).
**Reasoning**: The Goa trip included USD expenses. To satisfy Priya's requirement ("The sheet pretends a dollar is a rupee. That can't be right."), we process USD at a configurable exchange rate, preserving the original amount for the audit log but using the converted amount for balance calculations.

## 5. Balance Algorithm
**Decision**: Greedy debt simplification.
**Reasoning**: Aisha wants "one number per person. Who pays whom, how much, done." The greedy algorithm matches the largest debtor with the largest creditor to minimize total transactions.

## 6. Debt Detail Traceability
**Decision**: Calculate individual balances before aggregating.
**Reasoning**: Rohan wants "no magic numbers." We surface exactly which expenses contributed to his total balance, allowing him to audit the app's math.

## 7. Split Types
**Decision**: Support `EQUAL`, `EXACT`, `PERCENTAGE`, and `SHARES`, with parser aliases (`unequal` → `EXACT`, `share` → `SHARES`).
**Reasoning**: The real CSV uses lowercase custom keywords. Our parser aliases these to standard internal enums, and our calculator handles all 4 math variations securely.

## 8. Identifying Settlements vs Expenses
**Decision**: Regex-based settlement detection (`paid back`, `deposit share`, `settlement`).
**Reasoning**: Rows 14 and 38 are settlements disguised as expenses. Importing them as expenses would double-count the money flow. Our anomaly detector catches them and prompts the user to convert them to actual Settlement records.
