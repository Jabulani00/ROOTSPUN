import { describe, expect, it } from "vitest";
import { DEFAULT_DROP_THRESHOLD, evaluateScoreDrop, sameUtcDay } from "./alerts.js";

const now = new Date("2026-03-10T12:00:00Z");

describe("evaluateScoreDrop", () => {
  it("does not fire without a previous baseline", () => {
    const d = evaluateScoreDrop(70, null, DEFAULT_DROP_THRESHOLD, null, now);
    expect(d.fired).toBe(false);
    expect(d.reason).toBe("no_previous");
  });

  it("does not fire when the drop is smaller than the threshold", () => {
    // drop of 3 points, threshold -5 → not enough
    const d = evaluateScoreDrop(67, 70, -5, null, now);
    expect(d.fired).toBe(false);
    expect(d.reason).toBe("above_threshold");
    expect(d.delta).toBe(-3);
  });

  it("fires on a drop at or past the threshold", () => {
    const d = evaluateScoreDrop(64, 70, -5, null, now);
    expect(d.fired).toBe(true);
    expect(d.reason).toBe("dropped");
    expect(d.delta).toBe(-6);
  });

  it("fires exactly at the threshold boundary", () => {
    const d = evaluateScoreDrop(65, 70, -5, null, now);
    expect(d.fired).toBe(true);
    expect(d.delta).toBe(-5);
  });

  it("does not fire twice on the same UTC day", () => {
    const firedEarlierToday = new Date("2026-03-10T06:00:00Z");
    const d = evaluateScoreDrop(60, 70, -5, firedEarlierToday, now);
    expect(d.fired).toBe(false);
    expect(d.reason).toBe("already_fired_today");
  });

  it("fires again on a new day", () => {
    const firedYesterday = new Date("2026-03-09T23:00:00Z");
    const d = evaluateScoreDrop(60, 70, -5, firedYesterday, now);
    expect(d.fired).toBe(true);
  });

  it("treats a rise as above threshold", () => {
    const d = evaluateScoreDrop(80, 70, -5, null, now);
    expect(d.fired).toBe(false);
    expect(d.delta).toBe(10);
  });
});

describe("sameUtcDay", () => {
  it("compares calendar days in UTC", () => {
    expect(sameUtcDay(new Date("2026-03-10T00:00:00Z"), new Date("2026-03-10T23:59:00Z"))).toBe(true);
    expect(sameUtcDay(new Date("2026-03-10T23:59:00Z"), new Date("2026-03-11T00:01:00Z"))).toBe(false);
  });
});
