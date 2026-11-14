"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";
import { Button } from "@rootspun/ui";
import { runCrawlAction } from "@/app/(app)/clients/[id]/technical/actions";

export function RunCrawlButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    startTransition(async () => {
      const r = await runCrawlAction(clientId);
      if (r.error) setMsg(r.error);
      else {
        setMsg(`Crawled ${r.pages} pages`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={pending} size="sm">
        <Radar className="h-4 w-4" /> {pending ? "Crawling…" : "Run crawl"}
      </Button>
      {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
    </div>
  );
}
