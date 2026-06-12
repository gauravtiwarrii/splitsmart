"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Receipt,
  Plus,
  Calendar,
  Filter,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Coins,
  ArrowRight,
  ShoppingCart,
  Utensils,
  Zap,
  Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate, getInitials, cn } from "@/lib/utils";

function getCategoryIcon(cat: string) {
  const name = cat.toLowerCase();
  if (name.includes("grocery")) return ShoppingCart;
  if (name.includes("dining") || name.includes("food") || name.includes("cake")) return Utensils;
  if (name.includes("rent") || name.includes("house") || name.includes("clean")) return Users;
  if (name.includes("utility") || name.includes("electricity") || name.includes("water") || name.includes("internet")) return Zap;
  if (name.includes("travel") || name.includes("flight") || name.includes("cab")) return Plane;
  return Receipt;
}

interface GroupBrief {
  id: string;
  name: string;
  currency: "INR" | "USD";
}

interface UserBrief {
  id: string;
  name: string;
  email: string;
}

interface Expense {
  id: string;
  amount: number;
  currency: "INR" | "USD";
  convertedAmount: number;
  exchangeRate: number;
  category: string;
  description: string;
  date: string;
  splitType: string;
  paidBy: UserBrief;
  group: GroupBrief;
  splits?: any[];
}

export default function ExpensesPage() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<GroupBrief[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalExpenses, setTotalExpenses] = useState(0);

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
    fetchExpenses();
  }, [page, selectedGroup, selectedCategory, selectedCurrency, startDate, endDate]);

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (data.success) {
        setGroups(data.data);
      }
    } catch (error) {
      console.error("Failed to load user groups", error);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let url = `/api/expenses?page=${page}&limit=15`;
      if (selectedGroup) url += `&groupId=${selectedGroup}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;
      if (selectedCurrency) url += `&currency=${selectedCurrency}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setExpenses(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalExpenses(data.pagination.total);
      } else {
        toast({
          variant: "destructive",
          title: "Error fetching expenses",
          description: data.error || "Something went wrong.",
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

  const resetFilters = () => {
    setSelectedGroup("");
    setSelectedCategory("");
    setSelectedCurrency("");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setPage(1);
  };

  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const filteredExpenses = expenses.filter((exp) =>
    exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.paidBy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Expense Logs</h1>
          <p className="text-muted-foreground text-xs">Review, filter, and audit all expense entries across your active ledgers.</p>
        </div>

        <Link href="/expenses/new">
          <Button className="bg-splitwise-teal hover:bg-splitwise-teal/90 text-white font-semibold flex items-center gap-1.5 shadow-sm text-xs px-3.5 py-1.5 rounded-lg h-9">
            <Plus size={16} />
            Log New Expense
          </Button>
        </Link>
      </div>

      {/* Advanced Filters Panel */}
      <Card className="premium-card shadow-sm border-border/80">
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <Filter size={14} className="text-splitwise-teal" />
          <CardTitle className="text-xs font-bold text-foreground">Filter Ledger Transactions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Search</label>
            <div className="flex items-center space-x-2 bg-muted/20 border border-border px-3 py-1.5 rounded-lg text-foreground">
              <Search size={12} className="text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Description, payer..."
                className="bg-transparent border-0 outline-none w-full text-xs placeholder-muted-foreground/60"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Filter Group</label>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md bg-muted/20 border border-border p-2 text-xs text-foreground focus:border-splitwise-teal outline-none"
            >
              <option value="" className="bg-card">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id} className="bg-card">{g.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md bg-muted/20 border border-border p-2 text-xs text-foreground focus:border-splitwise-teal outline-none"
            >
              <option value="" className="bg-card">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c} className="bg-card">{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Date Range</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md bg-muted/20 border border-border p-1.5 text-xs text-foreground focus:border-splitwise-teal outline-none"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md bg-muted/20 border border-border p-1.5 text-xs text-foreground focus:border-splitwise-teal outline-none"
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={resetFilters}
              className="w-full border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs py-2 h-auto"
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expenses List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-16 w-full bg-muted/40" />
          ))}
        </div>
      ) : filteredExpenses.length === 0 ? (
        <Card className="border border-dashed border-border bg-card/40 py-20 text-center flex flex-col items-center justify-center">
          <Receipt className="text-muted-foreground/40 mb-4 animate-pulse" size={48} />
          <h3 className="text-sm font-bold text-foreground">No expenses logged</h3>
          <p className="text-muted-foreground max-w-sm mt-1 mb-6 text-xs">
            {searchQuery || selectedGroup || selectedCategory || startDate || endDate
              ? "No transactions match your current filters."
              : "All groups are empty. Create a group first to log new splits."}
          </p>
          {(searchQuery || selectedGroup || selectedCategory || startDate || endDate) && (
            <Button
              onClick={resetFilters}
              className="bg-muted border border-border hover:bg-muted/80 text-foreground font-semibold"
            >
              Clear Filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 bg-card border border-border/80 rounded-xl overflow-hidden shadow-sm divide-y divide-border">
            {filteredExpenses.map((exp) => {
              const dateObj = new Date(exp.date);
              const month = dateObj.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
              const day = dateObj.getDate();
              const CatIcon = getCategoryIcon(exp.category);

              // Compute user splits details
              const mySplit = exp.splits?.find((s: any) => s.userId === currentUserId);
              const isPayer = exp.paidBy.id === currentUserId;
              
              let lentText = "";
              let lentAmount = 0;
              let lentClass = "text-muted-foreground";

              if (mySplit) {
                if (isPayer) {
                  lentAmount = exp.convertedAmount - mySplit.owedAmount;
                  lentText = lentAmount > 0.01 ? "you lent" : "you paid";
                  lentClass = "text-splitwise-green";
                } else {
                  lentAmount = mySplit.owedAmount;
                  lentText = "you borrowed";
                  lentClass = "text-splitwise-orange";
                }
              } else {
                if (isPayer) {
                  lentAmount = exp.convertedAmount;
                  lentText = "you lent";
                  lentClass = "text-splitwise-green";
                } else {
                  lentText = "not involved";
                  lentAmount = 0;
                  lentClass = "text-muted-foreground/60";
                }
              }

              return (
                <div
                  key={exp.id}
                  className="group flex flex-row items-center justify-between p-3.5 hover:bg-muted/15 transition-all duration-150 gap-4"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    {/* Left: Date Block */}
                    <div className="flex flex-col items-center justify-center bg-muted/40 border border-border/70 rounded-lg w-10 h-11 shrink-0 text-center select-none py-1">
                      <span className="text-[7px] font-bold text-muted-foreground uppercase leading-none tracking-wider">{month}</span>
                      <span className="text-sm font-extrabold text-foreground leading-none mt-0.5">{day}</span>
                    </div>

                    {/* Middle: Category Icon & Details */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/30 border border-border/80">
                      <CatIcon className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground group-hover:text-splitwise-teal transition-colors text-sm truncate">
                        {exp.description}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                        <span className="font-bold text-muted-foreground/80">Paid by {isPayer ? "you" : exp.paidBy.name}</span>
                        <span>in</span>
                        <Link href={`/groups/${exp.group.id}`} className="hover:underline text-splitwise-teal font-bold">
                          {exp.group.name}
                        </Link>
                        <span>•</span>
                        <span className="capitalize">{exp.category}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Splitwise Payer & Lending Columns */}
                  <div className="flex items-center gap-4 md:gap-6 shrink-0">
                    {/* Paid details */}
                    <div className="text-right hidden sm:block">
                      <div className="text-[10px] text-muted-foreground font-semibold">
                        {isPayer ? "you paid" : `${exp.paidBy.name} paid`}
                      </div>
                      <div className="text-xs font-bold text-foreground mt-0.5">
                        {formatCurrency(exp.amount, exp.currency)}
                      </div>
                    </div>

                    {/* Lending details */}
                    <div className="text-right min-w-[70px]">
                      <div className={cn("text-[10px] font-semibold", lentClass)}>
                        {lentText}
                      </div>
                      {lentAmount > 0 && (
                        <div className={cn("text-xs font-extrabold mt-0.5", lentClass)}>
                          {formatCurrency(lentAmount, exp.group.currency)}
                        </div>
                      )}
                    </div>

                    <Link href={`/expenses/${exp.id}`}>
                      <Button size="icon" variant="ghost" className="hover:bg-muted text-muted-foreground hover:text-splitwise-teal h-8 w-8 rounded-lg shrink-0">
                        <ArrowRight size={14} />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-900/60 pt-4 text-xs text-slate-500">
              <span>
                Showing page {page} of {totalPages} ({totalExpenses} items)
              </span>
              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page === 1}
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  className="border-slate-800 hover:bg-slate-900 disabled:opacity-30 h-7 w-7"
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page === totalPages}
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  className="border-slate-800 hover:bg-slate-900 disabled:opacity-30 h-7 w-7"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
