import { z } from "zod";

const hostname = z
  .string()
  .trim()
  .min(3)
  .transform((h) => h.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase())
  .refine((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h), "Enter a valid domain, e.g. example.com");

/** RS-101 — add a client with domains, brand terms and up to 10 competitors. */
export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  country: z.string().trim().length(2).default("ZA"),
  language: z.string().trim().min(2).max(5).default("en"),
  primaryDomain: hostname,
  competitors: z
    .array(z.object({ name: z.string().trim().min(1), host: hostname }))
    .max(10, "Up to 10 competitors")
    .default([]),
  brandTerms: z.array(z.string().trim().min(1)).max(20).default([]),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const PROMPT_INTENTS = ["informational", "commercial", "transactional", "navigational"] as const;

/** RS-102 — a single prompt in a prompt set. */
export const promptSchema = z.object({
  text: z.string().trim().min(3).max(500),
  topic: z.string().trim().max(80).optional(),
  intent: z.enum(PROMPT_INTENTS).optional(),
  priority: z.boolean().default(false),
  searchVolume: z.number().int().min(0).default(0),
});
export type PromptInput = z.infer<typeof promptSchema>;

/** Parse a CSV prompt import (header row: text,topic,intent,search_volume). */
export function parsePromptCsv(csv: string): PromptInput[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0]!.toLowerCase();
  const hasHeader = header.includes("text");
  const rows = hasHeader ? lines.slice(1) : lines;

  const out: PromptInput[] = [];
  for (const row of rows) {
    const cols = splitCsvRow(row);
    const parsed = promptSchema.safeParse({
      text: cols[0] ?? "",
      topic: cols[1] || undefined,
      intent: PROMPT_INTENTS.includes(cols[2] as never) ? cols[2] : undefined,
      searchVolume: cols[3] ? Number(cols[3]) || 0 : 0,
    });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/** Minimal CSV row splitter handling simple quoted fields. */
function splitCsvRow(row: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  result.push(cur.trim());
  return result;
}
