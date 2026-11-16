import { Card, CardContent, CardHeader, CardTitle, cn } from "@rootspun/ui";
import { auditOnPage, buildStrategy, type SeoIssue } from "@rootspun/core";
import { createClient } from "@/lib/supabase/server";
import { RunCrawlButton } from "@/components/run-crawl-button";
import { CwvButton } from "@/components/cwv-button";

/** RS-201/203 — crawl results, robots/crawler access, snippet directives. */
export default async function TechnicalPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: crawl } = await supabase
    .from("crawls")
    .select("id, page_count, finished_at, robots_found, sitemap_found, aeo_score")
    .eq("client_id", params.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pages } = crawl
    ? await supabase
        .from("pages")
        .select("url, status, canonical, nosnippet, template, issues, aeo_score")
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
  const brokenCount = (pages ?? []).filter(
    (p) => p.status != null && (p.status >= 400 || p.status === 0),
  ).length;

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

  // "How to rank higher" — fuse on-page, canonical, technical and AEO signals
  // into one prioritised strategy (SEO + AEO).
  const uniqueOnPage: SeoIssue[] = [];
  const seenCode = new Set<string>();
  for (const p of pages ?? []) {
    for (const i of (p.issues ?? []) as SeoIssue[]) {
      if (!seenCode.has(i.code)) {
        seenCode.add(i.code);
        uniqueOnPage.push(i);
      }
    }
  }
  const siteAudit = auditOnPage(
    (pages ?? []).map((p) => ({
      url: p.url,
      title: null,
      metaDescription: null,
      canonical: p.canonical,
      noindex: ((p.issues ?? []) as SeoIssue[]).some((i) => i.code === "noindex"),
    })),
  );
  const googleBlocked = (access ?? []).some((a) => a.bot === "Googlebot" && !a.allowed);
  const anyNoindex = (pages ?? []).some((p) =>
    ((p.issues ?? []) as SeoIssue[]).some((i) => i.code === "noindex"),
  );
  const strategy = crawl
    ? buildStrategy({
        onPageIssues: uniqueOnPage,
        siteIssues: siteAudit.issues,
        technical: {
          noindex: anyNoindex,
          crawlerBlocked: googleBlocked,
          cwv: cwv ? { lcpMs: cwv.lcp_ms, inpMs: cwv.inp_ms, cls: cwv.cls } : null,
        },
        aeo: crawl.aeo_score != null ? { score: crawl.aeo_score } : null,
      })
    : null;

  const gradeColor: Record<string, string> = {
    A: "text-success",
    B: "text-success",
    C: "text-primary",
    D: "text-destructive",
    F: "text-destructive",
  };
  const impactBadge: Record<string, string> = {
    high: "bg-destructive/15 text-destructive",
    medium: "bg-primary/15 text-primary",
    low: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Crawl status, canonicals, snippet directives, and whether Googlebot and AI crawlers can reach the site.
        </p>
        <RunCrawlButton clientId={params.id} />
      </div>

      {strategy && (
        <Card>
          <CardHeader>
            <CardTitle>How to rank higher — SEO &amp; AEO strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-baseline gap-2">
                <span className={cn("text-4xl font-bold tabular-nums", gradeColor[strategy.grade])}>
                  {strategy.totalScore}
                </span>
                <span className="text-sm text-muted-foreground">/100</span>
                <span className={cn("ml-1 text-2xl font-semibold", gradeColor[strategy.grade])}>
                  {strategy.grade}
                </span>
              </div>
              <div className="flex gap-5 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Classic SEO</p>
                  <p className="font-semibold tabular-nums">{strategy.classicScore}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">AEO (AI answers)</p>
                  <p className="font-semibold tabular-nums">{strategy.aeoScore}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Technical</p>
                  <p className="font-semibold tabular-nums">{strategy.technicalScore}</p>
                </div>
              </div>
            </div>

            {strategy.actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{strategy.summary}</p>
            ) : (
              <ol className="space-y-3">
                {strategy.actions.slice(0, 12).map((a, idx) => (
                  <li key={a.title} className="flex gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.title}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] uppercase", impactBadge[a.impact])}>
                          {a.impact} impact
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {a.effort} effort
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {a.area}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{a.how}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

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
              <CardTitle>
                Pages ({crawl.page_count})
                {brokenCount > 0 && (
                  <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-normal text-destructive">
                    {brokenCount} broken
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 font-medium">URL</th>
                      <th className="px-2 py-1 font-medium">Status</th>
                      <th className="px-2 py-1 font-medium">Template</th>
                      <th className="px-2 py-1 font-medium">AEO</th>
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
                          <td className="px-2 py-1">
                            {p.aeo_score != null ? (
                              <span
                                className={cn(
                                  "tabular-nums",
                                  p.aeo_score >= 75 && "text-success",
                                  p.aeo_score < 50 && "text-destructive",
                                )}
                              >
                                {p.aeo_score}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
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
