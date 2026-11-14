import { verifyStripeSignature, type PlanId } from "@rootspun/payments";
import { serviceClient } from "@rootspun/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RS-405 — Stripe webhook (rest of world). Verifies the signed payload, then
 * updates the agency's subscription. agency_id and plan travel as subscription
 * metadata set at checkout.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = JSON.parse(raw) as {
    type: string;
    data?: {
      object?: {
        metadata?: { agency_id?: string; plan?: string };
        status?: string;
        current_period_end?: number;
      };
    };
  };
  const obj = event.data?.object;
  const agencyId = obj?.metadata?.agency_id;
  if (!agencyId) return Response.json({ ok: true, note: "no agency_id in metadata" });

  const canceled = event.type === "customer.subscription.deleted";
  const failed = event.type === "invoice.payment_failed";
  const status = canceled ? "canceled" : failed ? "past_due" : (obj?.status ?? "active");
  const plan = normalizePlan(obj?.metadata?.plan);
  const periodEnd = obj?.current_period_end
    ? new Date(obj.current_period_end * 1000).toISOString()
    : null;

  const db = serviceClient();
  await db
    .from("subscriptions")
    .upsert(
      { agency_id: agencyId, provider: "stripe", plan, status, period_end: periodEnd },
      { onConflict: "agency_id" },
    );

  return Response.json({ ok: true });
}

function normalizePlan(name?: string): PlanId {
  const n = (name ?? "").toLowerCase();
  if (n.includes("scale")) return "scale";
  if (n.includes("growth")) return "growth";
  return "starter";
}
