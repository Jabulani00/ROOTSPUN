"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, ExternalLink, X } from "lucide-react";
import { Button, Card, cn } from "@rootspun/ui";
import { setCauseStatusAction } from "@/app/(app)/clients/[id]/causes/actions";
import { createFixFromCauseAction } from "@/app/(app)/clients/[id]/fixes/actions";
import { causeLabel } from "@/lib/cause-labels";

export interface CauseView {
  id: string;
  type: string;
  confidence: "high" | "medium" | "low";
  impact: number;
  status: "new" | "accepted" | "dismissed";
  ruleTitle: string | null;
  ruleUrl: string | null;
  evidence: Record<string, unknown>;
  promptText: string | null;
}

const confTone: Record<string, string> = {
  high: "bg-success/15 text-success",
  medium: "bg-primary/15 text-primary",
  low: "bg-muted text-muted-foreground",
};

export function CauseCard({ clientId, cause }: { clientId: string; cause: CauseView }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(cause.status);

  const [fixMsg, setFixMsg] = useState<string | null>(null);

  function set(next: "accepted" | "dismissed") {
    startTransition(async () => {
      const r = await setCauseStatusAction(clientId, cause.id, next);
      if (!r.error) setStatus(next);
    });
  }

  function createFix() {
    setFixMsg(null);
    startTransition(async () => {
      const r = await createFixFromCauseAction(clientId, cause.id);
      setFixMsg(r.error ? r.error : "Fix ticket created");
      if (!r.error) setStatus("accepted");
    });
  }

  return (
    <Card className={cn("p-4", status === "dismissed" && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{causeLabel(cause.type)}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs capitalize", confTone[cause.confidence])}>
              {cause.confidence}
            </span>
            {status !== "new" && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{status}</span>
            )}
          </div>
          {cause.promptText && (
            <p className="mt-1 truncate text-sm text-muted-foreground">{cause.promptText}</p>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            Evidence
          </button>
          {open && (
            <div className="mt-2 space-y-2 rounded-md bg-secondary/50 p-3 text-xs">
              <pre className="whitespace-pre-wrap break-words font-mono">
                {JSON.stringify(cause.evidence, null, 2)}
              </pre>
              {cause.ruleUrl && (
                <a
                  href={cause.ruleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {cause.ruleTitle ?? "Why Google cares"} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs text-muted-foreground">
            impact <span className="font-medium tabular-nums">{Math.round(cause.impact)}</span>
          </span>
          {status === "new" && (
            <div className="flex gap-1">
              <Button size="icon" variant="outline" aria-label="Accept" disabled={pending} onClick={() => set("accepted")}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Dismiss" disabled={pending} onClick={() => set("dismissed")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {status === "accepted" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={createFix}>
              Create fix
            </Button>
          )}
          {fixMsg && <span className="text-xs text-muted-foreground">{fixMsg}</span>}
        </div>
      </div>
    </Card>
  );
}
