import { verifyPaystackSignature, type PlanId } from "@rootspun/payments";
import { serviceClient } from "@rootspun/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RS-405 — Paystack webhook (South Africa). Verifies the HMAC-SHA512 signature,
 * then updates the agency's subscription. The agency id and plan are passed as
 * transaction metadata at checkout (metadata.agency_id / metadata.plan).
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  const event = JSON.parse(raw) as {
    event: string;
    data?: { metadata?: { agency_id?: string; plan?: string }; plan?: { name?: string } };
  };
  const agencyId = event.data?.metadata?.agency_id;
  if (!agencyId) return Response.json({ ok: true, note: "no agency_id in metadata" });

  const status =
    event.event === "subscription.disable" || event.event === "invoice.payment_failed"
      ? "past_due"
      : "active";
  const plan = normalizePlan(event.data?.metadata?.plan ?? event.data?.plan?.name);

  const db = serviceClient();
  await db
    .from("subscriptions")
    .upsert({ agency_id: agencyId, provider: "paystack", plan, status }, { onConflict: "agency_id" });

  return Response.json({ ok: true });
}

function normalizePlan(name?: string): PlanId {
  const n = (name ?? "").toLowerCase();
  if (n.includes("scale")) return "scale";
  if (n.includes("growth")) return "growth";
  return "starter";
}
