"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface CategoryDonutChartProps {
  data: { category: string; amount: number; percentage: number; color: string }[];
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="glass-strong rounded-lg p-3 shadow-xl border border-border/50">
      <p className="text-xs font-medium" style={{ color: data.color }}>
        {data.category}
      </p>
      <p className="text-sm font-bold">₹{data.amount.toLocaleString("en-IN")}</p>
      <p className="text-xs text-muted-foreground">{data.percentage}%</p>
    </div>
  );
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
      <div className="w-48 h-48 sm:w-56 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={3}
              dataKey="amount"
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 sm:flex-col sm:gap-2">
        {data.map((item) => (
          <div key={item.category} className="flex items-center gap-2 text-sm">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.category}</span>
            <span className="font-medium ml-auto">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
