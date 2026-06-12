"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Receipt,
  ArrowLeft,
  Plus,
  Calendar,
  Wallet,
  Coins,
  History,
  TrendingUp,
  TrendingDown,
  Trash2,
  CheckCircle,
  FileSpreadsheet,
  AlertCircle,
  Search,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface Member {
  id: string;
  userId: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
  user: UserInfo;
}

interface ExpenseSplit {
  id: string;
  userId: string;
  amount: number;
  percentage: number | null;
  shares: number | null;
  owedAmount: number;
  user: UserInfo;
}

interface Expense {
  id: string;
  amount: number;
  currency: "INR" | "USD";
  convertedAmount: number;
  exchangeRate: number;
  category: string;
  description: string;
  notes: string | null;
  date: string;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";
  isDeleted: boolean;
  paidBy: UserInfo;
  splits: ExpenseSplit[];
}

interface Settlement {
  id: string;
  amount: number;
  currency: "INR" | "USD";
  notes: string | null;
  settledAt: string;
  payer: UserInfo;
  receiver: UserInfo;
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  currency: "INR" | "USD";
  createdById: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
}

interface NetBalance {
  userId: string;
  userName: string;
  email: string;
  netBalance: number; // Positive = creditor, Negative = debtor
  totalPaid: number;
  totalOwed: number;
  settlementsPaid: number;
  settlementsReceived: number;
}

interface PairwiseBalance {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

interface SettlementSuggestion {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
}

interface BalanceTraceItem {
  id: string;
  type: "EXPENSE" | "SETTLEMENT";
  description: string;
  date: string;
  originalAmount: number;
  originalCurrency: "INR" | "USD";
  convertedAmount: number; // in group currency
  role: "PAYER" | "OWED_SPLIT" | "SETTLEMENT_PAYER" | "SETTLEMENT_RECEIVER";
  details: string;
}

interface BalanceTrace {
  userId: string;
  userName: string;
  groupCurrency: "INR" | "USD";
  netBalance: number;
  items: BalanceTraceItem[];
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Balance calculations
  const [netBalances, setNetBalances] = useState<NetBalance[]>([]);
  const [pairwiseBalances, setPairwiseBalances] = useState<PairwiseBalance[]>([]);
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);

  // Modals & Forms State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberJoinDate, setMemberJoinDate] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Settlement Form State
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settlePayer, setSettlePayer] = useState("");
  const [settleReceiver, setSettleReceiver] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [recordingSettlement, setRecordingSettlement] = useState(false);

  // Balance Trace Audit State
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [selectedTraceUser, setSelectedTraceUser] = useState<{ id: string; name: string } | null>(null);
  const [traceData, setTraceData] = useState<BalanceTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  // Filter Expenses State
  const [expenseSearch, setExpenseSearch] = useState("");

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails();
      fetchBalances();
    }
  }, [groupId]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/groups/${groupId}`);
      const data = await res.json();
      if (data.success) {
        setGroup(data.data);
      } else {
        toast({
          variant: "destructive",
          title: "Group not found",
          description: data.error || "Could not fetch details.",
        });
        router.push("/groups");
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

  const fetchBalances = async () => {
    try {
      setBalancesLoading(true);
      // Fetch full balances
      const resOverview = await fetch(`/api/balances?groupId=${groupId}`);
      const dataOverview = await resOverview.json();
      if (dataOverview.success) {
        setNetBalances(dataOverview.data.netBalances);
        setPairwiseBalances(dataOverview.data.pairwiseBalances);
      }

      // Fetch simplified debts
      const resSuggestions = await fetch(`/api/balances?groupId=${groupId}&simplified=true`);
      const dataSuggestions = await resSuggestions.json();
      if (dataSuggestions.success) {
        setSuggestions(dataSuggestions.data);
      }
    } catch (error) {
      console.error("Error loading balances:", error);
    } finally {
      setBalancesLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;

    try {
      setAddingMember(true);
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: memberEmail,
          role: memberRole,
          joinedAt: memberJoinDate || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Member added",
          description: `${data.message}`,
        });
        setIsAddMemberOpen(false);
        setMemberEmail("");
        setMemberRole("MEMBER");
        setMemberJoinDate("");
        fetchGroupDetails();
        fetchBalances();
      } else {
        toast({
          variant: "destructive",
          title: "Failed to add member",
          description: data.error || "Ensure the user has registered first.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Connection error",
        description: "Failed to connect to the server.",
      });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`Are you sure you want to mark ${name} as inactive? They will no longer be included in new splits but their historical balances remain.`)) return;

    try {
      const res = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Member removed",
          description: `${name} has been set to inactive.`,
        });
        fetchGroupDetails();
        fetchBalances();
      } else {
        toast({
          variant: "destructive",
          title: "Failed to remove member",
          description: data.error || "An error occurred.",
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense? This will revert all splits and balances.")) return;

    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Expense deleted",
          description: "The expense has been soft-deleted.",
        });
        fetchGroupDetails();
        fetchBalances();
      } else {
        toast({
          variant: "destructive",
          title: "Failed to delete",
          description: data.error || "An error occurred.",
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRecordSettlement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settlePayer || !settleReceiver || !settleAmount || parseFloat(settleAmount) <= 0) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Please check all fields are entered correctly.",
      });
      return;
    }

    try {
      setRecordingSettlement(true);
      const res = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          payerId: settlePayer,
          receiverId: settleReceiver,
          amount: parseFloat(settleAmount),
          currency: group?.currency || "INR",
          notes: settleNotes || `Settlement from member ledger`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Settlement recorded",
          description: "Expenses have been adjusted.",
        });
        setIsSettleOpen(false);
        setSettlePayer("");
        setSettleReceiver("");
        setSettleAmount("");
        setSettleNotes("");
        fetchGroupDetails();
        fetchBalances();
      } else {
        toast({
          variant: "destructive",
          title: "Settle failed",
          description: data.error || "Could not record settlement.",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setRecordingSettlement(false);
    }
  };

  const handleQuickSettle = (suggestion: SettlementSuggestion) => {
    setSettlePayer(suggestion.from.id);
    setSettleReceiver(suggestion.to.id);
    setSettleAmount(suggestion.amount.toFixed(2));
    setSettleNotes(`Simplified Debt settlement: ${suggestion.from.name} to ${suggestion.to.name}`);
    setIsSettleOpen(true);
  };

  const handleOpenTrace = async (userId: string, userName: string) => {
    setSelectedTraceUser({ id: userId, name: userName });
    setTraceData(null);
    setIsTraceOpen(true);
    try {
      setTraceLoading(true);
      const res = await fetch(`/api/balances?groupId=${groupId}&userId=${userId}&trace=true`);
      const data = await res.json();
      if (data.success) {
        setTraceData(data.data);
      } else {
        toast({
          variant: "destructive",
          title: "Trace failed",
          description: data.error || "Could not fetch audit trace.",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setTraceLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48 bg-slate-900" />
        <Skeleton className="h-24 w-full bg-slate-900" />
        <Skeleton className="h-[400px] w-full bg-slate-900" />
      </div>
    );
  }

  if (!group) return null;

  const filteredExpenses = group.expenses.filter(
    (exp) =>
      exp.description.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      exp.category.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      exp.paidBy.name.toLowerCase().includes(expenseSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link href="/groups" className="flex items-center text-slate-400 hover:text-emerald-400 transition-colors text-sm gap-2">
          <ArrowLeft size={16} />
          Back to Groups
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/import?groupId=${group.id}`}>
            <Button variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-300 gap-1.5 py-1.5 h-auto text-xs font-semibold">
              <FileSpreadsheet size={14} />
              Import CSV Wizard
            </Button>
          </Link>
          <Link href={`/expenses/new?groupId=${group.id}`}>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold gap-1 py-1.5 h-auto text-xs shadow-lg shadow-emerald-950/20">
              <Plus size={14} />
              Add Expense
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero Group Card */}
      <Card className="bg-gradient-to-br from-slate-950 to-slate-900/40 border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Users size={180} className="text-emerald-500" />
        </div>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge className="bg-emerald-950/50 text-emerald-400 border border-emerald-900/30">
                  Active Ledger
                </Badge>
                <Badge className="bg-slate-900 text-slate-400 border border-slate-800">
                  Base: {group.currency}
                </Badge>
              </div>
              <CardTitle className="text-3xl font-extrabold text-slate-100">
                {group.name}
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1 max-w-xl text-sm leading-relaxed">
                {group.description || "No description provided."}
              </CardDescription>
            </div>
            <div className="flex flex-col text-left md:text-right gap-1 bg-slate-900/50 border border-slate-800/80 px-4 py-3 rounded-lg backdrop-blur-sm">
              <span className="text-xs text-slate-500 font-medium">Group Spent Ledger</span>
              <span className="text-2xl font-bold text-slate-100">
                {formatCurrency(
                  group.expenses.reduce((acc, curr) => acc + curr.convertedAmount, 0),
                  group.currency
                )}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Tabs Panel */}
      <Tabs defaultValue="expenses" className="space-y-6">
        <TabsList className="bg-slate-950 border border-slate-900 p-1 flex justify-start space-x-1 w-full max-w-lg overflow-x-auto">
          <TabsTrigger value="expenses" className="data-[state=active]:bg-emerald-950/40 data-[state=active]:text-emerald-400 text-slate-400 font-semibold gap-1.5">
            <Receipt size={15} />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="balances" className="data-[state=active]:bg-emerald-950/40 data-[state=active]:text-emerald-400 text-slate-400 font-semibold gap-1.5">
            <Coins size={15} />
            Balances & Suggestions
          </TabsTrigger>
          <TabsTrigger value="settlements" className="data-[state=active]:bg-emerald-950/40 data-[state=active]:text-emerald-400 text-slate-400 font-semibold gap-1.5">
            <History size={15} />
            Settlements
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-emerald-950/40 data-[state=active]:text-emerald-400 text-slate-400 font-semibold gap-1.5">
            <Users size={15} />
            Members
          </TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4 outline-none">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-950/40 border border-slate-900 px-3 py-1.5 rounded-lg w-full max-w-sm">
              <Search className="text-slate-500" size={16} />
              <input
                type="text"
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                placeholder="Search description, category, payer..."
                className="bg-transparent border-0 outline-none w-full text-xs text-slate-200 placeholder-slate-500"
              />
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              Showing {filteredExpenses.length} of {group.expenses.length} expenses
            </span>
          </div>

          {filteredExpenses.length === 0 ? (
            <Card className="border border-dashed border-slate-800 bg-slate-950/20 py-16 text-center flex flex-col items-center justify-center">
              <Receipt className="text-slate-700 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-slate-200">No expenses recorded</h3>
              <p className="text-slate-500 max-w-sm mt-1 mb-6">
                Record your first expense split in this group to start tracking balances.
              </p>
              <Link href={`/expenses/new?groupId=${group.id}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold">
                  Add First Expense
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-950/30 hover:bg-slate-950/70 border border-slate-900 hover:border-slate-800/80 rounded-xl transition-all duration-200 gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-lg bg-slate-900 text-emerald-400 border border-slate-800 font-bold shrink-0">
                      {getInitials(exp.category || "Gen")}
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {exp.description}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-400">Paid by {exp.paidBy.name}</span>
                        <span>•</span>
                        <span className="capitalize">{exp.category}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Calendar size={12} />
                          {formatDate(exp.date)}
                        </span>
                        {exp.exchangeRate !== 1 && (
                          <>
                            <span>•</span>
                            <Badge variant="outline" className="text-[10px] text-slate-400 px-1 border-slate-800">
                              USD Rate: {exp.exchangeRate}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-900/60">
                    <div className="text-right">
                      <div className="font-bold text-slate-100">
                        {formatCurrency(exp.amount, exp.currency)}
                      </div>
                      {exp.currency !== group.currency && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Converted: {formatCurrency(exp.convertedAmount, group.currency)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/expenses/${exp.id}`}>
                        <Button size="icon" variant="outline" className="border-slate-800 hover:bg-slate-900 hover:text-slate-200 h-8 w-8">
                          <Info size={14} />
                        </Button>
                      </Link>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="border-slate-800 hover:border-red-900/50 hover:bg-red-950/10 hover:text-red-400 h-8 w-8 transition-colors"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances" className="space-y-6 outline-none">
          {balancesLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full bg-slate-900" />
              <Skeleton className="h-24 w-full bg-slate-900" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Net Balances Card */}
              <Card className="bg-slate-950/40 border-slate-900 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-slate-100">Net Outstanding Balances</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Positive balances are owed money. Negative balances owe money. Click any balance to audit its trace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {netBalances.length === 0 ? (
                    <div className="text-slate-500 text-center py-6 text-sm">No balances available.</div>
                  ) : (
                    netBalances.map((item) => {
                      const isCreditor = item.netBalance > 0;
                      const isZero = Math.abs(item.netBalance) < 0.01;

                      return (
                        <div
                          key={item.userId}
                          onClick={() => handleOpenTrace(item.userId, item.userName)}
                          className="flex items-center justify-between p-3 bg-slate-900/30 hover:bg-slate-900/60 border border-slate-900 hover:border-emerald-800/20 rounded-xl transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center border border-slate-900">
                              {getInitials(item.userName)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors text-sm">
                                {item.userName}
                              </div>
                              <div className="text-xs text-slate-500">{item.email}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className={`font-bold flex items-center gap-1 justify-end text-sm ${isZero ? "text-slate-400" : isCreditor ? "text-emerald-400" : "text-amber-500"}`}>
                              {!isZero && (isCreditor ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
                              {formatCurrency(item.netBalance, group.currency)}
                            </div>
                            <span className="text-[10px] text-slate-500 mt-0.5 block">Click to audit trace</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Simplified Debts suggestions */}
              <Card className="bg-slate-950/40 border-slate-900 shadow-md flex flex-col justify-between">
                <div>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-100">Simplified Settlements</CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        Suggested transactions to settle all debts with minimum transfers (Greedy Matcher).
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => {
                        setSettlePayer("");
                        setSettleReceiver("");
                        setSettleAmount("");
                        setSettleNotes("");
                        setIsSettleOpen(true);
                      }}
                      className="bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-950 text-emerald-400 font-semibold gap-1 py-1.5 h-auto text-xs"
                    >
                      <Wallet size={12} />
                      Record Settlement
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {suggestions.length === 0 ? (
                      <div className="text-slate-400 bg-emerald-950/10 border border-emerald-900/10 rounded-lg p-6 text-center text-sm flex flex-col items-center justify-center">
                        <CheckCircle className="text-emerald-400 mb-2" size={32} />
                        <span className="font-semibold text-slate-200">All settled up!</span>
                        <span className="text-xs text-slate-500 mt-1">No outstanding balances are currently owed.</span>
                      </div>
                    ) : (
                      suggestions.map((sug, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-slate-900/30 border border-slate-900 rounded-xl gap-4"
                        >
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-200">{sug.from.name}</span>
                              <span className="text-slate-500">owes</span>
                              <span className="font-semibold text-slate-200">{sug.to.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              Direct payout suggestion
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="font-bold text-emerald-400 text-sm">
                              {formatCurrency(sug.amount, group.currency)}
                            </div>
                            <Button
                              onClick={() => handleQuickSettle(sug)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold py-1 h-auto text-xs px-2.5"
                            >
                              Settle
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Settlements History Tab */}
        <TabsContent value="settlements" className="space-y-4 outline-none">
          {group.settlements.length === 0 ? (
            <Card className="border border-dashed border-slate-800 bg-slate-950/20 py-16 text-center flex flex-col items-center justify-center">
              <History className="text-slate-700 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-slate-200">No settlements logged</h3>
              <p className="text-slate-500 max-w-sm mt-1 mb-6">
                Settlements recorded between members will appear here chronologically.
              </p>
              <Button
                onClick={() => setIsSettleOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold"
              >
                Log Settlement
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {group.settlements.map((setl) => (
                <div
                  key={setl.id}
                  className="flex items-center justify-between p-4 bg-slate-950/30 border border-slate-900 rounded-xl"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-slate-900 text-emerald-400 border border-slate-800">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">
                        {setl.payer.name} paid {setl.receiver.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                        <span className="italic">"{setl.notes}"</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Calendar size={12} />
                          {formatDate(setl.settledAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-bold text-emerald-400">
                    {formatCurrency(setl.amount, setl.currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4 outline-none">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-200">Group Members Directory</h3>
            <Button
              onClick={() => setIsAddMemberOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold gap-1 py-1.5 h-auto text-xs"
            >
              <Plus size={14} />
              Add Member
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.members.map((member) => (
              <Card key={member.id} className="bg-slate-950/40 border-slate-900 flex justify-between items-center p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-800 text-sm font-bold text-slate-300 flex items-center justify-center border border-slate-900">
                    {getInitials(member.user.name)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      {member.user.name}
                      {member.role === "ADMIN" && (
                        <Badge className="bg-slate-900 text-emerald-400 border border-slate-800 text-[10px] py-0 px-1 font-semibold">
                          Admin
                        </Badge>
                      )}
                      {!member.isActive && (
                        <Badge className="bg-red-950/20 text-red-400 border border-red-950/30 text-[10px] py-0 px-1 font-semibold">
                          Left
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{member.user.email}</div>
                    <div className="text-[10px] text-slate-500 mt-1 flex flex-col gap-0.5">
                      <span>Joined: {formatDate(member.joinedAt)}</span>
                      {member.leftAt && (
                        <span className="text-red-400/80">Left: {formatDate(member.leftAt)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {member.isActive && member.role !== "ADMIN" && (
                  <Button
                    variant="outline"
                    onClick={() => handleRemoveMember(member.id, member.user.name)}
                    className="border-slate-800 hover:bg-red-950/10 hover:text-red-400 text-slate-400 text-xs py-1 h-auto px-2 transition-all"
                  >
                    Mark Left
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent className="sm:max-w-[425px] bg-slate-950 border border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-100">Add Group Member</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a roommate or friend by their email address. Make sure they have already registered!
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">Email Address</Label>
              <Input
                id="email"
                type="email"
                required
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="friend@splitsmart.app"
                className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-slate-200">Role</Label>
              <select
                id="role"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as "ADMIN" | "MEMBER")}
                className="w-full rounded-md bg-slate-900 border border-slate-800 p-2 text-sm text-slate-100 focus:border-emerald-500 outline-none"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="joinedAt" className="text-slate-200">Join Date (Optional)</Label>
              <Input
                id="joinedAt"
                type="date"
                value={memberJoinDate}
                onChange={(e) => setMemberJoinDate(e.target.value)}
                className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
              />
              <p className="text-[10px] text-slate-500">Default is today. Critical for validating expense splitting history.</p>
            </div>
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddMemberOpen(false)}
                className="border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addingMember}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold"
              >
                {addingMember ? "Adding..." : "Add to Group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Settlement Dialog */}
      <Dialog open={isSettleOpen} onOpenChange={setIsSettleOpen}>
        <DialogContent className="sm:max-w-[425px] bg-slate-950 border border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-100">Record a Settlement</DialogTitle>
            <DialogDescription className="text-slate-400">
              Log a direct cash or bank transfer payment between members to balance debts.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordSettlement} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payer" className="text-slate-200">Sender (Debtor)</Label>
                <select
                  id="payer"
                  required
                  value={settlePayer}
                  onChange={(e) => setSettlePayer(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 p-2 text-sm text-slate-100 focus:border-emerald-500 outline-none"
                >
                  <option value="">Select payer</option>
                  {group.members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiver" className="text-slate-200">Recipient (Creditor)</Label>
                <select
                  id="receiver"
                  required
                  value={settleReceiver}
                  onChange={(e) => setSettleReceiver(e.target.value)}
                  className="w-full rounded-md bg-slate-900 border border-slate-800 p-2 text-sm text-slate-100 focus:border-emerald-500 outline-none"
                >
                  <option value="">Select receiver</option>
                  {group.members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-slate-200">Amount ({group.currency})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder="0.00"
                className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-200">Notes / Method</Label>
              <Input
                id="notes"
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
                placeholder="e.g. GPay, cash, split payment"
                className="bg-slate-900 border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-100"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSettleOpen(false)}
                className="border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recordingSettlement}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold"
              >
                {recordingSettlement ? "Recording..." : "Save Settlement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Balance Trace Audit Dialog */}
      <Dialog open={isTraceOpen} onOpenChange={setIsTraceOpen}>
        <DialogContent className="max-w-xl bg-slate-950 border border-slate-800 text-slate-100 max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-100">
              Audit Trail: {selectedTraceUser?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Detailed ledger breakdown showing every transaction contributing to this user's balance.
            </DialogDescription>
          </DialogHeader>

          {traceLoading ? (
            <div className="space-y-4 py-8 flex-1 overflow-y-auto">
              <Skeleton className="h-12 w-full bg-slate-900" />
              <Skeleton className="h-12 w-full bg-slate-900" />
              <Skeleton className="h-12 w-full bg-slate-900" />
            </div>
          ) : traceData ? (
            <div className="space-y-4 flex-1 overflow-y-auto pr-1 py-4">
              {/* Header stats inside modal */}
              <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block font-medium">Net Ledger Balance</span>
                  <span className={`text-lg font-bold ${traceData.netBalance > 0 ? "text-emerald-400" : traceData.netBalance < 0 ? "text-amber-500" : "text-slate-400"}`}>
                    {formatCurrency(traceData.netBalance, traceData.groupCurrency)}
                  </span>
                </div>
                <Badge className={traceData.netBalance >= 0 ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/30" : "bg-amber-950/20 text-amber-500 border border-amber-900/30"}>
                  {traceData.netBalance >= 0 ? "Owed money" : "Owes money"}
                </Badge>
              </div>

              {/* Log Timeline */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contributing Transactions</span>
                {traceData.items.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-6">No historical splits found.</div>
                ) : (
                  traceData.items.map((item, idx) => {
                    const isExpense = item.type === "EXPENSE";
                    const isPositiveFlow =
                      (isExpense && item.role === "PAYER") ||
                      (!isExpense && item.role === "SETTLEMENT_PAYER"); // Payer in settlement reduces debt = positive flow

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-200">{item.description}</div>
                          <div className="text-slate-500 text-[10px]">
                            {formatDate(item.date)} • <span className="capitalize">{item.type.toLowerCase()}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 italic">"{item.details}"</p>
                        </div>

                        <div className="text-right shrink-0">
                          <div className={`font-bold ${isPositiveFlow ? "text-emerald-400" : "text-amber-500"}`}>
                            {isPositiveFlow ? "+" : "-"}
                            {formatCurrency(item.convertedAmount, traceData.groupCurrency)}
                          </div>
                          {item.originalCurrency !== traceData.groupCurrency && (
                            <span className="text-[9px] text-slate-500 block mt-0.5">
                              Orig: {formatCurrency(item.originalAmount, item.originalCurrency)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 py-8 text-center">Failed to load audit trace.</div>
          )}

          <DialogFooter className="pt-4 border-t border-slate-900">
            <Button
              type="button"
              onClick={() => setIsTraceOpen(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200"
            >
              Close Ledger Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
