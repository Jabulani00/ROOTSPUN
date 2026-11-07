import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";
import { ScoreTrendChart, type ScorePoint } from "@/components/score-trend-chart";

type Confidence = "high" | "medium" | "low";

/**
 * RS-308 — the client-viewer sees only their client: score, trend, shipped fixes
 * and reports. RLS restricts the data; prompts and costs are never queried here.
 */
export default async function PortalPage() {
  const supabase = createClient();

  // RLS scopes this to the viewer's own client.
  const { data: client } = await supabase.from("clients").select("id, name").limit(1).maybeSingle();
  if (!client) {
    return <p className="text-sm text-muted-foreground">No client is linked to your account yet.</p>;
  }

  const { data: scores } = await supabase
    .from("scores_daily")
    .select("date, uvs, share_of_voice, confidence")
    .eq("client_id", client.id)
    .is("engine_id", null)
    .is("topic", null)
    .order("date", { ascending: true })
    .limit(90);

  const { data: fixes } = await supabase
    .from("fixes")
    .select("id, title, kind, status, shipped_at")
    .eq("client_id", client.id)
    .eq("status", "shipped")
    .order("shipped_at", { ascending: false })
    .limit(20);

  const { data: reports } = await supabase
    .from("reports")
    .select("id, period, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const trend: ScorePoint[] = (scores ?? []).map((s) => ({ date: s.date, uvs: Number(s.uvs) }));
  const latest = scores?.at(-1);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">{client.name}</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Visibility score"
          value={latest ? Number(latest.uvs).toFixed(1) : "—"}
          confidence={(latest?.confidence as Confidence) ?? "low"}
        />
        <StatCard
          label="Share of voice"
          value={latest ? `${Number(latest.share_of_voice).toFixed(0)}%` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visibility over time</CardTitle>
        </CardHeader>
        <CardContent>
          <ScoreTrendChart data={trend} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Shipped improvements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {fixes && fixes.length > 0 ? (
              fixes.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2">
                  <span>{f.title.replace(/^Fix:\s*/, "")}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.shipped_at ? f.shipped_at.slice(0, 10) : ""}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No improvements shipped yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {reports && reports.length > 0 ? (
              reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2">
                  <span>{r.period}</span>
                  <span className="text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No reports yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
