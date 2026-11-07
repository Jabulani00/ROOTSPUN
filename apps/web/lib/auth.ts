import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user, or null. Cached per request. */
export const getUser = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Return the user's active agency id, creating one on first login so a fresh
 * account can immediately add a client (NFR-14, 15-minute onboarding).
 * Relies on the RLS insert policies: authenticated users may create an agency
 * and their own owner membership.
 */
export const ensureAgencyId = cache(async (): Promise<string | null> => {
  const supabase = createClient();
  const user = await getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("memberships")
    .select("agency_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing?.agency_id) return existing.agency_id;

  // Bootstrap: create the agency, then the owner membership.
  const agencyName = user.email ? `${user.email.split("@")[0]}'s agency` : "My agency";
  const { data: agency, error: agencyErr } = await supabase
    .from("agencies")
    .insert({ name: agencyName })
    .select("id")
    .single();
  if (agencyErr || !agency) return null;

  await supabase
    .from("memberships")
    .insert({ agency_id: agency.id, user_id: user.id, role: "owner" });
  return agency.id;
});
