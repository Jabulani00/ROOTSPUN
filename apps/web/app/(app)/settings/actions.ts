"use server";

import { revalidatePath } from "next/cache";
import { validateScopes, hexToHslTriplet, type Branding } from "@rootspun/core";
import { createClient } from "@/lib/supabase/server";
import { ensureAgencyId } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys";

/** RS-307 — save white-label branding (logo + brand colour) for the agency. */
export async function updateBrandingAction(input: Branding): Promise<{ error?: string }> {
  if (input.primary && !hexToHslTriplet(input.primary)) {
    return { error: "Brand colour must be a 6-digit hex like #2f9e6b" };
  }
  const agencyId = await ensureAgencyId();
  if (!agencyId) return { error: "No agency found" };

  const branding: Branding = {
    primary: input.primary?.trim() || undefined,
    logoUrl: input.logoUrl?.trim() || undefined,
    name: input.name?.trim() || undefined,
  };
  const db = createClient();
  const { error } = await db
    .from("agencies")
    .update({ branding: branding as Record<string, unknown> })
    .eq("id", agencyId);
  if (error) return { error: error.message };

  revalidatePath("/settings/branding");
  revalidatePath("/dashboard");
  return {};
}

/** RS-404 — mint a public API key. The plaintext is returned once and never stored. */
export async function createApiKeyAction(
  scopes: string[],
): Promise<{ error?: string; plaintext?: string }> {
  const check = validateScopes(scopes);
  if (!check.ok) return { error: `Unknown scopes: ${check.invalid.join(", ")}` };

  const agencyId = await ensureAgencyId();
  if (!agencyId) return { error: "No agency found" };

  const { plaintext, hash } = generateApiKey();
  const db = createClient();
  const { error } = await db
    .from("api_keys")
    .insert({ agency_id: agencyId, hash, scopes: scopes.length ? scopes : ["clients:read", "scores:read"] });
  if (error) return { error: error.message };

  revalidatePath("/settings/api");
  return { plaintext };
}

export async function revokeApiKeyAction(id: string): Promise<{ error?: string }> {
  const db = createClient();
  const { error } = await db.from("api_keys").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/api");
  return {};
}
