import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants, Card, CardContent, CardHeader, CardTitle, StatCard } from "@rootspun/ui";
import { OnboardingChecklist, type ChecklistStep } from "@/components/onboarding-checklist";
import { SampleDataButton } from "@/components/sample-data-button";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: clients } = await supabase.from("clients").select("id, name");
  const clientCount = clients?.length ?? 0;
  const firstClientId = clients?.[0]?.id;

  // Onboarding state (RS-408): count across the agency (RLS-scoped).
  const [{ count: promptCount }, { count: gscCount }, { count: scoreCount }] = await Promise.all([
    supabase.from("prompts").select("id", { count: "exact", head: true }),
    supabase.from("integrations").select("id", { count: "exact", head: true }).eq("provider", "gsc"),
    supabase.from("scores_daily").select("id", { count: "exact", head: true }),
  ]);

  // Latest overall UVS per client for the clients overview.
  const { data: latestScores } = await supabase
    .from("scores_daily")
    .select("client_id, uvs, date")
    .is("engine_id", null)
    .is("topic", null)
    .order("date", { ascending: false })
    .limit(400);
  const uvsByClient = new Map<string, number>();
  for (const s of latestScores ?? []) {
    if (s.client_id && !uvsByClient.has(s.client_id)) uvsByClient.set(s.client_id, Number(s.uvs));
  }

  const steps: ChecklistStep[] = [
    { label: "Add your first client", done: clientCount > 0, href: "/clients/new", hint: "Domains, brand terms and competitors." },
    {
      label: "Build a prompt set",
      done: (promptCount ?? 0) > 0,
      href: firstClientId ? `/clients/${firstClientId}/prompts` : "/clients/new",
      hint: "Import a CSV or add the questions buyers ask.",
    },
    {
      label: "Connect Search Console",
      done: (gscCount ?? 0) > 0,
      href: "/settings",
      hint: "Put real clicks next to visibility.",
    },
    {
      label: "Run your first check",
      done: (scoreCount ?? 0) > 0,
      href: firstClientId ? `/clients/${firstClientId}/visibility` : "/clients/new",
      hint: "See your Unified Visibility Score across engines.",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agency overview</h1>
        <Link href={"/clients/new" as never} className={buttonVariants()}>
          Add client
        </Link>
      </div>

      <OnboardingChecklist steps={steps} />

      {clientCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Add your first client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Track a client across Google and AI engines, understand why visibility
              moves, and send a branded report — first results in under 15 minutes.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={"/clients/new" as never} className={buttonVariants()}>
                Get started
              </Link>
              <SampleDataButton />
            </div>
            <p className="text-xs text-muted-foreground">
              Or load a fully populated demo client to explore the dashboards right away.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Clients tracked" value={String(clientCount)} />
            <StatCard label="Prompts tracked" value={String(promptCount ?? 0)} />
            <StatCard label="Days scored" value={String(scoreCount ?? 0)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y rounded-md border text-sm">
                {clients!.map((c) => {
                  const uvs = uvsByClient.get(c.id);
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/clients/${c.id}/visibility` as never}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-secondary"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="tabular-nums">
                          {typeof uvs === "number" ? (
                            <>
                              <span className="text-muted-foreground">UVS </span>
                              {uvs.toFixed(1)}
                            </>
                          ) : (
                            <span className="text-muted-foreground">not scored yet</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
