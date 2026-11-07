import { createClient } from "@/lib/supabase/server";
import { FixCard, type FixView } from "@/components/fix-card";

/** RS-303 — Fix Studio: the tickets created from accepted causes. */
export default async function FixesPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: fixes } = await supabase
    .from("fixes")
    .select("id, title, kind, status, brief")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const views: FixView[] = (fixes ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    kind: f.kind,
    status: f.status,
    brief: (f.brief ?? {}) as FixView["brief"],
  }));

  if (views.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No fixes yet. Accept a cause in the Causes view and choose &ldquo;Create fix&rdquo; to turn it
        into a ticket with steps, affected URLs and the Google rule behind it.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Fixes ({views.length})</h2>
      {views.map((f) => (
        <FixCard key={f.id} clientId={params.id} fix={f} />
      ))}
    </div>
  );
}
