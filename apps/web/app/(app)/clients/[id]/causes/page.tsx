import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CauseCard, type CauseView } from "@/components/cause-card";
import { causeLabel } from "@/lib/cause-labels";

/** RS-206 — causes view: list sorted by impact, filter by type, triage inline. */
export default async function CausesPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { type?: string };
}) {
  const supabase = createClient();

  const { data: causes } = await supabase
    .from("causes")
    .select("id, type, confidence, impact, status, rule_id, evidence, prompt_id")
    .eq("client_id", params.id)
    .order("impact", { ascending: false })
    .limit(200);

  const rows = causes ?? [];
  const promptIds = [...new Set(rows.map((c) => c.prompt_id).filter((v): v is string => Boolean(v)))];
  const { data: prompts } = promptIds.length
    ? await supabase.from("prompts").select("id, text").in("id", promptIds)
    : { data: [] };
  const promptText = new Map((prompts ?? []).map((p) => [p.id, p.text]));

  const types = [...new Set(rows.map((c) => c.type))];
  const activeType = searchParams.type;
  const filtered = activeType ? rows.filter((c) => c.type === activeType) : rows;

  const views: CauseView[] = filtered.map((c) => {
    const ev = (c.evidence ?? {}) as Record<string, unknown>;
    return {
      id: c.id,
      type: c.type,
      confidence: c.confidence,
      impact: Number(c.impact),
      status: c.status,
      ruleTitle: typeof ev.ruleTitle === "string" ? ev.ruleTitle : null,
      ruleUrl: typeof ev.ruleUrl === "string" ? ev.ruleUrl : null,
      evidence: ev,
      promptText: c.prompt_id ? promptText.get(c.prompt_id) ?? null : null,
    };
  });

  const base = `/clients/${params.id}/causes`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The likely cause of each lost ranking or citation, ranked by impact (search volume × lost
        visibility), each with evidence and the Google rule behind it.
      </p>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip href={base} label="All" active={!activeType} />
          {types.map((t) => (
            <FilterChip key={t} href={`${base}?type=${t}`} label={causeLabel(t)} active={activeType === t} />
          ))}
        </div>
      )}

      {views.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No causes yet. Run a check and the Why Engine will explain any losses here.
        </p>
      ) : (
        <div className="space-y-3">
          {views.map((c) => (
            <CauseCard key={c.id} clientId={params.id} cause={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href as never}
      className={`rounded-full border px-3 py-1 text-sm ${
        active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </Link>
  );
}
