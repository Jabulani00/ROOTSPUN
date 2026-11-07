import { createClient } from "@/lib/supabase/server";
import { ApiKeyManager, type KeyRow } from "@/components/api-key-manager";

/** RS-404 — manage public API keys. */
export default async function ApiSettingsPage() {
  const supabase = createClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, scopes, last_used_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API</h1>
        <p className="text-sm text-muted-foreground">
          Public REST API · OpenAPI at <code>/api/public/v1/openapi</code>
        </p>
      </div>
      <ApiKeyManager keys={(keys ?? []) as KeyRow[]} />
    </div>
  );
}
