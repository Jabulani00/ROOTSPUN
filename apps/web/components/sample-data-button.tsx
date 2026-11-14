"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@rootspun/ui";
import { loadSampleDataAction } from "@/app/(app)/dashboard/actions";

export function SampleDataButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    startTransition(async () => {
      const r = await loadSampleDataAction();
      if (r.error) setError(r.error);
      else {
        router.push(`/clients/${r.clientId}/visibility` as never);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" onClick={load} disabled={pending}>
        <Sparkles className="h-4 w-4" /> {pending ? "Loading demo…" : "Load sample data"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
