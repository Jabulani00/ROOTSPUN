import { createClient } from "@/lib/supabase/server";
import { buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";

/** RS-109 — branded PDF reports per client per period. */
export default async function ReportsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, period, created_at")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false })
    .limit(24);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate a report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            A branded PDF — Unified Visibility Score, share of voice, wins, losses and
            next steps — in your agency&apos;s colours.
          </p>
          <a
            href={`/api/reports/${params.id}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants()}
          >
            Download PDF
          </a>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">History</h2>
        {reports && reports.length > 0 ? (
          <ul className="divide-y rounded-md border text-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2">
                <span>{r.period}</span>
                <span className="text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No saved reports yet.</p>
        )}
      </div>
    </div>
  );
}
