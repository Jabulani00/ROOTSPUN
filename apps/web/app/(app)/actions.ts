"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Sign the current user out (clears the session cookie) and return to sign-in. */
export async function signOutAction(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
