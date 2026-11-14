"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { Button } from "@rootspun/ui";
import { fetchCwvAction } from "@/app/(app)/clients/[id]/technical/actions";

export function CwvButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await fetchCwvAction(clientId);
      if (r.error) setMsg(r.error);
      else {
        setMsg("Fetched Core Web Vitals");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={pending} size="sm" variant="outline">
        <Activity className="h-4 w-4" /> {pending ? "Fetching…" : "Fetch Core Web Vitals"}
      </Button>
      {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
    </div>
  );
}
