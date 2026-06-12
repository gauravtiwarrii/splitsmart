// =============================================================================
// SplitSmart — Currency Conversion Module
// =============================================================================
// Provides currency conversion utilities for the multi-currency expense system.
//
// Strategy:
//   1. Check if a manual rate was provided (e.g., during CSV import overrides).
//   2. Query the ExchangeRate table for the closest rate on or before the given
//      date (historical accuracy).
//   3. Fall back to hardcoded DEFAULT_RATES as a last resort so the system
//      never fails on a missing rate — the user sees a warning instead.
//
// All monetary calculations use standard JavaScript numbers. For a production
// app handling large volumes, consider switching to a decimal library.
// =============================================================================

import { prisma } from "@/lib/db";
import type { Currency, ExchangeRate } from "@/types";

// =============================================================================
// Default Exchange Rates
// =============================================================================

/**
 * Hardcoded fallback rates used when no rate is found in the database.
 * Keyed as `"FROM_TO"` → rate (1 FROM = rate TO).
 *
 * These should be periodically reviewed. In production, consider fetching
 * from an external API and caching in the ExchangeRate table.
 */
export const DEFAULT_RATES: Record<string, number> = {
  INR_USD: 1 / 83.5, // 1 INR ≈ 0.01198 USD
  USD_INR: 83.5, // 1 USD ≈ 83.5 INR
  INR_INR: 1,
  USD_USD: 1,
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Converts an amount from one currency to another.
 *
 * @param amount  - The monetary amount to convert.
 * @param from    - Source currency code.
 * @param to      - Target currency code.
 * @param rate    - Optional explicit exchange rate. When provided, the
 *                  database and defaults are bypassed entirely.
 * @returns The converted amount, rounded to 2 decimal places.
 *
 * @example
 * ```ts
 * convertCurrency(1000, "INR", "USD");        // ≈ 11.98 (using default rate)
 * convertCurrency(100, "USD", "INR", 84.0);   // 8400.00 (explicit rate)
 * ```
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  rate?: number
): number {
  // Same currency — no conversion needed
  if (from === to) return amount;

  const effectiveRate = rate ?? DEFAULT_RATES[`${from}_${to}`] ?? 1;
  const converted = amount * effectiveRate;

  // Round to 2 decimal places to avoid floating-point noise
  return Math.round(converted * 100) / 100;
}

/**
 * Retrieves the exchange rate between two currencies for a given date.
 *
 * Lookup strategy:
 *   1. Query ExchangeRate table for the closest rate on or before `date`.
 *   2. If no historical rate exists, fall back to `DEFAULT_RATES`.
 *
 * @param from - Source currency code.
 * @param to   - Target currency code.
 * @param date - The date for which to look up the rate. Defaults to now.
 * @returns The exchange rate (1 unit of `from` = returned value units of `to`).
 *
 * @example
 * ```ts
 * const rate = await getExchangeRate("USD", "INR");           // latest rate
 * const rate = await getExchangeRate("USD", "INR", someDate); // historical
 * ```
 */
export async function getExchangeRate(
  from: Currency,
  to: Currency,
  date?: Date
): Promise<number> {
  // Same currency — rate is always 1
  if (from === to) return 1;

  const effectiveDate = date ?? new Date();

  try {
    // Find the most recent rate on or before the requested date.
    // This ensures we use the rate that was in effect at the time of the
    // expense, not a future rate that wasn't known yet.
    const rate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: from,
        toCurrency: to,
        effectiveDate: {
          lte: effectiveDate,
        },
      },
      orderBy: {
        effectiveDate: "desc",
      },
    });

    if (rate) {
      return rate.rate;
    }
  } catch (error) {
    // Database errors should not break the application — log and fall back
    console.error(
      `[currency] Failed to fetch exchange rate ${from}→${to}:`,
      error
    );
  }

  // Fallback to hardcoded defaults
  const fallbackKey = `${from}_${to}`;
  const fallbackRate = DEFAULT_RATES[fallbackKey];

  if (fallbackRate !== undefined) {
    return fallbackRate;
  }

  // Last resort: if even the default is missing (shouldn't happen with
  // our current INR/USD pair), return 1 and log a warning
  console.warn(
    `[currency] No exchange rate found for ${from}→${to}, returning 1`
  );
  return 1;
}

/**
 * Persists an exchange rate to the database for future lookups.
 *
 * Uses upsert semantics — if a rate for the same currency pair and date
 * already exists, it is updated rather than duplicated.
 *
 * @param from   - Source currency code.
 * @param to     - Target currency code.
 * @param rate   - The exchange rate value (1 FROM = rate TO).
 * @param source - Origin of the rate (e.g., "manual", "api", "import").
 * @param date   - The effective date for this rate. Defaults to now.
 * @returns The created or updated ExchangeRate record.
 */
export async function storeExchangeRate(
  from: Currency,
  to: Currency,
  rate: number,
  source: string = "manual",
  date?: Date
): Promise<ExchangeRate> {
  const effectiveDate = date ?? new Date();

  return prisma.exchangeRate.upsert({
    where: {
      fromCurrency_toCurrency_effectiveDate: {
        fromCurrency: from,
        toCurrency: to,
        effectiveDate,
      },
    },
    update: {
      rate,
      source,
    },
    create: {
      fromCurrency: from,
      toCurrency: to,
      rate,
      source,
      effectiveDate,
    },
  });
}
