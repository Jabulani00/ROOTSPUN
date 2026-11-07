import { z } from "zod";
import { normalizeHost } from "@rootspun/core";
import { serviceClient } from "@rootspun/db";
import { apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MAX_PER_IP_PER_DAY = 3;

const bodySchema = z.object({
  domain: z.string().min(3),
  email: z.string().email(),
  competitors: z.array(z.string().min(3)).max(3).default([]),
});

/** RS-406 — accept a free-audit request, rate-limited per IP, and queue it. */
export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const domain = normalizeHost(parsed.data.domain);
  const competitors = parsed.data.competitors.map(normalizeHost).filter(Boolean);

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const db = serviceClient();

  // Abuse limit: no more than MAX_PER_IP_PER_DAY in the last 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("audit_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_IP_PER_DAY) {
    return apiError(429, "Daily audit limit reached for this network — try again tomorrow.");
  }

  const { data, error } = await db
    .from("audit_requests")
    .insert({ domain, email: parsed.data.email, competitors, ip, status: "queued" })
    .select("id")
    .single();
  if (error || !data) return apiError(500, error?.message ?? "Could not queue audit");

  // TODO(phase4): enqueue a lightweight audit job (20 prompts × 3 engines) and
  // email the result with a sign-up link.
  return Response.json({ ok: true, id: data.id, domain });
}
