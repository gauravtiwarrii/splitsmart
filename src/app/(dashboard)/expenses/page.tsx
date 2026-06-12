"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate, getInitials } from "@/lib/utils";

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

  const filteredExpenses = expenses.filter((exp) =>
    exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.paidBy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100 font-sans">Expense Logs</h1>
          <p className="text-slate-400 text-sm">Review, filter, and audit all expense entries across your active ledgers.</p>
        </div>

        <Link href="/expenses/new">
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold shadow-lg shadow-emerald-950/20 gap-2 transition-all hover:scale-105 duration-200">
            <Plus size={18} />
            Log New Expense
          </Button>
        </Link>
      </div>

      {/* Advanced Filters Panel */}
      <Card className="bg-slate-950/40 border-slate-900 shadow-md">
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <Filter size={16} className="text-emerald-400" />
          <CardTitle className="text-sm font-bold text-slate-200">Filter Ledger Transactions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-500 font-bold uppercase">Search</label>
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-200">
              <Search size={14} className="text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Description, payer..."
                className="bg-transparent border-0 outline-none w-full text-xs placeholder-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-500 font-bold uppercase">Filter Group</label>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md bg-slate-900 border border-slate-800 p-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-500 font-bold uppercase">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md bg-slate-900 border border-slate-800 p-2 text-xs text-slate-100 focus:border-emerald-500 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-500 font-bold uppercase">Date Range</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md bg-slate-900 border border-slate-800 p-1.5 text-xs text-slate-100 focus:border-emerald-500 outline-none"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md bg-slate-900 border border-slate-800 p-1.5 text-xs text-slate-100 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={resetFilters}
              className="w-full border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-slate-200 text-xs py-2 h-auto"
            >
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-16 w-full bg-slate-900" />
          ))}
        </div>
      ) : filteredExpenses.length === 0 ? (
        <Card className="border border-dashed border-slate-800 bg-slate-950/20 py-20 text-center flex flex-col items-center justify-center">
          <Receipt className="text-slate-700 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-200">No expenses logged</h3>
          <p className="text-slate-500 max-w-sm mt-1 mb-6 text-sm">
            {searchQuery || selectedGroup || selectedCategory || startDate || endDate
              ? "No transactions match your current filters."
              : "All groups are empty. Create a group first to log new splits."}
          </p>
          {(searchQuery || selectedGroup || selectedCategory || startDate || endDate) && (
            <Button
              onClick={resetFilters}
              className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 font-semibold"
            >
              Clear Filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {filteredExpenses.map((exp) => (
              <div
                key={exp.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-950/30 hover:bg-slate-950/70 border border-slate-900 hover:border-slate-800/80 rounded-xl transition-all duration-200 gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-lg bg-slate-900 text-emerald-400 border border-slate-800 font-bold shrink-0 text-sm">
                    {getInitials(exp.category || "Gen")}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors text-sm sm:text-base">
                      {exp.description}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-400">Paid by {exp.paidBy.name}</span>
                      <span>in</span>
                      <Link href={`/groups/${exp.group.id}`} className="hover:underline text-emerald-500 font-medium">
                        {exp.group.name}
                      </Link>
                      <span>•</span>
                      <span className="capitalize">{exp.category}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Calendar size={12} />
                        {formatDate(exp.date)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-900/60">
                  <div className="text-right">
                    <div className="font-bold text-slate-100">
                      {formatCurrency(exp.amount, exp.currency)}
                    </div>
                    {exp.currency !== exp.group.currency && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        Converted: {formatCurrency(exp.convertedAmount, exp.group.currency)}
                      </div>
                    )}
                  </div>
                  <Link href={`/expenses/${exp.id}`}>
                    <Button size="icon" variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-emerald-400 h-8 w-8 transition-colors">
                      <ArrowRight size={14} />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
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
