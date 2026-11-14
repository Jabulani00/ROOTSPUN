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

  // Bootstrap via a SECURITY DEFINER function to avoid the RLS chicken-and-egg
  // (can't read back a just-inserted agency before the membership exists).
  const agencyName = user.email ? `${user.email.split("@")[0]}'s agency` : "My agency";
  const { data: newId, error } = await supabase.rpc("bootstrap_agency", { p_name: agencyName });
  if (error || !newId) return null;
  return newId as string;
});
