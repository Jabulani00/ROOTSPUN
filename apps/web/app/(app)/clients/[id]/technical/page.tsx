import { Card, CardContent, CardHeader, CardTitle, cn } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";
import { RunCrawlButton } from "@/components/run-crawl-button";

/** RS-201/203 — crawl results, robots/crawler access, snippet directives. */
export default async function TechnicalPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: crawl } = await supabase
    .from("crawls")
    .select("id, page_count, finished_at")
    .eq("client_id", params.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pages } = crawl
    ? await supabase
        .from("pages")
        .select("url, status, canonical, nosnippet, template")
        .eq("crawl_id", crawl.id)
        .limit(50)
    : { data: [] };

  const { data: access } = await supabase
    .from("crawler_access")
    .select("bot, allowed, checked_at")
    .eq("client_id", params.id)
    .order("checked_at", { ascending: false })
    .limit(6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Crawl status, canonicals, snippet directives, and whether Googlebot and AI crawlers can reach the site.
        </p>
        <RunCrawlButton clientId={params.id} />
      </div>

      {!crawl ? (
        <p className="text-sm text-muted-foreground">No crawl yet — run one to analyse the site.</p>
      ) : (
        <>
          {access && access.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Crawler access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 text-sm">
                  {access.map((a) => (
                    <span
                      key={a.bot}
                      className={cn(
                        "rounded-full px-3 py-1",
                        a.allowed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                      )}
                    >
                      {a.allowed ? "✓" : "✗"} {a.bot}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Pages ({crawl.page_count})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 font-medium">URL</th>
                      <th className="px-2 py-1 font-medium">Status</th>
                      <th className="px-2 py-1 font-medium">Template</th>
                      <th className="px-2 py-1 font-medium">Canonical</th>
                      <th className="px-2 py-1 font-medium">nosnippet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pages ?? []).map((p) => {
                      let path = p.url;
                      try {
                        path = new URL(p.url).pathname;
                      } catch {
                        /* keep */
                      }
                      return (
                        <tr key={p.url} className="border-t">
                          <td className="px-2 py-1">{path}</td>
                          <td className="px-2 py-1 tabular-nums">{p.status}</td>
                          <td className="px-2 py-1 text-muted-foreground">{p.template}</td>
                          <td className="px-2 py-1">{p.canonical ? "✓" : "—"}</td>
                          <td className="px-2 py-1">{p.nosnippet ? "⚠" : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
