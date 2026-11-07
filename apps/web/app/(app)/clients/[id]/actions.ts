"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface RunResult {
  error?: string;
  enqueued?: number;
}

/** "Run now" — enqueue a fresh collection for every prompt of a client (RS-103/104). */
export async function requestRunAction(clientId: string): Promise<RunResult> {
  const db = createClient();
  const { data, error } = await db.rpc("request_client_refresh", { p_client_id: clientId });
  if (error) return { error: error.message };
  revalidatePath(`/clients/${clientId}/visibility`);
  return { enqueued: data ?? 0 };
}
