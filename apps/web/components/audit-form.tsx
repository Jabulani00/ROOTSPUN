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
const gradeVerdict: Record<string, string> = {
  A: "Excellent — you're ahead of most sites.",
  B: "Good — a few fixes will push you further.",
  C: "Fair — clear gaps are holding you back.",
  D: "Needs work — several issues are limiting visibility.",
  F: "Critical — major blockers to fix first.",
};

/** Circular score gauge. */
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="9" className="text-border" stroke="currentColor" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={cn("transition-all", gradeColor[grade])}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={cn("text-3xl font-bold leading-none tabular-nums", gradeColor[grade])}>{score}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">of 100</div>
          <div className={cn("mt-0.5 text-sm font-semibold", gradeColor[grade])}>Grade {grade}</div>
        </div>
      </div>
    </div>
  );
}

/** Labeled score bar. */
function ScoreBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  const color = value >= 75 ? "bg-success" : value >= 50 ? "bg-primary" : "bg-destructive";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** A compact labelled statistic tile. */
function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-xl font-semibold tabular-nums", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>
        {value}
      </p>
    </div>
  );
}

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
    const highCount = result.actions.filter((a) => a.impact === "high").length;
    const medCount = result.actions.filter((a) => a.impact === "medium").length;
    const lowCount = result.actions.filter((a) => a.impact === "low").length;
    const searchBots = ["Googlebot", "Bingbot", "Google-Extended"];
    const aiBots = ["GPTBot", "PerplexityBot", "ClaudeBot"];
    const botRow = (names: string[]) =>
      result.crawlerAccess
        .filter((a) => names.includes(a.bot))
        .map((a) => (
          <span
            key={a.bot}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
              a.allowed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {a.allowed ? "✓" : "✗"} {a.bot}
          </span>
        ));

    return (
      <Card>
        <CardContent className="space-y-6 p-6">
          {/* Report header */}
          <div className="flex items-center justify-between gap-3 border-b pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">SEO &amp; AEO audit report</p>
              <p className="text-lg font-semibold">{result.host}</p>
              <p className="text-xs text-muted-foreground">Live crawl of {result.pagesCrawled} pages · just now</p>
            </div>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Rootspun</span>
          </div>

          {/* Score + breakdown */}
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <ScoreRing score={result.score} grade={result.grade} />
            <div className="flex-1 space-y-3 self-stretch">
              <p className="text-sm text-muted-foreground">{gradeVerdict[result.grade]}</p>
              <ScoreBar label="Classic SEO" value={result.classicScore} hint="Indexability, titles, meta, headings, canonicals, links" />
              <ScoreBar label="AEO · AI answers" value={result.aeoScore} hint="Lead answer, question headings, FAQ schema, lists" />
              <ScoreBar label="Technical" value={result.technicalScore} hint="Crawlability, mobile, Core Web Vitals" />
            </div>
          </div>

          {/* At a glance */}
          <div>
            <p className="mb-2 text-sm font-semibold">At a glance</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Pages crawled" value={result.pagesCrawled} />
              <Stat label="Structured data" value={result.schemaTypes.length || "none"} tone={result.schemaTypes.length ? "good" : "bad"} />
              <Stat label="High-priority fixes" value={highCount} tone={highCount ? "bad" : "good"} />
              <Stat label="Total fixes" value={result.actions.length} />
            </div>
          </div>

          {/* Crawler access matrix */}
          <div>
            <p className="mb-2 text-sm font-semibold">Crawler access</p>
            <div className="space-y-2 rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-1 text-xs", result.robotsFound ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                  robots.txt {result.robotsFound ? "found" : "missing"}
                </span>
                <span className={cn("rounded-full px-2.5 py-1 text-xs", result.sitemapFound ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                  sitemap {result.sitemapFound ? "found" : "missing"}
                </span>
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Search engines</p>
                <div className="flex flex-wrap gap-2">{botRow(searchBots)}</div>
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">AI answer engines</p>
                <div className="flex flex-wrap gap-2">{botRow(aiBots)}</div>
              </div>
            </div>
          </div>

          {/* Structured data */}
          <div>
            <p className="mb-2 text-sm font-semibold">Structured data</p>
            {result.schemaTypes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {result.schemaTypes.map((t) => (
                  <span key={t} className="rounded-full bg-success/15 px-2.5 py-1 text-xs text-success">{t}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-destructive">None found — pages have no JSON-LD schema for engines or AI to parse.</p>
            )}
            {result.starterSchema && (
              <details className="mt-2 rounded-lg border bg-muted/40 p-3 text-xs">
                <summary className="cursor-pointer font-medium">Paste-ready starter schema (Organization)</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{result.starterSchema}</pre>
                <p className="mt-1 text-muted-foreground">
                  Drop this into your site&apos;s <code>&lt;head&gt;</code>, then add FAQPage/Product schema per page.
                </p>
              </details>
            )}
          </div>

          {/* Prioritised fixes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Prioritised fixes</p>
              <p className="text-xs text-muted-foreground">
                {highCount} high · {medCount} medium · {lowCount} low
              </p>
            </div>
            <ol className="space-y-2">
              {result.actions.map((a, i) => (
                <li key={a.title} className="flex gap-3 rounded-lg border bg-card p-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{a.title}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] uppercase", impactBadge[a.impact])}>{a.impact} impact</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{a.effort} effort</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{a.area}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{a.how}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Lead capture + CTA */}
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
            onClick={() => { setState("idle"); setResult(null); setDomain(""); setLead(""); setLeadState("idle"); }}
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
