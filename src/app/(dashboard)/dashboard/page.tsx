"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SpendingAreaChart } from "@/components/charts/spending-area-chart";
import { CategoryDonutChart } from "@/components/charts/category-donut-chart";
import { TopSpendersBarChart } from "@/components/charts/top-spenders-bar-chart";
import { formatCurrency, formatRelativeTime, getInitials, getCategoryColor, cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ArrowLeftRight,
  Receipt,
  ShoppingCart,
  Utensils,
  Zap,
  Plane,
  Plus,
  CheckCircle,
} from "lucide-react";

/* ============================================================================
   Fallback Mock Data
   ============================================================================ */

const mockStats = {
  totalSpent: 245800,
  outstandingBalance: 12450,
  groupCount: 5,
  totalSettled: 23,
};

const fallbackMonthlySpending = [
  { month: "Jan", amount: 18500 },
  { month: "Feb", amount: 22300 },
  { month: "Mar", amount: 19800 },
  { month: "Apr", amount: 25600 },
  { month: "May", amount: 21200 },
  { month: "Jun", amount: 28900 },
  { month: "Jul", amount: 24500 },
  { month: "Aug", amount: 31200 },
  { month: "Sep", amount: 27800 },
  { month: "Oct", amount: 29400 },
  { month: "Nov", amount: 33100 },
  { month: "Dec", amount: 24580 },
];

const fallbackCategorySpending = [
  { category: "Groceries", amount: 45200, percentage: 28 },
  { category: "Dining", amount: 32100, percentage: 20 },
  { category: "Rent", amount: 28000, percentage: 17 },
  { category: "Utilities", amount: 18500, percentage: 11 },
  { category: "Travel", amount: 15800, percentage: 10 },
  { category: "Entertainment", amount: 12400, percentage: 8 },
  { category: "Shopping", amount: 9800, percentage: 6 },
];

const fallbackTopSpenders = [
  { userId: "1", userName: "Aisha", totalSpent: 68500 },
  { userId: "2", userName: "Raj", totalSpent: 52300 },
  { userId: "3", userName: "Priya", totalSpent: 45800 },
  { userId: "4", userName: "Vikram", totalSpent: 41200 },
  { userId: "5", userName: "Sneha", totalSpent: 38000 },
];

const fallbackRecentActivity = [
  {
    id: "1",
    type: "expense" as const,
    title: "Grocery Shopping",
    description: "Big Bazaar weekly groceries",
    amount: 3450,
    userName: "Aisha Khan",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    icon: ShoppingCart,
  },
  {
    id: "2",
    type: "settlement" as const,
    title: "Settlement",
    description: "Raj settled with Aisha",
    amount: 2200,
    userName: "Raj Patel",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    icon: ArrowLeftRight,
  },
  {
    id: "3",
    type: "expense" as const,
    title: "Dinner at Olive Garden",
    description: "Team dinner for 6",
    amount: 5800,
    userName: "Priya Sharma",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    icon: Utensils,
  },
  {
    id: "4",
    type: "expense" as const,
    title: "Electricity Bill",
    description: "March 2025 bill",
    amount: 2100,
    userName: "Vikram Singh",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    icon: Zap,
  },
  {
    id: "5",
    type: "expense" as const,
    title: "Goa Trip Tickets",
    description: "Flight tickets for 4",
    amount: 24000,
    userName: "Sneha Gupta",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    icon: Plane,
  },
];

/* ============================================================================
   Dashboard Page Component
   ============================================================================ */

export default function DashboardPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const [balances, setBalances] = React.useState<any>(null);
  const [balancesLoading, setBalancesLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    async function loadBalances() {
      try {
        const res = await fetch("/api/balances?groupId=flatmates-group");
        const json = await res.json();
        if (json.success && json.data) {
          setBalances(json.data);
        }
      } catch (err) {
        console.error("Failed to load balances:", err);
      } finally {
        setBalancesLoading(false);
      }
    }

    loadDashboard();
    loadBalances();
  }, []);

  // Compute stats metrics
  const stats = React.useMemo(() => {
    const apiStats = data?.stats;
    const isMock = !apiStats || apiStats.groupCount === 0;

    return {
      totalSpent: isMock ? mockStats.totalSpent : apiStats.totalSpent,
      totalSettled: isMock ? mockStats.totalSettled : apiStats.totalSettled,
      groupCount: isMock ? mockStats.groupCount : apiStats.groupCount,
    };
  }, [data]);

  // Compute Owe / Owed balances dynamic calculations
  const { youOwe, youAreOwed, youOweList, youAreOwedList } = React.useMemo(() => {
    if (balancesLoading || !balances?.pairwiseBalances || !currentUserId) {
      // Fallback mock balances
      const oweList = [
        { toUserName: "Priya Sharma", amount: 2800 },
        { toUserName: "Sneha Gupta", amount: 1950 },
      ];
      const owedList = [
        { fromUserName: "Raj Patel", amount: 4500 },
        { fromUserName: "Vikram Singh", amount: 3200 },
      ];
      return {
        youOwe: 4750,
        youAreOwed: 7700,
        youOweList: oweList,
        youAreOwedList: owedList,
      };
    }

    const oweList: any[] = [];
    const owedList: any[] = [];
    let oweSum = 0;
    let owedSum = 0;

    balances.pairwiseBalances.forEach((pb: any) => {
      if (pb.fromUserId === currentUserId) {
        oweSum += pb.amount;
        oweList.push({ toUserName: pb.toUserName, amount: pb.amount });
      } else if (pb.toUserId === currentUserId) {
        owedSum += pb.amount;
        owedList.push({ fromUserName: pb.fromUserName, amount: pb.amount });
      }
    });

    return {
      youOwe: oweSum,
      youAreOwed: owedSum,
      youOweList: oweList,
      youAreOwedList: owedList,
    };
  }, [balances, balancesLoading, currentUserId]);

  const totalBalance = youAreOwed - youOwe;

  // Compute charts and lists data
  const monthlySpending = React.useMemo(() => {
    if (data?.monthlySpending && data.monthlySpending.length > 0) {
      return data.monthlySpending;
    }
    return fallbackMonthlySpending;
  }, [data]);

  const categorySpending = React.useMemo(() => {
    if (data?.categoryBreakdown && data.categoryBreakdown.length > 0) {
      return data.categoryBreakdown.map((c: any) => ({
        ...c,
        color: getCategoryColor(c.category),
      }));
    }
    return fallbackCategorySpending.map(c => ({
      ...c,
      color: getCategoryColor(c.category),
    }));
  }, [data]);

  const spendersData = React.useMemo(() => {
    if (data?.topSpenders && data.topSpenders.length > 0) {
      return data.topSpenders;
    }
    return fallbackTopSpenders;
  }, [data]);

  const recentActivity = React.useMemo(() => {
    if (data?.recentActivity && data.recentActivity.length > 0) {
      return data.recentActivity.map((act: any) => {
        let icon = Receipt;
        if (act.type === "settlement") {
          icon = ArrowLeftRight;
        } else if (act.title.toLowerCase().includes("grocery")) {
          icon = ShoppingCart;
        } else if (act.title.toLowerCase().includes("dinner") || act.title.toLowerCase().includes("food")) {
          icon = Utensils;
        }
        return {
          ...act,
          icon,
          createdAt: new Date(act.createdAt),
        };
      });
    }
    return fallbackRecentActivity;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* ---------- Splitwise Title Header ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Welcome back, {session?.user?.name || "User"}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/expenses/new">
            <Button className="bg-splitwise-teal hover:bg-splitwise-teal/90 text-white font-semibold flex items-center gap-1.5 shadow-sm text-xs px-3.5 py-1.5 rounded-lg h-9">
              <Plus className="h-4 w-4" />
              Add an expense
            </Button>
          </Link>
          <Link href="/settlements">
            <Button className="bg-splitwise-orange hover:bg-splitwise-orange/90 text-white font-semibold flex items-center gap-1.5 shadow-sm text-xs px-3.5 py-1.5 rounded-lg h-9">
              <CheckCircle className="h-4 w-4" />
              Settle up
            </Button>
          </Link>
        </div>
      </div>

      {/* ---------- Splitwise Balance Summary Widget ---------- */}
      <div className="grid grid-cols-3 border border-border/80 rounded-xl bg-card p-3 md:p-4 text-center divide-x divide-border shadow-sm">
        <div className="flex flex-col justify-center py-1">
          <span className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Balance</span>
          <span className={cn(
            "text-sm md:text-base font-bold mt-0.5",
            totalBalance > 0.01 ? "text-splitwise-green" : (totalBalance < -0.01 ? "text-splitwise-orange" : "text-muted-foreground/60")
          )}>
            {totalBalance > 0.01 ? "+" : ""}{formatCurrency(totalBalance)}
          </span>
        </div>
        <div className="flex flex-col justify-center py-1">
          <span className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground tracking-wider">You Owe</span>
          <span className={cn(
            "text-sm md:text-base font-bold mt-0.5",
            youOwe > 0.01 ? "text-splitwise-orange" : "text-muted-foreground/60"
          )}>
            {formatCurrency(youOwe)}
          </span>
        </div>
        <div className="flex flex-col justify-center py-1">
          <span className="text-[9px] md:text-[10px] uppercase font-bold text-muted-foreground tracking-wider">You Are Owed</span>
          <span className={cn(
            "text-sm md:text-base font-bold mt-0.5",
            youAreOwed > 0.01 ? "text-splitwise-green" : "text-muted-foreground/60"
          )}>
            {formatCurrency(youAreOwed)}
          </span>
        </div>
      </div>

      {/* ---------- Splitwise Owe / Owed Columns ---------- */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* YOU OWE */}
        <Card className="premium-card shadow-sm border-border/80">
          <CardHeader className="py-3.5 border-b border-border bg-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-splitwise-orange flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4" />
              You Owe
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {balancesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg bg-muted/40" />
                <Skeleton className="h-10 w-full rounded-lg bg-muted/40" />
              </div>
            ) : youOweList.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground">You do not owe anything! 🎉</p>
              </div>
            ) : (
              <div className="space-y-3">
                {youOweList.map((item, idx) => (
                  <div
                    key={`${item.toUserName}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 border">
                        <AvatarFallback className="text-[9px] bg-secondary text-secondary-foreground font-bold">
                          {getInitials(item.toUserName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="text-xs font-semibold">{item.toUserName}</span>
                        <p className="text-[10px] text-muted-foreground">you owe them</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-splitwise-orange">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* YOU ARE OWED */}
        <Card className="premium-card shadow-sm border-border/80">
          <CardHeader className="py-3.5 border-b border-border bg-muted/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-splitwise-green flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              You Are Owed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {balancesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg bg-muted/40" />
                <Skeleton className="h-10 w-full rounded-lg bg-muted/40" />
              </div>
            ) : youAreOwedList.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground">No one owes you money yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {youAreOwedList.map((item, idx) => (
                  <div
                    key={`${item.fromUserName}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-7 w-7 border">
                        <AvatarFallback className="text-[9px] bg-secondary text-secondary-foreground font-bold">
                          {getInitials(item.fromUserName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="text-xs font-semibold">{item.fromUserName}</span>
                        <p className="text-[10px] text-muted-foreground">owes you</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-splitwise-green">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- Recharts Row ---------- */}
      <div className="grid gap-5 lg:grid-cols-7">
        {/* Monthly Spending */}
        <Card className="lg:col-span-4 premium-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Monthly Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[240px] w-full bg-muted/40 rounded-lg" />
            ) : (
              <SpendingAreaChart data={monthlySpending} />
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="lg:col-span-3 premium-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[240px]">
                <Skeleton className="h-36 w-36 rounded-full bg-muted/40" />
              </div>
            ) : (
              <CategoryDonutChart data={categorySpending} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- Spenders & Activity ---------- */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Top Spenders */}
        <Card className="premium-card shadow-sm">
          <CardHeader className="py-3.5 border-b border-border bg-muted/10">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Top Spenders
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full bg-muted/40 rounded-lg" />
                ))}
              </div>
            ) : (
              <TopSpendersBarChart data={spendersData} />
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="premium-card shadow-sm">
          <CardHeader className="py-3.5 border-b border-border bg-muted/10">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg bg-muted/40 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4 bg-muted/40" />
                      <Skeleton className="h-3 w-1/2 bg-muted/40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {recentActivity.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3.5 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/30 border border-border/85 transition-all duration-300">
                      <item.icon className="h-4.5 w-4.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                        {item.amount && (
                          <span className="text-xs font-bold tracking-tight text-foreground whitespace-nowrap">
                            {formatCurrency(item.amount)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-muted-foreground truncate">
                          {item.userName}
                        </p>
                        <span className="text-[10px] text-muted-foreground/40 font-bold">·</span>
                        <p className="text-[10px] text-muted-foreground/80 whitespace-nowrap font-semibold">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
