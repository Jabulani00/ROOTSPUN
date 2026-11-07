import type { Cause, LossContext } from "./types.js";
import { RULES } from "./rules.js";

/**
 * Run every Why-Engine rule over a loss context and return the candidate causes,
 * most likely first. Impact (search volume × lost visibility) is used only by the
 * UI for list ordering; here we rank purely by diagnostic strength so the "most
 * likely cause" (RS-205 / FR-16) is deterministic and testable.
 *
 * Ties break by rule order in RULES (fundamental blockers first).
 */
export function diagnose(ctx: LossContext): Cause[] {
  const causes: Cause[] = [];
  RULES.forEach((rule, idx) => {
    const cause = rule.evaluate(ctx);
    if (cause) {
      // fold rule order into the score as a tiny tie-breaker (earlier = higher)
      causes.push({ ...cause, score: cause.score + (RULES.length - idx) * 1e-6 });
    }
  });
  return causes.sort((a, b) => b.score - a.score).map(stripTieBreak);
}

/** The single most likely cause, or null if nothing fired. */
export function mostLikelyCause(ctx: LossContext): Cause | null {
  return diagnose(ctx)[0] ?? null;
}

/**
 * Impact score for list ordering (RS-206): search volume × lost visibility.
 * Prompts with no volume still get a floor so they are not hidden entirely.
 */
export function impactScore(ctx: LossContext): number {
  const volume = Math.max(ctx.searchVolume ?? 0, 1);
  const lost = clamp01(ctx.lostVisibility ?? 1);
  return volume * lost;
}

function stripTieBreak(c: Cause): Cause {
  return { ...c, score: Math.round(c.score * 1000) / 1000 };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
