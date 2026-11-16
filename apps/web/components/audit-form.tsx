"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, cn } from "@rootspun/ui";

const field =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface AuditAction {
  area: string;
  title: string;
  how: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
}
interface AuditResult {
  host: string;
  pagesCrawled: number;
  robotsFound: boolean;
  sitemapFound: boolean;
  crawlerAccess: { bot: string; allowed: boolean }[];
  schemaTypes: string[];
  starterSchema: string | null;
  score: number;
  grade: string;
  classicScore: number;
  aeoScore: number;
  technicalScore: number;
  summary: string;
  actions: AuditAction[];
}

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

export function AuditForm() {
  const [domain, setDomain] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [lead, setLead] = useState("");
  const [leadState, setLeadState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function captureLead(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    setLeadState("sending");
    try {
      const res = await fetch("/api/public/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: result.host, email: lead, competitors: [] }),
      });
      setLeadState(res.ok ? "sent" : "error");
    } catch {
      setLeadState("error");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setMessage(null);
    setResult(null);
    try {
      const res = await fetch("/api/public/audit/instant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(body.error ?? "Something went wrong");
        return;
      }
      setResult(body as AuditResult);
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error — please try again");
    }
  }

  if (state === "done" && result) {
    return (
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">SEO + AEO score for</p>
            <p className="font-medium">{result.host}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-baseline gap-1">
              <span className={cn("text-5xl font-bold tabular-nums", gradeColor[result.grade])}>{result.score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
              <span className={cn("ml-1 text-3xl font-semibold", gradeColor[result.grade])}>{result.grade}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Classic SEO</p>
                <p className="font-semibold tabular-nums">{result.classicScore}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AEO</p>
                <p className="font-semibold tabular-nums">{result.aeoScore}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Technical</p>
                <p className="font-semibold tabular-nums">{result.technicalScore}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className={cn("rounded-full px-2 py-1", result.robotsFound ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
              robots.txt {result.robotsFound ? "✓" : "—"}
            </span>
            <span className={cn("rounded-full px-2 py-1", result.sitemapFound ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
              sitemap {result.sitemapFound ? "✓" : "—"}
            </span>
            {result.crawlerAccess
              .filter((a) => ["GPTBot", "PerplexityBot", "ClaudeBot"].includes(a.bot))
              .map((a) => (
                <span key={a.bot} className={cn("rounded-full px-2 py-1", a.allowed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                  {a.allowed ? "✓" : "✗"} {a.bot}
                </span>
              ))}
          </div>

          <div className="text-xs">
            <span className="text-muted-foreground">Structured data: </span>
            {result.schemaTypes.length > 0 ? (
              <span>{result.schemaTypes.join(", ")}</span>
            ) : (
              <span className="text-destructive">none found — add JSON-LD schema</span>
            )}
          </div>

          {result.starterSchema && (
            <details className="rounded-lg border border-input bg-card p-3 text-xs">
              <summary className="cursor-pointer font-medium">Paste-ready starter schema (Organization)</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                {result.starterSchema}
              </pre>
              <p className="mt-1 text-muted-foreground">
                Drop this into your site&apos;s <code>&lt;head&gt;</code>, then add FAQPage/Product schema per page.
              </p>
            </details>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Top fixes to rank higher</p>
            <ol className="space-y-2">
              {result.actions.map((a, i) => (
                <li key={a.title} className="flex gap-2 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                    {i + 1}
                  </span>
                  <div>
                    <span className="font-medium">{a.title}</span>{" "}
                    <span className={cn("rounded px-1 py-0.5 text-[10px] uppercase", impactBadge[a.impact])}>{a.impact}</span>
                    <p className="text-xs text-muted-foreground">{a.how}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4 text-sm">
            <p className="font-medium">Want the full picture?</p>
            <p className="mb-3 text-muted-foreground">
              Track {result.host} across Google, AI Overviews, ChatGPT, Gemini and Perplexity — with
              competitor share of voice and the reasons behind every lost citation.
            </p>
            {leadState === "sent" ? (
              <p className="mb-3 text-success">Thanks — we&apos;ll send a full report and keep an eye on {result.host}. 🎉</p>
            ) : (
              <form onSubmit={captureLead} className="mb-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  required
                  className={field + " sm:flex-1"}
                  placeholder="you@company.com"
                  value={lead}
                  onChange={(e) => setLead(e.target.value)}
                  aria-label="Email for the full report"
                />
                <Button type="submit" size="sm" disabled={leadState === "sending"}>
                  {leadState === "sending" ? "Sending…" : "Email me the full report"}
                </Button>
              </form>
            )}
            {leadState === "error" && <p className="mb-2 text-xs text-destructive">Couldn&apos;t save that — try again.</p>}
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Start free with Rootspun
            </Link>
          </div>

          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => { setState("idle"); setResult(null); setDomain(""); }}
          >
            Audit another domain
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="domain" className="text-sm font-medium">Your domain</label>
            <input
              id="domain"
              required
              className={field}
              placeholder="yourbrand.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={state === "loading"}>
            {state === "loading" ? "Auditing your site…" : "Run my free audit"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Live crawl of your site — technical SEO + AI-answer readiness. No email, no credit card.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
