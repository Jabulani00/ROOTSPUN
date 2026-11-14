import { z } from "zod";

/** Validated worker environment. Fails fast on boot if a required secret is missing. */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SENTRY_DSN: z.string().optional(),
  // Provider keys are optional so the worker boots in dev without every integration.
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SERP_PROVIDER: z.enum(["dataforseo", "serpapi", "google_cse"]).default("dataforseo"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type WorkerEnv = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid worker environment: ${missing}`);
  }
  return parsed.data;
}
