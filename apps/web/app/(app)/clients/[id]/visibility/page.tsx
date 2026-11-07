import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";
import { ScoreTrendChart, type ScorePoint } from "@/components/score-trend-chart";
import { ScoreByEngineChart, type EngineScore } from "@/components/score-by-engine-chart";
import { RunNowButton } from "@/components/run-now-button";
import { engineLabel } from "@/lib/engines";

type Confidence = "high" | "medium" | "low";

/** RS-108 — client visibility dashboard: UVS, share of voice, score trend. */
export default async function VisibilityPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: scores } = await supabase
    .from("scores_daily")
    .select("date, uvs, share_of_voice, confidence")
    .eq("client_id", params.id)
    .is("engine_id", null)
    .is("topic", null)
    .order("date", { ascending: true })
    .limit(90);

  const { count: promptCount } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", params.id);

  // Per-engine scores for the most recent date present.
  const { data: engineRows } = await supabase
    .from("scores_daily")
    .select("engine_id, uvs, date")
    .eq("client_id", params.id)
    .not("engine_id", "is", null)
    .order("date", { ascending: false })
    .limit(48);
  const { data: engineDefs } = await supabase.from("engines").select("id, code");
  const codeById = new Map((engineDefs ?? []).map((e) => [e.id, e.code]));
  const latestEngineDate = engineRows?.[0]?.date;
  const engineScores: EngineScore[] = (engineRows ?? [])
    .filter((r) => r.date === latestEngineDate && r.engine_id != null)
    .map((r) => {
      const code = codeById.get(r.engine_id as number) ?? "";
      return { code, label: engineLabel(code), uvs: Number(r.uvs) };
    });

  const trend: ScorePoint[] = (scores ?? []).map((s) => ({ date: s.date, uvs: Number(s.uvs) }));
  const latest = scores?.at(-1);
  const prev = scores && scores.length > 1 ? scores.at(-2) : undefined;
  const delta = latest && prev ? Number(latest.uvs) - Number(prev.uvs) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <RunNowButton clientId={params.id} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Unified Visibility Score"
          value={latest ? Number(latest.uvs).toFixed(1) : "—"}
          delta={delta}
          confidence={(latest?.confidence as Confidence) ?? "low"}
        />
        <StatCard
          label="Share of voice"
          value={latest ? `${Number(latest.share_of_voice).toFixed(0)}%` : "—"}
        />
        <StatCard label="Prompts tracked" value={String(promptCount ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visibility score trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Score by engine</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreByEngineChart data={engineScores} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
