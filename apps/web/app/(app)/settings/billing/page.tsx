import { PLANS, type PlanId } from "@rootspun/payments";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";
import { ensureAgencyId } from "@/lib/auth";

/** RS-405 — plans, current subscription, and usage. */
export default async function BillingSettingsPage() {
  const supabase = createClient();
  const agencyId = await ensureAgencyId();

  const { data: agency } = agencyId
    ? await supabase.from("agencies").select("plan").eq("id", agencyId).maybeSingle()
    : { data: null };
  const { data: sub } = agencyId
    ? await supabase.from("subscriptions").select("plan, status, period_end").eq("agency_id", agencyId).maybeSingle()
    : { data: null };

  const currentPlan = (sub?.plan ?? agency?.plan ?? "trial") as PlanId | "trial";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Paystack for South Africa, Stripe elsewhere. Current plan:{" "}
          <span className="font-medium capitalize">{currentPlan}</span>
          {sub?.status ? ` · ${sub.status}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.values(PLANS)).map((p) => {
          const active = currentPlan === p.id;
          return (
            <Card key={p.id} className={cn(active && "border-primary ring-1 ring-primary")}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  <span>{p.name}</span>
                  <span className="text-lg">${p.priceUsd}<span className="text-xs text-muted-foreground">/mo</span></span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>{p.promptRunsPerMonth.toLocaleString()} prompt runs / month</p>
                <p>Up to {p.clients} clients</p>
                {active && <p className="pt-2 font-medium text-primary">Current plan</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
