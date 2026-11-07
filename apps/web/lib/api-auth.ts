import "server-only";
import { hasScope, parseBearer } from "@rootspun/core";
import { serviceClient, type RootspunClient } from "@rootspun/db";
import { hashApiKey } from "./api-keys";

export interface ApiAuthOk {
  ok: true;
  agencyId: string;
  db: RootspunClient;
}
export interface ApiAuthErr {
  ok: false;
  status: number;
  error: string;
}

/**
 * Authenticate a public-API request by its Bearer key and required scope.
 * Looks the key up by hash with the service-role client (the request is not an
 * agency session), checks scope, and records last_used_at. Returns an
 * agency-scoped handle the caller filters every query by.
 */
export async function authenticateApi(
  request: Request,
  requiredScope: string,
): Promise<ApiAuthOk | ApiAuthErr> {
  const token = parseBearer(request.headers.get("authorization"));
  if (!token) return { ok: false, status: 401, error: "Missing Bearer token" };

  const db = serviceClient();
  const { data: key } = await db
    .from("api_keys")
    .select("id, agency_id, scopes")
    .eq("hash", hashApiKey(token))
    .maybeSingle();
  if (!key) return { ok: false, status: 401, error: "Invalid API key" };
  if (!hasScope(key.scopes, requiredScope)) {
    return { ok: false, status: 403, error: `Key is missing scope: ${requiredScope}` };
  }

  await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
  return { ok: true, agencyId: key.agency_id, db };
}

/** Standard JSON error response for the public API. */
export function apiError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
