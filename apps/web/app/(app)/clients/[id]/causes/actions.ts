"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Status = "new" | "accepted" | "dismissed";

/** RS-206 — mark a cause accepted or dismissed during triage. */
export async function setCauseStatusAction(
  clientId: string,
  causeId: string,
  status: Status,
): Promise<{ error?: string }> {
  const db = createClient();
  const { error } = await db.from("causes").update({ status }).eq("id", causeId);
  if (error) return { error: error.message };
  revalidatePath(`/clients/${clientId}/causes`);
  return {};
}
