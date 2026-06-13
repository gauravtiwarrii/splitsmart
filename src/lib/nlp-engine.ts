/**
 * NLP Engine: Local Heuristic Natural Language Parser for SplitSmart
 * Parses sentences like: "Raj paid 1200 for Dominos and Aisha and Priya share it"
 */

import { naiveBayesCategorize } from "./ml-engine";

export interface ParsedIntent {
  amount: number | null;
  payer: string | null;
  description: string | null;
  category: string;
  confidence: number;
  participants: string[];
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";
}

export function parseExpenseIntent(text: string): ParsedIntent {
  const normalizedText = text.toLowerCase();
  
  // 1. Extract Amount (e.g., "1200", "$50", "₹1,200", "50 bucks")
  let amount: number | null = null;
  const amountRegex = /(?:₹|\$|rs|inr|usd)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:bucks|rs|inr|usd)?/;
  const amountMatch = normalizedText.match(amountRegex);
  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  }

  // 2. Extract Payer (e.g., "Raj paid", "Paid by Aisha")
  let payer: string | null = null;
  const payerMatch1 = normalizedText.match(/([a-z]+)\s+paid/);
  const payerMatch2 = normalizedText.match(/paid\s+by\s+([a-z]+)/);
  if (payerMatch1) payer = capitalize(payerMatch1[1]);
  else if (payerMatch2) payer = capitalize(payerMatch2[1]);

  // 3. Extract Participants (e.g., "Aisha, Priya and Sam")
  const participants: string[] = [];
  const knownNames = ["aisha", "rohan", "priya", "meera", "sam", "dev", "raj", "kabir"]; // Ideally fetched from DB
  for (const name of knownNames) {
    if (normalizedText.includes(name) && capitalize(name) !== payer) {
      participants.push(capitalize(name));
    }
  }

  // 4. Extract Split Type (heuristic based on keywords)
  let splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES" = "EQUAL";
  if (normalizedText.includes("percent") || normalizedText.includes("%")) {
    splitType = "PERCENTAGE";
  } else if (normalizedText.includes("share") || normalizedText.includes("parts")) {
    splitType = "SHARES";
  } else if (normalizedText.includes("exact") || normalizedText.includes("unequal")) {
    splitType = "EXACT";
  }

  // 5. Extract Description (heuristic: words after "for" or "on")
  let description: string | null = null;
  const descMatch = text.match(/(?:for|on)\s+([A-Za-z\s0-9']+?)(?:\s+(?:and|with|split|paid|to)|$)/i);
  if (descMatch && descMatch[1]) {
    description = descMatch[1].trim();
  }

  // 6. ML Categorization
  const { category, confidence } = naiveBayesCategorize(description || text);

  return {
    amount,
    payer,
    description,
    category,
    confidence,
    participants,
    splitType
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
