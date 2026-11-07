import type { Confidence, EngineCode } from "../types.js";

/** The causes the Why Engine v1 can diagnose (RS-205). */
export type CauseType =
  | "not_indexed"
  | "snippet_blocked"
  | "crawl_blocked"
  | "slow_template"
  | "competitor_cited"
  | "no_answering_page";

/**
 * Facts about one lost ranking or citation, assembled by the worker from crawl,
 * CWV, crawler-access, SERP and extraction data. All fields optional because the
 * Why Engine must degrade gracefully when a signal is missing.
 */
export interface LossContext {
  clientId: string;
  promptId: string;
  engine: EngineCode;
  /** The client URL we expected to rank/be cited, if one is mapped. */
  targetUrl?: string | null;

  /** Index / crawl facts (from crawl.ts + GSC). */
  indexedInGsc?: boolean;
  httpStatus?: number | null;
  robotsAllowed?: boolean; // robots.txt verdict for Googlebot
  metaRobotsNoindex?: boolean;
  nosnippet?: boolean;
  /** Bots blocked at the CDN / network layer (crawler-access.ts). */
  cdnBlockedBots?: string[];

  /** Core Web Vitals for the page's template (cwv-sync.ts). */
  cwv?: { lcpMs?: number; inpMs?: number; cls?: number } | null;

  /** Who got cited instead, and whether any client page addresses the prompt. */
  competitorCitedHosts?: string[];
  hasAnsweringPage?: boolean;

  /** Prior visibility so we can gauge impact. */
  searchVolume?: number;
  lostVisibility?: number; // 0..1, how much visibility dropped
}

export interface CauseEvidence {
  [key: string]: string | number | boolean | string[] | null;
}

export interface Cause {
  type: CauseType;
  /** Short human summary shown in the causes list. */
  summary: string;
  evidence: CauseEvidence;
  confidence: Confidence;
  /** Links to a row in the Google rules library (packages/rules). */
  ruleId: string;
  /** 0..1 strength of this diagnosis, used to rank competing causes. */
  score: number;
}

/** A single diagnostic rule: given the facts, maybe emit a cause. */
export interface WhyRule {
  type: CauseType;
  ruleId: string;
  evaluate: (ctx: LossContext) => Cause | null;
}
