import { Card, CardContent } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";
import { serpConfigured } from "@/lib/serp";
import { KeywordChecker } from "@/components/keyword-checker";

/** RS-103 — keyword rank checker: position, buckets and striking-distance wins. */
export default async function KeywordsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { count } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", params.id);

  return (
    <div className="space-y-6">
      <KeywordChecker clientId={params.id} serpReady={serpConfigured()} />
      {(count ?? 0) === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No keywords yet. Add prompts/keywords in the Prompts tab — the checker ranks those.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
