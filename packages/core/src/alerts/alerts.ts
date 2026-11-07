/**
 * Score-drop alert logic (RS-207) — pure and unit-tested.
 *
 * An alert fires when a client's Unified Visibility Score falls week-on-week by
 * at least the configured threshold (default −5 points), and no alert has
 * already fired for that client today (NFR: at most one alert per client/day).
 */

/** Default threshold: fire when UVS drops by 5 or more points week on week. */
export const DEFAULT_DROP_THRESHOLD = -5;

export interface AlertDecision {
  fired: boolean;
  /** current − previous (negative means a drop). */
  delta: number;
  reason: "no_previous" | "above_threshold" | "already_fired_today" | "dropped";
}

/**
 * Decide whether to fire a score-drop alert.
 *
 * @param current   latest UVS (0–100)
 * @param previous  UVS a week earlier, or null if there is no baseline yet
 * @param threshold negative points change that triggers (default −5)
 * @param lastFiredAt when the last alert fired for this client (dedup), or null
 * @param now        current time (injectable for tests)
 */
export function evaluateScoreDrop(
  current: number,
  previous: number | null,
  threshold: number = DEFAULT_DROP_THRESHOLD,
  lastFiredAt: Date | null = null,
  now: Date = new Date(),
): AlertDecision {
  if (previous == null) {
    return { fired: false, delta: 0, reason: "no_previous" };
  }
  const delta = round1(current - previous);
  if (delta > threshold) {
    return { fired: false, delta, reason: "above_threshold" };
  }
  if (lastFiredAt && sameUtcDay(lastFiredAt, now)) {
    return { fired: false, delta, reason: "already_fired_today" };
  }
  return { fired: true, delta, reason: "dropped" };
}

export function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
