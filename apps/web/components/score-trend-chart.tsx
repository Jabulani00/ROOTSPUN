"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ScorePoint {
  date: string; // yyyy-mm-dd
  uvs: number;
}

/**
 * Unified Visibility Score over time. A single time series, so per the dataviz
 * method there is no legend (the card title names it); the line uses the brand
 * primary, grid/axes are recessive, and the y-axis is fixed to the 0–100 scale.
 */
export function ScoreTrendChart({ data }: { data: ScorePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        No score history yet — run a check to start the trend.
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))" }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              color: "hsl(var(--foreground))",
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            formatter={(v: number) => [v.toFixed(1), "UVS"]}
          />
          <Line
            type="monotone"
            dataKey="uvs"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
