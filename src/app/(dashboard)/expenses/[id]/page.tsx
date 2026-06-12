"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Coins,
  Receipt,
  User,
  Trash2,
  Users,
  ChevronRight,
  Info,
  Tag,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";

interface UserBrief {
  id: string;
  name: string;
  email: string;
}

interface Split {
  id: string;
  amount: number;
  percentage: number | null;
  shares: number | null;
  owedAmount: number;
  user: UserBrief;
}

interface GroupBrief {
  id: string;
  name: string;
  currency: "INR" | "USD";
}

interface ExpenseDetail {
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
  createdAt: string;
  paidBy: UserBrief;
  createdBy: UserBrief;
  group: GroupBrief;
  splits: Split[];
}

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const expenseId = params.id as string;

  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (expenseId) {
      fetchExpenseDetails();
    }
  }, [expenseId]);

  const fetchExpenseDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/expenses/${expenseId}`);
      const data = await res.json();
      if (data.success) {
        setExpense(data.data);
      } else {
        toast({
          variant: "destructive",
          title: "Expense not found",
          description: data.error || "Could not load transaction details.",
        });
        router.back();
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

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this expense? This will revert all associated balances.")) return;

    try {
      const res = await fetch(`/api/expenses/${expenseId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Expense deleted",
          description: "All balances have been recalculated.",
        });
        if (expense) {
          router.push(`/groups/${expense.group.id}`);
        } else {
          router.push("/groups");
        }
      } else {
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: data.error || "Could not delete expense.",
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-6 w-32 bg-slate-900" />
        <Skeleton className="h-[200px] w-full bg-slate-900" />
        <Skeleton className="h-[300px] w-full bg-slate-900" />
      </div>
    );
  }

  if (!expense) return null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto text-slate-100">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center text-slate-400 hover:text-emerald-400 transition-colors text-sm gap-2"
      >
        <ArrowLeft size={16} />
        Back to Ledger
      </button>

      {/* Main Expense Header Card */}
      <Card className="bg-slate-950/40 border-slate-900 shadow-xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/30">
                  {expense.category}
                </Badge>
                <Link href={`/groups/${expense.group.id}`} className="hover:underline">
                  <Badge variant="outline" className="text-slate-400 border-slate-800 hover:text-emerald-400 transition-colors">
                    {expense.group.name}
                  </Badge>
                </Link>
              </div>
              <CardTitle className="text-2xl sm:text-3xl font-extrabold text-slate-100">
                {expense.description}
              </CardTitle>
              <div className="flex items-center text-xs text-slate-500 gap-1">
                <Calendar size={13} />
                <span>Recorded on {formatDate(expense.date)}</span>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="text-3xl font-black text-slate-100">
                {formatCurrency(expense.amount, expense.currency)}
              </div>
              {expense.currency !== expense.group.currency && (
                <div className="text-xs text-slate-400 font-semibold mt-1">
                  Converted: {formatCurrency(expense.convertedAmount, expense.group.currency)}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 border-t border-slate-900/60 bg-slate-950/20 grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs">
              <User size={16} className="text-slate-400" />
              <div>
                <span className="text-slate-500 block">Paid By</span>
                <span className="font-semibold text-slate-200">{expense.paidBy.name} ({expense.paidBy.email})</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Coins size={16} className="text-slate-400" />
              <div>
                <span className="text-slate-500 block">Split Method</span>
                <span className="font-semibold text-slate-200 capitalize">{expense.splitType.toLowerCase()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Info size={16} className="text-slate-400" />
              <div>
                <span className="text-slate-500 block">Logged By</span>
                <span className="font-semibold text-slate-200">{expense.createdBy.name}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs flex flex-col justify-between">
            <div>
              <span className="text-slate-500 block mb-1 font-semibold">Notes / Receipt Remarks</span>
              <p className="text-slate-300 italic bg-slate-900/40 p-3 rounded-lg border border-slate-900/60">
                {expense.notes || "No notes provided for this transaction."}
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="outline"
                onClick={handleDelete}
                className="border-slate-800 hover:border-red-900/50 hover:bg-red-950/10 hover:text-red-400 text-xs px-3 font-semibold gap-1.5 py-1.5 h-auto transition-colors"
              >
                <Trash2 size={13} />
                Delete Transaction
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Split Details Breakdown Card */}
      <Card className="bg-slate-950/40 border-slate-900 shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-emerald-400" />
            <CardTitle className="text-lg font-bold text-slate-200">Split Breakdown</CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-xs">
            How the total transaction amount is distributed among ledger participants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {expense.splits.map((split) => {
            const isPayer = split.user.id === expense.paidBy.id;
            return (
              <div
                key={split.id}
                className="flex items-center justify-between p-3.5 bg-slate-900/30 border border-slate-900 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center border border-slate-900">
                    {getInitials(split.user.name)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                      {split.user.name}
                      {isPayer && (
                        <Badge className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 text-[9px] py-0 px-1 font-medium">
                          Payer
                        </Badge>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {split.percentage && `Share: ${split.percentage}%`}
                      {split.shares && `Shares: ${split.shares}`}
                      {!split.percentage && !split.shares && "Equally Split"}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-slate-100 text-sm">
                    {formatCurrency(split.amount, expense.currency)}
                  </span>
                  {expense.currency !== expense.group.currency && (
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {formatCurrency(split.owedAmount, expense.group.currency)} base
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
