import { cn } from "./cn.js";
import { Card } from "./card.js";

export interface StatCardProps {
  label: string;
  /** Main value, already formatted (e.g. "72.4", "33%"). */
  value: string;
  /** Period-over-period change in the same unit; sign drives colour. */
  delta?: number;
  /** Optional confidence note shown under the value (NFR-07). */
  confidence?: "high" | "medium" | "low";
  className?: string;
}

export function StatCard({ label, value, delta, confidence, className }: StatCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        {typeof delta === "number" && <ScoreDelta delta={delta} />}
      </div>
      {confidence && (
        <p className="mt-2 text-xs text-muted-foreground">
          Confidence: <span className="font-medium capitalize">{confidence}</span>
        </p>
      )}
    </Card>
  );
}

export function ScoreDelta({ delta }: { delta: number }) {
  const positive = delta > 0;
  const zero = delta === 0;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        zero && "bg-muted text-muted-foreground",
        !zero && positive && "bg-success/15 text-success",
        !zero && !positive && "bg-destructive/15 text-destructive",
      )}
      aria-label={`${positive ? "up" : "down"} ${Math.abs(delta)}`}
    >
      {positive ? "▲" : zero ? "–" : "▼"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}
