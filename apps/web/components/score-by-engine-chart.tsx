"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { engineColor } from "@/lib/engines";

export interface EngineScore {
  code: string;
  label: string;
  uvs: number;
}

/**
 * UVS by engine. Identity is carried by the x-axis labels (not colour alone), so
 * colour is secondary; each bar is also direct-labelled with its value. Colours
 * come from the validated, colorblind-safe engine palette (CSS tokens, light/dark).
 */
export function ScoreByEngineChart({ data }: { data: EngineScore[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-56 place-items-center text-sm text-muted-foreground">
        No per-engine scores yet.
      </div>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: -16 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Bar dataKey="uvs" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.code} fill={engineColor(d.code)} />
            ))}
            <LabelList
              dataKey="uvs"
              position="top"
              formatter={(v: number) => v.toFixed(0)}
              style={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
