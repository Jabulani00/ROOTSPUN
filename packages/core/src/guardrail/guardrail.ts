/**
 * Fix Studio spam guardrail (RS-305) — pure, testable.
 *
 * Blocks content briefs that would produce what Google's spam policies penalise:
 *   - scaled content abuse   (mass-produced near-duplicate pages)
 *   - doorway abuse          (near-identical pages varying only by location)
 *   - site reputation abuse  (third-party content hosted to borrow authority)
 *
 * Each violation names the spam-policy rule id so the UI can cite it. The logic
 * is heuristic and deliberately transparent; thresholds are exported for tuning.
 */

export interface BriefPage {
  title: string;
  path?: string;
  /** Who writes/owns the page. Third-party content on the host triggers the policy. */
  author?: "first_party" | "third_party";
}

export interface FixBrief {
  pages: BriefPage[];
  hostDomain?: string;
}

export type SpamPattern = "scaled_content" | "doorway" | "site_reputation";

export interface GuardrailViolation {
  pattern: SpamPattern;
  ruleId: string;
  message: string;
  /** Indexes (into brief.pages) that triggered the violation. */
  pageIndexes: number[];
}

export interface GuardrailResult {
  allowed: boolean;
  violations: GuardrailViolation[];
}

// Tunable thresholds.
export const SCALED_MIN_PAGES = 10;
export const NEAR_DUP_CLUSTER_MIN = 5;
export const DOORWAY_MIN = 5;
export const JACCARD_SIMILAR = 0.6;

const RULE = {
  scaled_content: "rule.spam.scaled_content",
  doorway: "rule.spam.doorway",
  site_reputation: "rule.spam.site_reputation",
} as const;

/** Check a brief against the spam policies. */
export function checkBrief(brief: FixBrief): GuardrailResult {
  const violations: GuardrailViolation[] = [];

  const siteRep = detectSiteReputation(brief.pages);
  if (siteRep) violations.push(siteRep);

  const clusters = clusterNearDuplicates(brief.pages);

  const doorway = detectDoorway(brief.pages, clusters);
  if (doorway) violations.push(doorway);

  const scaled = detectScaledContent(brief.pages, clusters, Boolean(doorway));
  if (scaled) violations.push(scaled);

  return { allowed: violations.length === 0, violations };
}

function detectSiteReputation(pages: BriefPage[]): GuardrailViolation | null {
  const idx = pages.map((p, i) => (p.author === "third_party" ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) return null;
  return {
    pattern: "site_reputation",
    ruleId: RULE.site_reputation,
    message: `${idx.length} page(s) host third-party content on the client's own domain`,
    pageIndexes: idx,
  };
}

function detectDoorway(pages: BriefPage[], clusters: number[][]): GuardrailViolation | null {
  for (const cluster of clusters) {
    if (cluster.length < DOORWAY_MIN) continue;
    const varying = singleVaryingTokenIndexes(cluster.map((i) => pages[i]!.title));
    if (varying && varying.capitalizedShare >= 0.6) {
      return {
        pattern: "doorway",
        ruleId: RULE.doorway,
        message: `${cluster.length} near-identical pages differ only by a location/term — doorway pattern`,
        pageIndexes: cluster,
      };
    }
  }
  return null;
}

function detectScaledContent(
  pages: BriefPage[],
  clusters: number[][],
  doorwayAlreadyFlagged: boolean,
): GuardrailViolation | null {
  if (doorwayAlreadyFlagged) return null; // avoid double-citing the same cluster
  if (pages.length < SCALED_MIN_PAGES) return null;
  const biggest = clusters.reduce<number[]>((a, c) => (c.length > a.length ? c : a), []);
  if (biggest.length < NEAR_DUP_CLUSTER_MIN) return null;
  return {
    pattern: "scaled_content",
    ruleId: RULE.scaled_content,
    message: `${biggest.length} near-duplicate pages in a brief of ${pages.length} — scaled content pattern`,
    pageIndexes: biggest,
  };
}

// ── helpers ────────────────────────────────────────────────────────────────

function tokenize(title: string): string[] {
  return title.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Greedy clustering of pages by token-set Jaccard similarity. Returns index groups. */
export function clusterNearDuplicates(pages: BriefPage[]): number[][] {
  const sets = pages.map((p) => new Set(tokenize(p.title)));
  const used = new Array(pages.length).fill(false);
  const clusters: number[][] = [];
  for (let i = 0; i < pages.length; i++) {
    if (used[i]) continue;
    const cluster = [i];
    used[i] = true;
    for (let j = i + 1; j < pages.length; j++) {
      if (used[j]) continue;
      if (jaccard(sets[i]!, sets[j]!) >= JACCARD_SIMILAR) {
        cluster.push(j);
        used[j] = true;
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

/**
 * If all titles share the same token length and differ in exactly one position,
 * report that the varying tokens are mostly capitalized (place-like) in source.
 */
function singleVaryingTokenIndexes(
  titles: string[],
): { position: number; capitalizedShare: number } | null {
  const tokenRows = titles.map((t) => t.split(/\s+/).filter(Boolean));
  const len = tokenRows[0]!.length;
  if (!tokenRows.every((r) => r.length === len)) return null;

  const varyingPositions: number[] = [];
  for (let pos = 0; pos < len; pos++) {
    const vals = new Set(tokenRows.map((r) => r[pos]!.toLowerCase()));
    if (vals.size > 1) varyingPositions.push(pos);
  }
  if (varyingPositions.length !== 1) return null;

  const pos = varyingPositions[0]!;
  const capitalized = tokenRows.filter((r) => /^[A-Z]/.test(r[pos]!)).length;
  return { position: pos, capitalizedShare: capitalized / tokenRows.length };
}
