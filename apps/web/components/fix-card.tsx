"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { Card, cn } from "@rootspun/ui";
import { updateFixStatusAction } from "@/app/(app)/clients/[id]/fixes/actions";

type FixStatus = "open" | "in_progress" | "shipped";

export interface FixView {
  id: string;
  title: string;
  kind: "dev" | "content" | "pr";
  status: FixStatus;
  brief: {
    steps?: string[];
    affectedUrls?: string[];
    ruleTitle?: string | null;
    ruleUrl?: string | null;
    expectedImpact?: number;
  };
}

const kindTone: Record<string, string> = {
  dev: "bg-primary/15 text-primary",
  content: "bg-success/15 text-success",
  pr: "bg-secondary text-secondary-foreground",
};

export function FixCard({ clientId, fix }: { clientId: string; fix: FixView }) {
  const [status, setStatus] = useState<FixStatus>(fix.status);
  const [pending, startTransition] = useTransition();

  function change(next: FixStatus) {
    setStatus(next);
    startTransition(() => {
      void updateFixStatusAction(clientId, fix.id, next);
    });
  }

  return (
    <Card className={cn("p-4", status === "shipped" && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{fix.title}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs uppercase", kindTone[fix.kind])}>
              {fix.kind}
            </span>
          </div>
          {typeof fix.brief.expectedImpact === "number" && (
            <p className="mt-1 text-xs text-muted-foreground">
              expected impact <span className="font-medium tabular-nums">{fix.brief.expectedImpact}</span>
            </p>
          )}
        </div>
        <select
          aria-label="Fix status"
          value={status}
          disabled={pending}
          onChange={(e) => change(e.target.value as FixStatus)}
          className="h-8 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="shipped">Shipped</option>
        </select>
      </div>

      {fix.brief.steps && fix.brief.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {fix.brief.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {fix.brief.affectedUrls && fix.brief.affectedUrls.length > 0 && (
          <span className="truncate">Affected: {fix.brief.affectedUrls.join(", ")}</span>
        )}
        {fix.brief.ruleUrl && (
          <a
            href={fix.brief.ruleUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {fix.brief.ruleTitle ?? "Google rule"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </Card>
  );
}
