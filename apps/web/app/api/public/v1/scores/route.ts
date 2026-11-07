import { authenticateApi, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/v1/scores?clientId=&from=&to= — daily UVS + share of voice
 * (scope scores:read). Overall rows only (engine_id null).
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateApi(request, "scores:read");
  if (!auth.ok) return apiError(auth.status, auth.error);

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let q = auth.db
    .from("scores_daily")
    .select("client_id, date, uvs, share_of_voice, confidence")
    .eq("agency_id", auth.agencyId)
    .is("engine_id", null)
    .is("topic", null)
    .order("date", { ascending: false })
    .limit(500);
  if (clientId) q = q.eq("client_id", clientId);
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);

  const { data, error } = await q;
  if (error) return apiError(500, error.message);
  return Response.json({ data });
}
