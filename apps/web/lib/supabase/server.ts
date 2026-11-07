import { cookies } from "next/headers";
import { serverClient, type RootspunClient } from "@rootspun/db";

/**
 * Supabase client for Server Components and Route Handlers. Reads and refreshes
 * the user's session from cookies; every query runs under RLS.
 */
export function createClient(): RootspunClient {
  const cookieStore = cookies();
  return serverClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) => {
      try {
        toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      } catch {
        // Called from a Server Component where cookies are read-only — the
        // middleware refresh handles session writes, so this is safe to ignore.
      }
    },
  });
}
