"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { Button } from "@rootspun/ui";
import { requestRunAction } from "@/app/(app)/clients/[id]/actions";

export function RunNowButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await requestRunAction(clientId);
      setMsg(r.error ? r.error : r.enqueued === 0 ? "No prompts to run yet" : `Queued ${r.enqueued} prompt runs`);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={pending} size="sm">
        <Play className="h-4 w-4" /> {pending ? "Queuing…" : "Run now"}
      </Button>
      {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
    </div>
  );
}
