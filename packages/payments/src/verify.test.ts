import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaystackSignature, verifyStripeSignature } from "./verify.js";
import { PLANS, planRunLimit } from "./plans.js";

const paystackSig = (body: string, key: string) =>
  createHmac("sha512", key).update(body, "utf8").digest("hex");

const stripeHeader = (payload: string, secret: string, t: number) => {
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
};

describe("verifyPaystackSignature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { id: 1 } });
  const key = "sk_test_secret";

  it("accepts a correct signature", () => {
    expect(verifyPaystackSignature(body, paystackSig(body, key), key)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyPaystackSignature(body + " ", paystackSig(body, key), key)).toBe(false);
  });
  it("rejects a wrong secret", () => {
    expect(verifyPaystackSignature(body, paystackSig(body, key), "sk_wrong")).toBe(false);
  });
  it("rejects a missing signature", () => {
    expect(verifyPaystackSignature(body, null, key)).toBe(false);
    expect(verifyPaystackSignature(body, undefined, key)).toBe(false);
  });
});

describe("verifyStripeSignature", () => {
  const payload = JSON.stringify({ type: "invoice.paid" });
  const secret = "whsec_test";
  const now = 1_700_000_000;

  it("accepts a correct, in-tolerance signature", () => {
    const header = stripeHeader(payload, secret, now);
    expect(verifyStripeSignature(payload, header, secret, { now })).toBe(true);
  });
  it("rejects an expired timestamp", () => {
    const header = stripeHeader(payload, secret, now - 10_000);
    expect(verifyStripeSignature(payload, header, secret, { now, toleranceSec: 300 })).toBe(false);
  });
  it("rejects a bad v1 digest", () => {
    const header = `t=${now},v1=deadbeef`;
    expect(verifyStripeSignature(payload, header, secret, { now })).toBe(false);
  });
  it("rejects malformed or missing headers", () => {
    expect(verifyStripeSignature(payload, null, secret, { now })).toBe(false);
    expect(verifyStripeSignature(payload, "nonsense", secret, { now })).toBe(false);
  });
  it("accepts when any v1 scheme matches", () => {
    const good = stripeHeader(payload, secret, now).split("v1=")[1]!;
    const header = `t=${now},v1=deadbeef,v1=${good}`;
    expect(verifyStripeSignature(payload, header, secret, { now })).toBe(true);
  });
});

describe("plans", () => {
  it("exposes three plans with ascending limits", () => {
    expect(PLANS.starter.promptRunsPerMonth).toBeLessThan(PLANS.growth.promptRunsPerMonth);
    expect(PLANS.growth.promptRunsPerMonth).toBeLessThan(PLANS.scale.promptRunsPerMonth);
    expect(planRunLimit("growth")).toBe(200_000);
  });
});
