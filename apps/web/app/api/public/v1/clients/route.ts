import { authenticateApi, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/public/v1/clients — list the agency's clients (scope clients:read). */
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticateApi(request, "clients:read");
  if (!auth.ok) return apiError(auth.status, auth.error);

  const { data, error } = await auth.db
    .from("clients")
    .select("id, name, country, language, created_at")
    .eq("agency_id", auth.agencyId)
    .order("name");
  if (error) return apiError(500, error.message);

  return Response.json({ data });
}
