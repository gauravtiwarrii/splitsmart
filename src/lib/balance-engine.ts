// =============================================================================
// SplitSmart — Balance Engine
// =============================================================================
// The core financial engine of the application. All balance calculations,
// pairwise debt tracking, debt simplification, and audit tracing live here.
//
// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT BUSINESS RULES
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. **Converted Amounts Only**: All balance calculations use `convertedAmount`
//    (the amount in the group's base currency) and `owedAmount` (from splits).
//    This ensures consistent arithmetic even when expenses are in different
//    currencies. The original amounts are preserved for audit display.
//
// 2. **Soft Deletes**: Expenses with `isDeleted = true` are excluded from all
//    calculations. They are kept in the database for audit purposes only.
//
// 3. **Net Balance Formula**:
//    ```
//    netBalance = totalPaid - totalOwed - settlementsPaid + settlementsReceived
//    ```
//    - totalPaid     = sum of convertedAmount for expenses this user paid for
//    - totalOwed     = sum of owedAmount from ExpenseSplit entries for this user
//    - settlementsPaid     = sum of settlements this user initiated (paid)
//    - settlementsReceived = sum of settlements where this user is the receiver
//
//    Positive net balance → user is owed money (creditor)
//    Negative net balance → user owes money (debtor)
//
// 4. **Debt Simplification**: Uses a greedy algorithm that minimises the
//    number of transactions needed to settle all debts. This is optimal
//    for most practical cases (though not always globally optimal for
//    minimising total money transferred — that's NP-hard).
// =============================================================================

import { prisma } from "@/lib/db";
import type {
  UserBalance,
  PairwiseBalance,
  SettlementSuggestion,
  BalanceTrace,
  BalanceContribution,
  Currency,
} from "@/types";

// =============================================================================
// 1. Net Balances
// =============================================================================

/**
 * Calculates the net balance for every member in a group.
 *
 * The net balance tells you, in a single number, whether a member is
 * overall owed money (positive) or owes money (negative) within the group.
 *
 * **Algorithm:**
 *   1. Fetch all non-deleted expenses and their splits for the group.
 *   2. For each expense, credit the payer's `totalPaid` with convertedAmount.
 *   3. For each split, debit the participant's `totalOwed` with owedAmount.
 *   4. Fetch all settlements and adjust accordingly.
 *   5. Compute `netBalance = totalPaid - totalOwed - settlementsPaid + settlementsReceived`.
 *   6. Only return members who are active OR have a non-zero balance
 *      (inactive members with outstanding debts still appear).
 *
 * @param groupId - The group to calculate balances for.
 * @returns Array of UserBalance objects, one per relevant member.
 *
 * @example
 * ```ts
 * const balances = await calculateNetBalances("group_abc");
 * // [
 * //   { userId: "u1", userName: "Alice", netBalance: 500, ... },
 * //   { userId: "u2", userName: "Bob",   netBalance: -500, ... },
 * // ]
 * ```
 */
export async function calculateNetBalances(
  groupId: string
): Promise<UserBalance[]> {
  // Fetch group to get base currency
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { currency: true },
  });

  // Fetch all active + historically active members
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  // Fetch all non-deleted expenses with splits
  const expenses = await prisma.expense.findMany({
    where: { groupId, isDeleted: false },
    include: {
      splits: true,
    },
  });

  // Fetch all settlements
  const settlements = await prisma.settlement.findMany({
    where: { groupId },
  });

  // ── Build per-user accumulators ──
  const balanceMap = new Map<
    string,
    {
      userName: string;
      totalPaid: number;
      totalOwed: number;
      settlementsPaid: number;
      settlementsReceived: number;
    }
  >();

  // Initialize from member list
  for (const member of members) {
    balanceMap.set(member.userId, {
      userName: member.user.name,
      totalPaid: 0,
      totalOwed: 0,
      settlementsPaid: 0,
      settlementsReceived: 0,
    });
  }

  // ── Process expenses ──
  for (const expense of expenses) {
    // Credit the payer
    const payerEntry = balanceMap.get(expense.paidById);
    if (payerEntry) {
      payerEntry.totalPaid += expense.convertedAmount;
    } else {
      // Payer might be someone who left the group — still track their balance
      balanceMap.set(expense.paidById, {
        userName: `User ${expense.paidById}`,
        totalPaid: expense.convertedAmount,
        totalOwed: 0,
        settlementsPaid: 0,
        settlementsReceived: 0,
      });
    }

    // Debit each split participant
    for (const split of expense.splits) {
      const entry = balanceMap.get(split.userId);
      if (entry) {
        entry.totalOwed += split.owedAmount;
      } else {
        balanceMap.set(split.userId, {
          userName: `User ${split.userId}`,
          totalPaid: 0,
          totalOwed: split.owedAmount,
          settlementsPaid: 0,
          settlementsReceived: 0,
        });
      }
    }
  }

  // ── Process settlements ──
  for (const settlement of settlements) {
    const payerEntry = balanceMap.get(settlement.payerId);
    if (payerEntry) {
      payerEntry.settlementsPaid += settlement.amount;
    }

    const receiverEntry = balanceMap.get(settlement.receiverId);
    if (receiverEntry) {
      receiverEntry.settlementsReceived += settlement.amount;
    }
  }

  // ── Compute net balances and filter ──
  const activeUserIds = new Set(
    members.filter((m) => m.isActive).map((m) => m.userId)
  );

  const results: UserBalance[] = [];

  for (const [userId, data] of balanceMap) {
    const netBalance =
      data.totalPaid -
      data.totalOwed -
      data.settlementsPaid +
      data.settlementsReceived;

    // Round to avoid floating-point artifacts (e.g., 0.0000001)
    const roundedBalance = Math.round(netBalance * 100) / 100;

    // Include active members always; include inactive members only if
    // they have an outstanding balance (they still owe or are owed money)
    const isActive = activeUserIds.has(userId);
    if (isActive || Math.abs(roundedBalance) > 0.01) {
      results.push({
        userId,
        userName: data.userName,
        netBalance: roundedBalance,
        totalPaid: Math.round(data.totalPaid * 100) / 100,
        totalOwed: Math.round(data.totalOwed * 100) / 100,
        currency: group.currency,
      });
    }
  }

  // Sort by net balance descending (biggest creditor first)
  results.sort((a, b) => b.netBalance - a.netBalance);

  return results;
}

// =============================================================================
// 2. Pairwise Balances
// =============================================================================

/**
 * Calculates pairwise debt relationships: who owes whom and how much.
 *
 * Unlike net balances (which collapse everything into a single number per
 * user), pairwise balances show the directional debt between every pair
 * of users who have transacted.
 *
 * **Algorithm:**
 *   1. For each expense, the payer is owed by each split participant.
 *      → Record `participant owes payer` for the split's owedAmount.
 *      (Skip the payer's own split — you can't owe yourself.)
 *   2. For each settlement, reduce the debt from payer to receiver.
 *   3. Collapse bidirectional debts: if A owes B ₹100 and B owes A ₹40,
 *      the result is A owes B ₹60.
 *   4. Return only non-zero balances.
 *
 * @param groupId - The group to calculate pairwise balances for.
 * @returns Array of PairwiseBalance objects, each representing a directed debt.
 */
export async function calculatePairwiseBalances(
  groupId: string
): Promise<PairwiseBalance[]> {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { currency: true },
  });

  // Fetch member info for display names
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: {
      user: { select: { id: true, name: true } },
    },
  });
  const userNameMap = new Map<string, string>(
    members.map((m) => [m.userId, m.user.name])
  );

  const expenses = await prisma.expense.findMany({
    where: { groupId, isDeleted: false },
    include: { splits: true },
  });

  const settlements = await prisma.settlement.findMany({
    where: { groupId },
  });

  // ── Build directed debt ledger ──
  // Key: "debtorId:creditorId" → amount debtor owes creditor
  const debtMap = new Map<string, number>();

  const addDebt = (debtorId: string, creditorId: string, amount: number) => {
    if (debtorId === creditorId || amount === 0) return;
    const key = `${debtorId}:${creditorId}`;
    debtMap.set(key, (debtMap.get(key) ?? 0) + amount);
  };

  // Process expenses: each split participant owes the payer
  for (const expense of expenses) {
    for (const split of expense.splits) {
      // Skip self-debt (payer's own share)
      if (split.userId !== expense.paidById) {
        addDebt(split.userId, expense.paidById, split.owedAmount);
      }
    }
  }

  // Process settlements: reduce debt from payer to receiver
  for (const settlement of settlements) {
    addDebt(settlement.receiverId, settlement.payerId, -settlement.amount);
  }

  // ── Collapse bidirectional debts ──
  // If A→B = 100 and B→A = 40, result is A→B = 60
  const processedPairs = new Set<string>();
  const results: PairwiseBalance[] = [];

  for (const [key, amount] of debtMap) {
    const [fromId, toId] = key.split(":");
    const pairKey = [fromId, toId].sort().join(":");

    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    const reverseKey = `${toId}:${fromId}`;
    const reverseAmount = debtMap.get(reverseKey) ?? 0;

    const netAmount = amount - reverseAmount;
    const roundedNet = Math.round(netAmount * 100) / 100;

    if (Math.abs(roundedNet) < 0.01) continue; // Zero balance — skip

    if (roundedNet > 0) {
      // fromId owes toId
      results.push({
        fromUserId: fromId,
        fromUserName: userNameMap.get(fromId) ?? `User ${fromId}`,
        toUserId: toId,
        toUserName: userNameMap.get(toId) ?? `User ${toId}`,
        amount: roundedNet,
        currency: group.currency,
      });
    } else {
      // toId owes fromId (reverse direction)
      results.push({
        fromUserId: toId,
        fromUserName: userNameMap.get(toId) ?? `User ${toId}`,
        toUserId: fromId,
        toUserName: userNameMap.get(fromId) ?? `User ${fromId}`,
        amount: Math.abs(roundedNet),
        currency: group.currency,
      });
    }
  }

  // Sort by amount descending (largest debts first)
  results.sort((a, b) => b.amount - a.amount);

  return results;
}

// =============================================================================
// 3. Debt Simplification
// =============================================================================

/**
 * Simplifies group debts to minimise the number of settlement transactions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ALGORITHM: Greedy Debt Simplification
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **Problem:** Given N people with various debts between each other, find the
 * minimum number of transactions to settle all debts.
 *
 * **Insight:** We don't care *who* owes *whom* specifically — we only care
 * about each person's *net* position. If Alice is owed ₹100 total and Bob
 * owes ₹100 total, Bob should pay Alice regardless of who the original
 * expenses were with.
 *
 * **Steps:**
 *   1. Compute net balances for all members.
 *   2. Separate into two lists:
 *      - **Creditors**: users with positive net balance (owed money)
 *      - **Debtors**: users with negative net balance (owe money)
 *   3. Sort both lists by absolute amount (descending).
 *   4. Match the largest debtor with the largest creditor:
 *      - Settlement amount = min(|debt|, |credit|)
 *      - Subtract this amount from both parties' balances.
 *      - If either reaches zero, remove them from the list.
 *   5. Repeat until all debts are settled.
 *
 * **Complexity:** O(N log N) for sorting + O(N) for matching = O(N log N).
 *
 * **Optimality:** This greedy approach produces at most (N-1) transactions,
 * which is optimal for minimising transaction count. It may not minimise
 * the total money transferred (that's NP-hard in general), but for
 * practical group expense scenarios it works excellently.
 *
 * **Example:**
 *   Net balances: Alice +300, Bob -200, Charlie -100
 *   Step 1: Bob pays Alice 200 → Alice +100, Charlie -100
 *   Step 2: Charlie pays Alice 100 → All settled
 *   Result: 2 transactions instead of potentially more in the raw pairwise view.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @param groupId - The group to generate settlement suggestions for.
 * @returns Array of SettlementSuggestion objects representing the minimum
 *          set of transactions needed to settle all debts.
 */
export async function simplifyDebts(
  groupId: string
): Promise<SettlementSuggestion[]> {
  const balances = await calculateNetBalances(groupId);

  if (balances.length === 0) return [];

  const currency = balances[0].currency;

  // ── Step 1: Separate into creditors and debtors ──
  // Creditors have positive net balance (they are owed money)
  // Debtors have negative net balance (they owe money)
  const creditors: Array<{ id: string; name: string; amount: number }> = [];
  const debtors: Array<{ id: string; name: string; amount: number }> = [];

  for (const balance of balances) {
    if (balance.netBalance > 0.01) {
      creditors.push({
        id: balance.userId,
        name: balance.userName,
        amount: balance.netBalance,
      });
    } else if (balance.netBalance < -0.01) {
      debtors.push({
        id: balance.userId,
        name: balance.userName,
        amount: Math.abs(balance.netBalance), // Store as positive for easier math
      });
    }
    // Users with ~zero balance are already settled — skip them
  }

  // ── Step 2: Sort both lists by amount (descending) ──
  // We always match the biggest debtor with the biggest creditor.
  // This greedy strategy minimises the number of transactions.
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // ── Step 3: Greedy matching ──
  const suggestions: SettlementSuggestion[] = [];
  let ci = 0; // Creditor index
  let di = 0; // Debtor index

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    // The settlement amount is the minimum of what the debtor owes
    // and what the creditor is owed. This fully satisfies at least one side.
    const settlementAmount = Math.min(debtor.amount, creditor.amount);
    const roundedAmount = Math.round(settlementAmount * 100) / 100;

    if (roundedAmount > 0.01) {
      suggestions.push({
        from: { id: debtor.id, name: debtor.name },
        to: { id: creditor.id, name: creditor.name },
        amount: roundedAmount,
        currency,
      });
    }

    // Subtract the settled amount from both parties
    creditor.amount -= settlementAmount;
    debtor.amount -= settlementAmount;

    // Move past fully settled parties
    if (creditor.amount < 0.01) ci++;
    if (debtor.amount < 0.01) di++;
  }

  return suggestions;
}

// =============================================================================
// 4. Balance Trace (Audit Trail)
// =============================================================================

/**
 * Returns a complete trace of every expense and settlement contributing
 * to a user's current balance in a group.
 *
 * This is the backbone of the "click to trace" audit feature. When a user
 * clicks on their balance number, the UI shows this breakdown:
 *
 *   - Every expense they paid (increases their balance)
 *   - Every expense split they owe (decreases their balance)
 *   - Every settlement they made (decreases their balance)
 *   - Every settlement they received (increases their balance)
 *
 * Each contribution includes the expense description, amount, date, and
 * the other users involved — providing full traceability from the final
 * number back to the original transactions.
 *
 * @param groupId - The group to trace within.
 * @param userId  - The user whose balance to trace.
 * @returns A BalanceTrace object with every contributing transaction.
 */
export async function getBalanceTrace(
  groupId: string,
  userId: string
): Promise<BalanceTrace> {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { currency: true },
  });

  // Fetch user info
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true },
  });

  // ── Fetch expenses the user paid for ──
  const expensesPaid = await prisma.expense.findMany({
    where: {
      groupId,
      paidById: userId,
      isDeleted: false,
    },
    include: {
      splits: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // ── Fetch expense splits where the user owes money ──
  const expenseSplits = await prisma.expenseSplit.findMany({
    where: {
      userId,
      expense: {
        groupId,
        isDeleted: false,
      },
    },
    include: {
      expense: {
        select: {
          id: true,
          description: true,
          date: true,
          convertedAmount: true,
          paidById: true,
          paidBy: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: {
      expense: { date: "asc" },
    },
  });

  // ── Fetch settlements the user paid ──
  const settlementsPaid = await prisma.settlement.findMany({
    where: { groupId, payerId: userId },
    include: {
      receiver: { select: { id: true, name: true } },
    },
    orderBy: { settledAt: "asc" },
  });

  // ── Fetch settlements the user received ──
  const settlementsReceived = await prisma.settlement.findMany({
    where: { groupId, receiverId: userId },
    include: {
      payer: { select: { id: true, name: true } },
    },
    orderBy: { settledAt: "asc" },
  });

  // ── Build contribution list ──
  const contributions: BalanceContribution[] = [];

  // Expenses paid by this user (positive contribution — they advanced money)
  for (const expense of expensesPaid) {
    const otherUsers = expense.splits
      .filter((s) => s.userId !== userId)
      .map((s) => s.user.name);

    contributions.push({
      type: "expense_paid",
      id: expense.id,
      description: `Paid for "${expense.description}"`,
      amount: expense.convertedAmount,
      date: expense.date,
      relatedUsers: otherUsers,
    });
  }

  // Expense splits where this user owes (negative contribution)
  // Avoid double-counting: skip splits on expenses the user also paid
  // (the payer's own share is part of their cost, not a separate debt)
  const paidExpenseIds = new Set(expensesPaid.map((e) => e.id));

  for (const split of expenseSplits) {
    // Skip self-paid: when the user paid the expense, their own split
    // is already accounted for in the expense_paid contribution.
    // Including it separately would double-count.
    if (paidExpenseIds.has(split.expenseId)) continue;

    contributions.push({
      type: "expense_owed",
      id: split.expense.id,
      description: `Owes for "${split.expense.description}" (paid by ${split.expense.paidBy.name})`,
      amount: -split.owedAmount,
      date: split.expense.date,
      relatedUsers: [split.expense.paidBy.name],
    });
  }

  // Settlements paid by this user (negative contribution — they sent money)
  for (const settlement of settlementsPaid) {
    contributions.push({
      type: "settlement_paid",
      id: settlement.id,
      description: `Settlement paid to ${settlement.receiver.name}`,
      amount: -settlement.amount,
      date: settlement.settledAt,
      relatedUsers: [settlement.receiver.name],
    });
  }

  // Settlements received by this user (positive contribution — they got money)
  for (const settlement of settlementsReceived) {
    contributions.push({
      type: "settlement_received",
      id: settlement.id,
      description: `Settlement received from ${settlement.payer.name}`,
      amount: settlement.amount,
      date: settlement.settledAt,
      relatedUsers: [settlement.payer.name],
    });
  }

  // Sort all contributions chronologically
  contributions.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Compute net balance from contributions
  const netBalance =
    Math.round(
      contributions.reduce((sum, c) => sum + c.amount, 0) * 100
    ) / 100;

  return {
    userId: user.id,
    userName: user.name,
    netBalance,
    currency: group.currency,
    contributions,
  };
}
