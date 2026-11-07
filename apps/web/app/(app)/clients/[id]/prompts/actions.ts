"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePromptCsv, promptSchema, type PromptInput } from "@/lib/validation";

interface Result {
  error?: string;
  added?: number;
}

const MAX_PROMPTS = 300; // MVP cap (RS-102)

async function insertPrompts(clientId: string, prompts: PromptInput[]): Promise<Result> {
  const db = createClient();

  const { data: client } = await db
    .from("clients")
    .select("id, agency_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "Client not found" };

  const { count } = await db
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  const existing = count ?? 0;
  if (existing + prompts.length > MAX_PROMPTS) {
    return { error: `Prompt set is capped at ${MAX_PROMPTS} in the MVP (${existing} already)` };
  }

  const { error } = await db.from("prompts").insert(
    prompts.map((p) => ({
      agency_id: client.agency_id,
      client_id: clientId,
      text: p.text,
      topic: p.topic ?? null,
      intent: p.intent ?? null,
      priority: p.priority,
      search_volume: p.searchVolume,
    })),
  );
  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}/prompts`);
  return { added: prompts.length };
}

/** Add a single prompt manually. */
export async function addPromptAction(clientId: string, raw: unknown): Promise<Result> {
  const parsed = promptSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid prompt" };
  return insertPrompts(clientId, [parsed.data]);
}

/** Bulk import prompts from CSV text (text,topic,intent,search_volume). */
export async function importPromptsCsvAction(clientId: string, csv: string): Promise<Result> {
  const prompts = parsePromptCsv(csv);
  if (prompts.length === 0) return { error: "No valid rows found in CSV" };
  return insertPrompts(clientId, prompts);
}
