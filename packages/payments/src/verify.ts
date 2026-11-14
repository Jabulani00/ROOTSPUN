import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook signature verification (RS-405) — node-only, unit-testable.
 * Kept out of @rootspun/core because core must stay browser-safe (no node:crypto).
 */

/** Paystack signs the raw body with HMAC-SHA512 of your secret key (x-paystack-signature). */
export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null | undefined,
  secretKey: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody, "utf8").digest("hex");
  return safeEqualHex(expected, signature);
}

export interface StripeVerifyOptions {
  toleranceSec?: number;
  /** Current unix seconds (injectable for tests). */
  now?: number;
}

/**
 * Stripe signs `${t}.${payload}` with HMAC-SHA256 of the signing secret; the
 * Stripe-Signature header carries `t=` and one or more `v1=` schemes. We also
 * enforce a timestamp tolerance to reject replays.
 */
export function verifyStripeSignature(
  payload: string,
  sigHeader: string | null | undefined,
  signingSecret: string,
  opts: StripeVerifyOptions = {},
): boolean {
  if (!sigHeader) return false;
  const parts: Record<string, string[]> = {};
  for (const kv of sigHeader.split(",")) {
    const idx = kv.indexOf("=");
    if (idx === -1) continue;
    const k = kv.slice(0, idx).trim();
    const v = kv.slice(idx + 1).trim();
    (parts[k] ??= []).push(v);
  }
  const t = Number(parts["t"]?.[0]);
  const v1List = parts["v1"] ?? [];
  if (!Number.isFinite(t) || v1List.length === 0) return false;

  const tolerance = opts.toleranceSec ?? 300;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > tolerance) return false;

  const expected = createHmac("sha256", signingSecret).update(`${t}.${payload}`, "utf8").digest("hex");
  return v1List.some((v1) => safeEqualHex(expected, v1));
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
