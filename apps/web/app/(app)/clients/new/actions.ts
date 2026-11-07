"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureAgencyId } from "@/lib/auth";
import { clientSchema } from "@/lib/validation";

export interface ActionError {
  error: string;
}

/** RS-101 — create a client plus its primary domain, competitors and brand terms. */
export async function createClientAction(raw: unknown): Promise<ActionError | void> {
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const agencyId = await ensureAgencyId();
  if (!agencyId) return { error: "No agency found for this account" };

  const db = createClient();

  // Reject duplicate primary domain within the agency (RS-101).
  const { data: dupe } = await db
    .from("domains")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("host", input.primaryDomain)
    .limit(1)
    .maybeSingle();
  if (dupe) return { error: `Domain ${input.primaryDomain} is already tracked` };

  const { data: client, error } = await db
    .from("clients")
    .insert({ agency_id: agencyId, name: input.name, country: input.country, language: input.language })
    .select("id")
    .single();
  if (error || !client) return { error: error?.message ?? "Could not create client" };

  await db.from("domains").insert({
    agency_id: agencyId,
    client_id: client.id,
    host: input.primaryDomain,
    is_primary: true,
  });

  if (input.competitors.length > 0) {
    await db.from("competitors").insert(
      input.competitors.map((c) => ({
        agency_id: agencyId,
        client_id: client.id,
        name: c.name,
        host: c.host,
      })),
    );
  }

  if (input.brandTerms.length > 0) {
    await db.from("brand_terms").insert(
      input.brandTerms.map((term) => ({
        agency_id: agencyId,
        client_id: client.id,
        term,
        type: "brand" as const,
      })),
    );
  }

  revalidatePath("/dashboard");
  redirect(`/clients/${client.id}/visibility`);
}
