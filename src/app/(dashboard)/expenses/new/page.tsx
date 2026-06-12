"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Coins,
  Receipt,
  DollarSign,
  User,
  Plus,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

interface GroupBrief {
  id: string;
  name: string;
  currency: "INR" | "USD";
}

interface Member {
  userId: string;
  isActive: boolean;
  user: {
    name: string;
    email: string;
  };
}

function NewExpenseForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const preselectedGroupId = searchParams.get("groupId") || "";

  // Lists
  const [groups, setGroups] = useState<GroupBrief[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // Form State
  const [groupId, setGroupId] = useState(preselectedGroupId);
  const [paidById, setPaidById] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [splitType, setSplitType] = useState<"EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES">("EQUAL");

  // Splits configuration
  // For EQUAL: map of userId -> boolean (checked)
  const [equalSplits, setEqualSplits] = useState<Record<string, boolean>>({});
  // For EXACT/PERCENTAGE/SHARES: map of userId -> input string value
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const categories = [
    "Groceries",
    "Rent",
    "Utilities",
    "Dining",
    "Travel",
    "Entertainment",
    "General",
  ];

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (groupId) {
      fetchGroupMembers(groupId);
    } else {
      setMembers([]);
      setPaidById("");
    }
  }, [groupId]);

  // Handle auto-checking all members when list changes
  useEffect(() => {
    if (members.length > 0) {
      const activeMembers = members.filter((m) => m.isActive);
      // Equal
      const eqMap: Record<string, boolean> = {};
      activeMembers.forEach((m) => {
        eqMap[m.userId] = true;
      });
      setEqualSplits(eqMap);

      // Inputs
      const inputMap: Record<string, string> = {};
      activeMembers.forEach((m) => {
        inputMap[m.userId] = "";
      });
      setSplitInputs(inputMap);

      // Default payer is current user or first active member
      if (activeMembers.length > 0) {
        setPaidById(activeMembers[0].userId);
      }
    }
  }, [members]);

  const fetchGroups = async () => {
    try {
      setGroupsLoading(true);
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (data.success) {
        setGroups(data.data);
        // Set currency from preselected group if available
        if (preselectedGroupId) {
          const pg = data.data.find((g: GroupBrief) => g.id === preselectedGroupId);
          if (pg) setCurrency(pg.currency);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchGroupMembers = async (gid: string) => {
    try {
      const res = await fetch(`/api/groups/${gid}`);
      const data = await res.json();
      if (data.success) {
        setMembers(data.data.members);
        // Default to group's currency
        setCurrency(data.data.currency);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const gid = e.target.value;
    setGroupId(gid);
    const selected = groups.find((g) => g.id === gid);
    if (selected) {
      setCurrency(selected.currency);
    }
  };

  // Real-time splits calculator preview
  const calculatePreview = () => {
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0 || members.length === 0) return [];

    const activeMembers = members.filter((m) => m.isActive);

    if (splitType === "EQUAL") {
      const checkedUserIds = Object.keys(equalSplits).filter((uid) => equalSplits[uid]);
      if (checkedUserIds.length === 0) return [];
      const share = numAmount / checkedUserIds.length;
      return activeMembers.map((m) => ({
        name: m.user.name,
        userId: m.userId,
        amount: equalSplits[m.userId] ? share : 0,
      }));
    }

    if (splitType === "EXACT") {
      return activeMembers.map((m) => ({
        name: m.user.name,
        userId: m.userId,
        amount: parseFloat(splitInputs[m.userId]) || 0,
      }));
    }

    if (splitType === "PERCENTAGE") {
      return activeMembers.map((m) => {
        const pct = parseFloat(splitInputs[m.userId]) || 0;
        return {
          name: m.user.name,
          userId: m.userId,
          amount: (numAmount * pct) / 100,
        };
      });
    }

    if (splitType === "SHARES") {
      const activeInputs = activeMembers.map((m) => ({
        userId: m.userId,
        shares: parseInt(splitInputs[m.userId]) || 1,
      }));
      const totalShares = activeInputs.reduce((sum, item) => sum + item.shares, 0);
      if (totalShares === 0) return [];

      return activeMembers.map((m) => {
        const shares = parseInt(splitInputs[m.userId]) || 1;
        return {
          name: m.user.name,
          userId: m.userId,
          amount: (numAmount * shares) / totalShares,
        };
      });
    }

    return [];
  };

  const preview = calculatePreview();
  const exactSum = preview.reduce((sum, item) => sum + item.amount, 0);

  const getValidationError = () => {
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) return "Amount must be greater than zero.";

    if (splitType === "EQUAL") {
      const checkedCount = Object.keys(equalSplits).filter((uid) => equalSplits[uid]).length;
      if (checkedCount === 0) return "Select at least one member to split equally.";
    }

    if (splitType === "EXACT") {
      const difference = Math.abs(numAmount - exactSum);
      if (difference > 0.05) {
        return `Exact amounts sum to ${exactSum.toFixed(2)}, which does not match total amount ${numAmount.toFixed(2)}. (Diff: ${(numAmount - exactSum).toFixed(2)})`;
      }
    }

    if (splitType === "PERCENTAGE") {
      const totalPercentage = members
        .filter((m) => m.isActive)
        .reduce((sum, m) => sum + (parseFloat(splitInputs[m.userId]) || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return `Percentages sum to ${totalPercentage.toFixed(1)}%. They must sum exactly to 100%.`;
      }
    }

    return null;
  };

  const validationError = getValidationError();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) {
      toast({ variant: "destructive", title: "Validation Error", description: "Select a group." });
      return;
    }
    if (validationError) {
      toast({ variant: "destructive", title: "Validation Error", description: validationError });
      return;
    }

    const payloadSplits = members
      .filter((m) => m.isActive)
      .map((m) => {
        if (splitType === "EQUAL") {
          return { userId: m.userId, amount: equalSplits[m.userId] ? 1 : 0 }; // Server handles equal split divisions
        }
        if (splitType === "EXACT") {
          return { userId: m.userId, amount: parseFloat(splitInputs[m.userId]) || 0 };
        }
        if (splitType === "PERCENTAGE") {
          return { userId: m.userId, percentage: parseFloat(splitInputs[m.userId]) || 0 };
        }
        if (splitType === "SHARES") {
          return { userId: m.userId, shares: parseInt(splitInputs[m.userId]) || 1 };
        }
        return { userId: m.userId };
      });

    // For EQUAL, filter splits array to only send selected participants
    const filteredPayloadSplits = splitType === "EQUAL"
      ? payloadSplits.filter((s) => s.amount! > 0).map((s) => ({ userId: s.userId }))
      : payloadSplits;

    try {
      setLoading(true);
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          paidById,
          amount: parseFloat(amount),
          currency,
          category,
          description,
          notes,
          date,
          splitType,
          splits: filteredPayloadSplits,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({ title: "Expense logged", description: "Expense transaction added." });
        router.push(`/groups/${groupId}`);
      } else {
        toast({
          variant: "destructive",
          title: "Failed to create expense",
          description: data.error || "An error occurred.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Connection error",
        description: "Failed to connect to the server.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto text-slate-100 pb-12">
      {/* Header and Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center text-slate-400 hover:text-emerald-400 transition-colors text-sm gap-2"
      >
        <ArrowLeft size={16} />
        Go Back
      </button>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 font-sans">Log Shared Expense</h1>
        <p className="text-slate-400 text-sm">Add a shared bill or payment and distribute the costs among group members.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-slate-950/40 border-slate-900 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-200">Expense Details</CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              Enter primary transaction specifics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Group */}
              <div className="space-y-2">
                <Label htmlFor="group" className="text-slate-200 text-xs">Group Ledger</Label>
                <select
                  id="group"
                  required
                  value={groupId}
                  onChange={handleGroupChange}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none"
                >
                  <option value="">Select a group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Payer */}
              <div className="space-y-2">
                <Label htmlFor="payer" className="text-slate-200 text-xs">Paid By</Label>
                <select
                  id="payer"
                  required
                  disabled={!groupId}
                  value={paidById}
                  onChange={(e) => setPaidById(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none disabled:opacity-40"
                >
                  {!groupId ? (
                    <option value="">Select group first</option>
                  ) : (
                    members
                      .filter((m) => m.isActive)
                      .map((m) => (
                        <option key={m.userId} value={m.userId}>{m.user.name}</option>
                      ))
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Amount */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="amount" className="text-slate-200 text-xs">Total Amount</Label>
                <div className="flex rounded-md bg-slate-900 border border-slate-800 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 overflow-hidden">
                  <span className="p-3 text-slate-500 text-sm font-semibold shrink-0">
                    {currency === "USD" ? "$" : "₹"}
                  </span>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-transparent border-0 outline-none w-full text-sm text-slate-100 p-2.5 pl-0"
                  />
                </div>
              </div>

              {/* Currency Selector */}
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-slate-200 text-xs">Currency</Label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "INR" | "USD")}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-200 text-xs">Description</Label>
                <Input
                  id="description"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Electricity Bill, Dinner, Groceries"
                  className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-slate-200 text-xs">Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date" className="text-slate-200 text-xs">Date of Expense</Label>
                <Input
                  id="date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-slate-200 text-xs">Notes / Remarks (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Write description notes, settlement remarks, etc."
                  className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100 min-h-[80px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Split Calculator Card */}
        {groupId && members.length > 0 && (
          <Card className="bg-slate-950/40 border-slate-900 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-200">Split Share allocations</CardTitle>
                  <CardDescription className="text-slate-500 text-xs">
                    Choose how to split the cost among group members.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Split type switcher */}
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-900 border border-slate-850 rounded-lg">
                {(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSplitType(type)}
                    className={`text-center py-2 text-xs font-semibold rounded-md transition-all ${splitType === type ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Members splits editor list */}
              <div className="space-y-3.5">
                {members
                  .filter((m) => m.isActive)
                  .map((member) => {
                    const previewShare = preview.find((item) => item.userId === member.userId)?.amount || 0;
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between gap-4 p-3 bg-slate-900/20 border border-slate-900 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          {splitType === "EQUAL" ? (
                            <input
                              type="checkbox"
                              id={`check-${member.userId}`}
                              checked={equalSplits[member.userId] ?? false}
                              onChange={(e) =>
                                setEqualSplits((prev) => ({
                                  ...prev,
                                  [member.userId]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-950"
                            />
                          ) : (
                            <div className="h-4 w-4 rounded-full border border-slate-800 bg-slate-900" />
                          )}
                          <label
                            htmlFor={`check-${member.userId}`}
                            className="font-medium text-slate-200 text-xs cursor-pointer select-none"
                          >
                            {member.user.name}
                          </label>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Inputs based on type */}
                          {splitType === "EXACT" && (
                            <div className="flex items-center rounded bg-slate-900 border border-slate-800 w-24 overflow-hidden">
                              <span className="p-1 px-2 text-slate-500 text-[10px] font-bold">
                                {currency === "USD" ? "$" : "₹"}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={splitInputs[member.userId] || ""}
                                onChange={(e) =>
                                  setSplitInputs((prev) => ({
                                    ...prev,
                                    [member.userId]: e.target.value,
                                  }))
                                }
                                placeholder="0.00"
                                className="bg-transparent border-0 outline-none w-full text-xs text-slate-100 p-1 pl-0 text-right pr-2"
                              />
                            </div>
                          )}

                          {splitType === "PERCENTAGE" && (
                            <div className="flex items-center rounded bg-slate-900 border border-slate-800 w-20 overflow-hidden">
                              <input
                                type="number"
                                step="0.1"
                                value={splitInputs[member.userId] || ""}
                                onChange={(e) =>
                                  setSplitInputs((prev) => ({
                                    ...prev,
                                    [member.userId]: e.target.value,
                                  }))
                                }
                                placeholder="0"
                                className="bg-transparent border-0 outline-none w-full text-xs text-slate-100 p-1 text-right"
                              />
                              <span className="p-1 px-1.5 text-slate-500 text-[10px] font-bold shrink-0">%</span>
                            </div>
                          )}

                          {splitType === "SHARES" && (
                            <div className="flex items-center rounded bg-slate-900 border border-slate-800 w-20 overflow-hidden">
                              <input
                                type="number"
                                step="1"
                                value={splitInputs[member.userId] || ""}
                                onChange={(e) =>
                                  setSplitInputs((prev) => ({
                                    ...prev,
                                    [member.userId]: e.target.value,
                                  }))
                                }
                                placeholder="1"
                                className="bg-transparent border-0 outline-none w-full text-xs text-slate-100 p-1 text-center"
                              />
                              <span className="p-1 px-1.5 text-slate-500 text-[10px] font-bold shrink-0">sh.</span>
                            </div>
                          )}

                          {/* Computed preview */}
                          <div className="text-right text-xs font-semibold text-slate-400 w-20 shrink-0">
                            {formatCurrency(previewShare, currency)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Error messages / totals */}
              {validationError ? (
                <div className="p-3 bg-red-950/15 border border-red-950/35 text-red-400 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              ) : (
                amount && (
                  <div className="p-3 bg-emerald-950/15 border border-emerald-950/30 text-emerald-400 rounded-lg text-xs flex items-center justify-between">
                    <span>Shares match expense total.</span>
                    <span className="font-bold">Total: {formatCurrency(parseFloat(amount), currency)}</span>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="border-slate-800 text-slate-400 hover:bg-slate-900"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !!validationError || !groupId}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold shadow-lg shadow-emerald-950/20"
          >
            {loading ? "Saving..." : "Log Expense Split"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function NewExpensePage() {
  return (
    <Suspense fallback={<div className="text-slate-400 p-8 text-center text-xs">Loading expense setup...</div>}>
      <NewExpenseForm />
    </Suspense>
  );
}
