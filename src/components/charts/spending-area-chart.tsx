"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface SpendingAreaChartProps {
  data: { month: string; amount: number }[];
  currency?: "INR" | "USD";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-lg p-3 shadow-xl border border-border/50">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${payload[0].payload.isForecast ? 'text-chart-3' : 'text-primary'}`}>
        {formatCurrency(payload[0].value)}
        {payload[0].payload.isForecast && <span className="ml-2 text-[10px] text-chart-3/80 font-normal uppercase tracking-wider">Forecast</span>}
      </p>
    </div>
  );
}

export function SpendingAreaChart({ data, currency = "INR" }: SpendingAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          fill="url(#colorSpending)"
          dot={false}
          activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
