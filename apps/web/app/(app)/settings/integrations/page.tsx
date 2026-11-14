import { CheckCircle2 } from "lucide-react";
import { buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";

/** RS-107 — connect Google Search Console (read-only OAuth) per client. */
export default async function IntegrationsSettingsPage() {
  const supabase = createClient();
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");
  const { data: integrations } = await supabase
    .from("integrations")
    .select("client_id, provider, status")
    .eq("provider", "gsc");

  const connected = new Set(
    (integrations ?? []).filter((i) => i.status === "connected").map((i) => i.client_id),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect Google Search Console (read-only) to put real clicks next to visibility.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Google Search Console</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!clients || clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a client first.</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {clients.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2">
                  <span>{c.name}</span>
                  {connected.has(c.id) ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-4 w-4" /> Connected
                    </span>
                  ) : (
                    <a
                      href={`/api/integrations/gsc/start?clientId=${c.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Connect
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
