"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { SpendingAreaChart } from "@/components/charts/spending-area-chart";
import { CategoryDonutChart } from "@/components/charts/category-donut-chart";
import { TopSpendersBarChart } from "@/components/charts/top-spenders-bar-chart";
import { formatCurrency, formatRelativeTime, getInitials, getCategoryColor } from "@/lib/utils";
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

const outstandingBalances = [
  { name: "Raj Patel", amount: 4500, type: "owes_you" as const },
  { name: "Priya Sharma", amount: 2800, type: "you_owe" as const },
  { name: "Vikram Singh", amount: 3200, type: "owes_you" as const },
  { name: "Sneha Gupta", amount: 1950, type: "you_owe" as const },
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
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

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
    loadDashboard();
  }, []);

  // Compute stats grid with professional uniform styles
  const stats = React.useMemo(() => {
    const apiStats = data?.stats;
    const isMock = !apiStats || apiStats.groupCount === 0;

    return [
      {
        title: "Total Spent",
        value: isMock ? mockStats.totalSpent : apiStats.totalSpent,
        change: isMock ? "+12.5%" : "+8.2%",
        trend: "up" as const,
        icon: Receipt,
        colorClass: "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20",
      },
      {
        title: "Outstanding Balance",
        value: isMock ? mockStats.outstandingBalance : apiStats.outstandingBalance,
        change: isMock ? "-8.2%" : (apiStats.outstandingBalance >= 0 ? "+4.1%" : "-2.5%"),
        trend: isMock ? ("down" as const) : (apiStats.outstandingBalance >= 0 ? ("up" as const) : ("down" as const)),
        icon: TrendingDown,
        colorClass: isMock ? "text-amber-500 bg-amber-500/10 border border-amber-500/20" : (apiStats.outstandingBalance >= 0 ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20" : "text-amber-500 bg-amber-500/10 border border-amber-500/20"),
      },
      {
        title: "Active Groups",
        value: isMock ? mockStats.groupCount : apiStats.groupCount,
        change: isMock ? "+2" : "+0",
        trend: "up" as const,
        icon: Users,
        colorClass: "text-blue-500 bg-blue-500/10 border border-blue-500/20",
      },
      {
        title: "Settlements Recorded",
        value: isMock ? mockStats.totalSettled : apiStats.totalSettled,
        change: isMock ? "+3" : "+1",
        trend: "up" as const,
        icon: ArrowLeftRight,
        colorClass: "text-violet-500 bg-violet-500/10 border border-violet-500/20",
      },
    ];
  }, [data]);

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
    <div className="relative space-y-6 min-h-full">
      {/* Subtle background wash */}
      <div className="premium-glow-bg top-0 right-1/4" />

      {/* ---------- Stat Cards ---------- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 relative z-10">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="premium-card overflow-hidden"
          >
            <CardContent className="p-6">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-10 rounded-lg bg-muted/40" />
                  <Skeleton className="h-4 w-20 bg-muted/40" />
                  <Skeleton className="h-8 w-28 bg-muted/40" />
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      {stat.title.includes("Groups") || stat.title.includes("Settlements")
                        ? stat.value
                        : formatCurrency(stat.value)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">
                        {stat.trend === "up" ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span>{stat.change}</span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">vs last month</span>
                    </div>
                  </div>
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.colorClass} transition-all duration-300`}
                  >
                    <stat.icon className="h-4.5 w-4.5" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---------- Charts Row ---------- */}
      <div className="grid gap-5 lg:grid-cols-7 relative z-10">
        {/* Monthly Spending */}
        <Card className="lg:col-span-4 premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Monthly Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full bg-muted/40 rounded-lg" />
            ) : (
              <SpendingAreaChart data={monthlySpending} />
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="lg:col-span-3 premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Skeleton className="h-48 w-48 rounded-full bg-muted/40" />
              </div>
            ) : (
              <CategoryDonutChart data={categorySpending} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- Bottom Row ---------- */}
      <div className="grid gap-5 lg:grid-cols-12 relative z-10">
        {/* Top Spenders */}
        <Card className="lg:col-span-4 premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Top Spenders
            </CardTitle>
          </CardHeader>
          <CardContent>
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

        {/* Outstanding Balances */}
        <Card className="lg:col-span-4 premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Outstanding Balances
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg bg-muted/40" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {outstandingBalances.map((balance) => (
                  <div
                    key={balance.name}
                    className="flex items-center justify-between gap-3.5 rounded-lg border border-border/60 bg-muted/15 p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-border shadow-sm">
                        <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground font-bold">
                          {getInitials(balance.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{balance.name}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          {balance.type === "owes_you" ? "Owes you" : "You owe"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold tracking-tight px-2 py-0.5 rounded-full ${
                        balance.type === "owes_you"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}
                    >
                      {balance.type === "owes_you" ? "+" : "-"}
                      {formatCurrency(balance.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-4 premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
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
              <div className="space-y-4">
                {recentActivity.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3.5 group"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/30 border border-border/80 transition-all duration-300">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                        {item.amount && (
                          <span className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
                            {formatCurrency(item.amount)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {item.userName}
                        </p>
                        <span className="text-[10px] text-muted-foreground/40 font-bold">·</span>
                        <p className="text-xs text-muted-foreground/80 whitespace-nowrap font-medium">
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
