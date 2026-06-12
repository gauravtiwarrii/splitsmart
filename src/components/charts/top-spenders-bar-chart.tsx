"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface TopSpendersBarChartProps {
  data: { userName: string; totalSpent: number }[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-lg p-3 shadow-xl border border-border/50">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-primary">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export function TopSpendersBarChart({ data }: TopSpendersBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
        />
        <YAxis
          type="category"
          dataKey="userName"
          axisLine={false}
          tickLine={false}
          width={80}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
        <Bar
          dataKey="totalSpent"
          fill="hsl(160, 84%, 39%)"
          radius={[0, 6, 6, 0]}
          barSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
