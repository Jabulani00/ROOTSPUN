import { createClient } from "@/lib/supabase/server";
import { PromptManager } from "@/components/prompt-manager";

/** RS-102 — prompt sets: list existing prompts and add via manual or CSV. */
export default async function PromptsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text, topic, intent, priority, search_volume")
    .eq("client_id", params.id)
    .order("search_volume", { ascending: false })
    .limit(300);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Prompts ({prompts?.length ?? 0})</h2>
        </div>
        {prompts && prompts.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Prompt</th>
                  <th className="px-3 py-2 font-medium">Topic</th>
                  <th className="px-3 py-2 font-medium">Intent</th>
                  <th className="px-3 py-2 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {prompts.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.text}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.topic ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.intent ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.search_volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No prompts yet. Add the questions buyers actually ask — manually or via CSV.
          </p>
        )}
      </div>
      <PromptManager clientId={params.id} />
    </div>
  );
}
