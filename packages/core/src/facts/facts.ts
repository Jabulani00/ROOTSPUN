/**
 * Entity-fact consistency (RS-302) — pure, testable.
 *
 * An agency enters canonical facts (name, address, founders, products…). We
 * compare them against values observed in AI answers and top cited pages and
 * list mismatches with their source. The LLM/web extraction of observed values
 * is external; this module is the deterministic comparison.
 */

export interface ObservedFact {
  field: string;
  value: string;
  source: string; // URL or engine the value came from
}

export interface FactIssue {
  field: string;
  expected: string;
  found: string;
  source: string;
}

export interface FactComparison {
  consistent: ObservedFact[];
  mismatches: FactIssue[];
  /** Canonical fields for which nothing was observed. */
  unverified: string[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter(Boolean));
}

/** Overlap coefficient relative to the shorter token set (order-insensitive). */
function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size);
}

/** Two values are considered the same fact if normalized-equal, a substring, or highly similar. */
export function valuesAgree(canonical: string, observed: string, threshold = 0.7): boolean {
  const a = normalize(canonical);
  const b = normalize(observed);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return similarity(canonical, observed) >= threshold;
}

/**
 * Compare observed facts against the canonical set. Each observed value for a
 * known field is either consistent or a mismatch; canonical fields with no
 * observation are unverified.
 */
export function compareFacts(
  canonical: Record<string, string>,
  observed: ObservedFact[],
  threshold = 0.7,
): FactComparison {
  const consistent: ObservedFact[] = [];
  const mismatches: FactIssue[] = [];
  const seenFields = new Set<string>();

  for (const obs of observed) {
    const expected = canonical[obs.field];
    if (expected == null) continue; // not a tracked canonical fact
    seenFields.add(obs.field);
    if (valuesAgree(expected, obs.value, threshold)) {
      consistent.push(obs);
    } else {
      mismatches.push({ field: obs.field, expected, found: obs.value, source: obs.source });
    }
  }

  const unverified = Object.keys(canonical).filter((f) => !seenFields.has(f));
  return { consistent, mismatches, unverified };
}
