"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@rootspun/ui";
import { checkRanksAction, type CheckRanksResult } from "@/app/(app)/clients/[id]/keywords/actions";

const bucketBadge: Record<string, string> = {
  top3: "bg-success/15 text-success",
  page1: "bg-success/15 text-success",
  page2: "bg-primary/15 text-primary",
  beyond_page2: "bg-muted text-muted-foreground",
  not_ranking: "bg-destructive/15 text-destructive",
};
const bucketLabel: Record<string, string> = {
  top3: "Top 3",
  page1: "Page 1",
  page2: "Page 2",
  beyond_page2: "Beyond p2",
  not_ranking: "Not ranking",
};

export function KeywordChecker({ clientId, serpReady }: { clientId: string; serpReady: boolean }) {
  const [pending, startTransition] = useTransition();
  const [res, setRes] = useState<CheckRanksResult | null>(null);

  function run() {
    setRes(null);
    startTransition(async () => setRes(await checkRanksAction(clientId)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Where this client ranks in Google for each tracked keyword, and which are closest to breaking through.
        </p>
        <Button onClick={run} disabled={pending} size="sm">
          <Search className="h-4 w-4" /> {pending ? "Checking…" : "Check ranks"}
        </Button>
      </div>

      {!serpReady && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Live rank checking uses Google Programmable Search (free, 100 queries/day, no scraping). Add{" "}
            <code className="rounded bg-muted px-1">GOOGLE_CSE_KEY</code> and{" "}
            <code className="rounded bg-muted px-1">GOOGLE_CSE_ID</code> to <code className="rounded bg-muted px-1">apps/web/.env.local</code>, then click “Check ranks”.
          </CardContent>
        </Card>
      )}

      {res?.error && <p className="text-sm text-destructive">{res.error}</p>}

      {res?.summary && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Keywords", value: res.summary.total },
              { label: "Ranking", value: res.summary.ranking },
              { label: "Top 3", value: res.summary.top3 },
              { label: "Quick wins", value: res.summary.quickWins },
              { label: "Avg position", value: res.summary.avgPosition != null ? res.summary.avgPosition.toFixed(1) : "—" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Keywords by opportunity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 font-medium">Keyword</th>
                      <th className="px-2 py-1 font-medium">Position</th>
                      <th className="px-2 py-1 font-medium">Bucket</th>
                      <th className="px-2 py-1 font-medium">Opportunity</th>
                      <th className="px-2 py-1 font-medium">Top competitor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.keywords!.map((k) => (
                      <tr key={k.keyword} className="border-t">
                        <td className="px-2 py-1">
                          {k.keyword}
                          {k.quickWin && (
                            <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                              quick win
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 tabular-nums">{k.position ?? "—"}</td>
                        <td className="px-2 py-1">
                          <span className={cn("rounded px-1.5 py-0.5 text-xs", bucketBadge[k.bucket])}>
                            {bucketLabel[k.bucket]}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${k.opportunity}%` }} />
                            </div>
                            <span className="tabular-nums text-muted-foreground">{k.opportunity}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{k.competitorsAbove[0] ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
