import { Card, CardContent, CardHeader, CardTitle, cn } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";
import { RunCrawlButton } from "@/components/run-crawl-button";
import { CwvButton } from "@/components/cwv-button";

/** RS-201/203 — crawl results, robots/crawler access, snippet directives. */
export default async function TechnicalPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: crawl } = await supabase
    .from("crawls")
    .select("id, page_count, finished_at, robots_found, sitemap_found")
    .eq("client_id", params.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pages } = crawl
    ? await supabase
        .from("pages")
        .select("url, status, canonical, nosnippet, template, issues")
        .eq("crawl_id", crawl.id)
        .limit(50)
    : { data: [] };

  // Aggregate technical-SEO issues across the crawl.
  const agg = new Map<string, { severity: string; message: string; n: number }>();
  for (const p of pages ?? []) {
    for (const i of (p.issues ?? []) as { severity: string; code: string; message: string }[]) {
      const e = agg.get(i.code) ?? { severity: i.severity, message: i.message, n: 0 };
      e.n += 1;
      agg.set(i.code, e);
    }
  }
  const sevRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const topIssues = [...agg.values()].sort(
    (a, b) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3) || b.n - a.n,
  );

  const { data: access } = await supabase
    .from("crawler_access")
    .select("bot, allowed, checked_at")
    .eq("client_id", params.id)
    .order("checked_at", { ascending: false })
    .limit(6);

  const { data: cwv } = await supabase
    .from("cwv_metrics")
    .select("lcp_ms, inp_ms, cls, source, date")
    .eq("client_id", params.id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cwvRows: { label: string; value: string; good: boolean | null }[] = cwv
    ? [
        { label: "LCP", value: cwv.lcp_ms != null ? `${(cwv.lcp_ms / 1000).toFixed(2)} s` : "—", good: cwv.lcp_ms != null ? cwv.lcp_ms <= 2500 : null },
        { label: "INP", value: cwv.inp_ms != null ? `${Math.round(cwv.inp_ms)} ms` : "—", good: cwv.inp_ms != null ? cwv.inp_ms <= 200 : null },
        { label: "CLS", value: cwv.cls != null ? cwv.cls.toFixed(2) : "—", good: cwv.cls != null ? cwv.cls <= 0.1 : null },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Crawl status, canonicals, snippet directives, and whether Googlebot and AI crawlers can reach the site.
        </p>
        <RunCrawlButton clientId={params.id} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core Web Vitals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cwvRows.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {cwvRows.map((m) => (
                <div key={m.label}>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      m.good === true && "text-success",
                      m.good === false && "text-destructive",
                    )}
                  >
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No Core Web Vitals yet. Fetch them from CrUX/PageSpeed (needs a free Google API key).
            </p>
          )}
          <CwvButton clientId={params.id} />
        </CardContent>
      </Card>

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
                <div className="mb-3 flex flex-wrap gap-2 text-sm">
                  <span className={cn("rounded-full px-3 py-1", crawl.robots_found ? "bg-success/15 text-success" : "bg-primary/15 text-primary")}>
                    robots.txt {crawl.robots_found ? "found" : "missing"}
                  </span>
                  <span className={cn("rounded-full px-3 py-1", crawl.sitemap_found ? "bg-success/15 text-success" : "bg-primary/15 text-primary")}>
                    sitemap.xml {crawl.sitemap_found ? "found" : "missing"}
                  </span>
                </div>
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
              <CardTitle>Technical SEO issues</CardTitle>
            </CardHeader>
            <CardContent>
              {topIssues.length === 0 ? (
                <p className="text-sm text-muted-foreground">No on-page issues detected. 🎉</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {topIssues.slice(0, 14).map((i) => (
                    <li key={i.message} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-xs uppercase",
                          i.severity === "high" && "bg-destructive/15 text-destructive",
                          i.severity === "medium" && "bg-primary/15 text-primary",
                          i.severity === "low" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {i.severity}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{i.n}×</span>
                      <span>{i.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

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
                      <th className="px-2 py-1 font-medium">Issues</th>
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
                          <td className="px-2 py-1 tabular-nums text-muted-foreground">
                            {((p.issues ?? []) as unknown[]).length || "—"}
                          </td>
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
