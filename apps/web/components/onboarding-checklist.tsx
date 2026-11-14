import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@rootspun/ui";

export interface ChecklistStep {
  label: string;
  done: boolean;
  href: string;
  hint: string;
}

/**
 * RS-408 / NFR-14 — guided onboarding so a new agency reaches first results in
 * under 15 minutes. Shown until every step is complete; each links to its action.
 */
export function OnboardingChecklist({ steps }: { steps: ChecklistStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get started ({doneCount}/{steps.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.label}>
              <Link
                href={s.href as never}
                className={cn(
                  "flex items-start gap-3 rounded-md px-2 py-2 hover:bg-secondary",
                  s.done && "opacity-60",
                )}
              >
                {s.done ? (
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <span>
                  <span className={cn("font-medium", s.done && "line-through")}>{s.label}</span>
                  <span className="block text-sm text-muted-foreground">{s.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
