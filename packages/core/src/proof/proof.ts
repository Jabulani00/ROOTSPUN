/**
 * Proof loop (RS-401/402) — pure, testable lift measurement.
 *
 * When a fix ships, we freeze a baseline and, after 14 and 28 days, compare the
 * change on prompts the fix touched (treated) against a control group of
 * untouched prompts. Using difference-in-differences cancels out site-wide
 * movement (algorithm updates, seasonality), so the net lift is attributable to
 * the fix rather than the tide.
 */

export type LiftMetric = "uvs" | "citations" | "gsc_clicks";

export interface LiftInput {
  metric: LiftMetric;
  treatedBefore: number;
  treatedAfter: number;
  controlBefore: number;
  controlAfter: number;
}

export interface LiftResult {
  metric: LiftMetric;
  /** change in the treated group */
  treatedDelta: number;
  /** change in the control group (the "tide") */
  controlDelta: number;
  /** difference-in-differences: treatedDelta − controlDelta */
  netLift: number;
  /** net lift as a % of the treated baseline (null if baseline is 0) */
  netLiftPct: number | null;
}

/** Standard measurement windows after a fix ships. */
export const MEASUREMENT_WINDOWS_DAYS = [14, 28] as const;

export function computeLift(input: LiftInput): LiftResult {
  const treatedDelta = round2(input.treatedAfter - input.treatedBefore);
  const controlDelta = round2(input.controlAfter - input.controlBefore);
  const netLift = round2(treatedDelta - controlDelta);
  const netLiftPct =
    input.treatedBefore !== 0 ? round1((netLift / Math.abs(input.treatedBefore)) * 100) : null;
  return { metric: input.metric, treatedDelta, controlDelta, netLift, netLiftPct };
}

/** Whether a measurement window has fully elapsed since the fix shipped. */
export function windowElapsed(shippedAt: Date, windowDays: number, now: Date = new Date()): boolean {
  const elapsedDays = (now.getTime() - shippedAt.getTime()) / 86_400_000;
  return elapsedDays >= windowDays;
}

export interface FixTypeLift {
  fixType: string;
  netLift: number;
}

export interface RankedFixType {
  fixType: string;
  meanLift: number;
  n: number;
}

/**
 * RS-402 — rank fix types by mean observed net lift (anonymised across agencies).
 * Higher mean lift first; ties break by sample count so better-evidenced types win.
 */
export function rankFixTypesByLift(outcomes: FixTypeLift[]): RankedFixType[] {
  const byType = new Map<string, number[]>();
  for (const o of outcomes) {
    const list = byType.get(o.fixType) ?? [];
    list.push(o.netLift);
    byType.set(o.fixType, list);
  }
  return [...byType.entries()]
    .map(([fixType, lifts]) => ({
      fixType,
      meanLift: round2(lifts.reduce((a, b) => a + b, 0) / lifts.length),
      n: lifts.length,
    }))
    .sort((a, b) => b.meanLift - a.meanLift || b.n - a.n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
