import { createBrowserClient, createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";

export type { Database } from "./types.js";
export type { Tables } from "./types.js";
export type RootspunClient = SupabaseClient<Database>;

// `@supabase/ssr` bundles its own copy of the supabase-js client type, which can
// differ by patch from the top-level one and trip structural-equality on the
// generic defaults. Normalising through this helper keeps call sites fully typed
// (the client is still SupabaseClient<Database>) without leaking the skew.
const asClient = (c: unknown): RootspunClient => c as RootspunClient;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/**
 * Browser client — uses the anon key and the user's session. RLS enforces
 * tenant isolation, so this is safe to run client-side (NFR-01).
 */
export function browserClient(): RootspunClient {
  // These MUST be static `process.env.NEXT_PUBLIC_*` references so Next.js inlines
  // them into the browser bundle at build time — dynamic access (process.env[name])
  // is left undefined in the browser.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return asClient(createBrowserClient<Database>(url, anon));
}

/**
 * Server client for Next.js Server Components / Route Handlers. Pass the cookie
 * adapter from `next/headers` so the user's session is read and refreshed.
 */
export function serverClient(cookies: CookieMethodsServer): RootspunClient {
  return asClient(
    createServerClient<Database>(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      { cookies },
    ),
  );
}

/**
 * Service-role client — bypasses RLS. MUST only be used in the worker or trusted
 * server code, NEVER shipped to the browser (NFR-01). Importing this into client
 * bundles will leak the key, so keep it out of "use client" modules.
 */
export function serviceClient(): RootspunClient {
  return asClient(
    createClient<Database>(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  );
}
