import type { Confidence } from "../types.js";
import type { Cause, LossContext, WhyRule } from "./types.js";

/** Google's "good" Core Web Vitals thresholds (RS-202). */
export const CWV_GOOD = { lcpMs: 2500, inpMs: 200, cls: 0.1 } as const;

function conf(score: number): Confidence {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/**
 * Rules are ordered by how fundamental the blocker is: if a page is not indexed
 * or crawl-blocked, nothing downstream matters. `diagnose()` runs them all and
 * ranks the results, but the ordering here also seeds tie-breaks.
 */
export const RULES: WhyRule[] = [
  // ── Not indexed ────────────────────────────────────────────────────────────
  {
    type: "not_indexed",
    ruleId: "rule.indexing.noindex",
    evaluate: (ctx: LossContext): Cause | null => {
      const metaNoindex = ctx.metaRobotsNoindex === true;
      const missingFromIndex = ctx.indexedInGsc === false;
      const bad404 =
        typeof ctx.httpStatus === "number" && ctx.httpStatus >= 400;
      if (!metaNoindex && !missingFromIndex && !bad404) return null;

      // A hard noindex / 4xx is near-certain; "not in GSC" alone is weaker.
      const score = metaNoindex || bad404 ? 0.92 : 0.6;
      return {
        type: "not_indexed",
        ruleId: "rule.indexing.noindex",
        summary: metaNoindex
          ? "Page carries a noindex directive, so Google will not rank it"
          : bad404
            ? `Page returns HTTP ${ctx.httpStatus}, so it cannot be indexed`
            : "Page is not present in Search Console's index",
        evidence: {
          metaRobotsNoindex: metaNoindex,
          httpStatus: ctx.httpStatus ?? null,
          indexedInGsc: ctx.indexedInGsc ?? null,
          targetUrl: ctx.targetUrl ?? null,
        },
        confidence: conf(score),
        score,
      };
    },
  },

  // ── Crawl blocked (robots.txt or CDN) ────────────────────────────────────────
  {
    type: "crawl_blocked",
    ruleId: "rule.crawl.blocked",
    evaluate: (ctx: LossContext): Cause | null => {
      const robotsBlocked = ctx.robotsAllowed === false;
      const cdnBlocked = (ctx.cdnBlockedBots ?? []).length > 0;
      if (!robotsBlocked && !cdnBlocked) return null;

      const score = robotsBlocked ? 0.9 : 0.75;
      return {
        type: "crawl_blocked",
        ruleId: "rule.crawl.blocked",
        summary: robotsBlocked
          ? "robots.txt disallows the crawler from fetching this URL"
          : `CDN/network is blocking: ${(ctx.cdnBlockedBots ?? []).join(", ")}`,
        evidence: {
          robotsAllowed: ctx.robotsAllowed ?? null,
          cdnBlockedBots: ctx.cdnBlockedBots ?? [],
          targetUrl: ctx.targetUrl ?? null,
        },
        confidence: conf(score),
        score,
      };
    },
  },

  // ── Snippet blocked (nosnippet / data-nosnippet) ─────────────────────────────
  {
    type: "snippet_blocked",
    ruleId: "rule.snippet.nosnippet",
    evaluate: (ctx: LossContext): Cause | null => {
      if (ctx.nosnippet !== true) return null;
      // A missing snippet mostly hurts AI surfaces that quote content.
      const score = 0.7;
      return {
        type: "snippet_blocked",
        ruleId: "rule.snippet.nosnippet",
        summary:
          "Page sets nosnippet, so AI Overviews/answers cannot quote it as a source",
        evidence: { nosnippet: true, engine: ctx.engine, targetUrl: ctx.targetUrl ?? null },
        confidence: conf(score),
        score,
      };
    },
  },

  // ── Slow template (Core Web Vitals) ──────────────────────────────────────────
  {
    type: "slow_template",
    ruleId: "rule.cwv.poor",
    evaluate: (ctx: LossContext): Cause | null => {
      const cwv = ctx.cwv;
      if (!cwv) return null;
      const failures: string[] = [];
      if (typeof cwv.lcpMs === "number" && cwv.lcpMs > CWV_GOOD.lcpMs)
        failures.push(`LCP ${Math.round(cwv.lcpMs)}ms > ${CWV_GOOD.lcpMs}ms`);
      if (typeof cwv.inpMs === "number" && cwv.inpMs > CWV_GOOD.inpMs)
        failures.push(`INP ${Math.round(cwv.inpMs)}ms > ${CWV_GOOD.inpMs}ms`);
      if (typeof cwv.cls === "number" && cwv.cls > CWV_GOOD.cls)
        failures.push(`CLS ${cwv.cls.toFixed(2)} > ${CWV_GOOD.cls}`);
      if (failures.length === 0) return null;

      // CWV is a ranking factor but rarely the sole cause — cap confidence.
      const score = Math.min(0.3 + failures.length * 0.15, 0.6);
      return {
        type: "slow_template",
        ruleId: "rule.cwv.poor",
        summary: `Page template fails Core Web Vitals: ${failures.join("; ")}`,
        evidence: {
          lcpMs: cwv.lcpMs ?? null,
          inpMs: cwv.inpMs ?? null,
          cls: cwv.cls ?? null,
          failures,
        },
        confidence: conf(score),
        score,
      };
    },
  },

  // ── No answering page ────────────────────────────────────────────────────────
  {
    type: "no_answering_page",
    ruleId: "rule.content.no_answer",
    evaluate: (ctx: LossContext): Cause | null => {
      if (ctx.hasAnsweringPage !== false) return null;
      const score = 0.78;
      return {
        type: "no_answering_page",
        ruleId: "rule.content.no_answer",
        summary: "No page on the site directly answers this prompt",
        evidence: { hasAnsweringPage: false, promptId: ctx.promptId },
        confidence: conf(score),
        score,
      };
    },
  },

  // ── Competitor cited instead ──────────────────────────────────────────────────
  {
    type: "competitor_cited",
    ruleId: "rule.content.competitor_cited",
    evaluate: (ctx: LossContext): Cause | null => {
      const hosts = ctx.competitorCitedHosts ?? [];
      if (hosts.length === 0) return null;
      // Only a strong signal when the client *could* have ranked (has a page, indexed).
      const clientCapable =
        ctx.hasAnsweringPage !== false && ctx.indexedInGsc !== false;
      const score = clientCapable ? 0.65 : 0.45;
      return {
        type: "competitor_cited",
        ruleId: "rule.content.competitor_cited",
        summary: `Competitors are cited instead: ${hosts.slice(0, 3).join(", ")}`,
        evidence: { competitorCitedHosts: hosts, engine: ctx.engine },
        confidence: conf(score),
        score,
      };
    },
  },
];
