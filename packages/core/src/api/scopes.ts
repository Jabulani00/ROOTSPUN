/**
 * Public API scope logic (RS-404) — pure and testable.
 *
 * Scopes are `resource:action`, e.g. `clients:read`, `scores:read`. A granted
 * scope may use `*` as a wildcard for the resource, the action, or the whole
 * scope (`*` or `*:*`).
 */

export const API_SCOPES = [
  "clients:read",
  "scores:read",
  "causes:read",
  "fixes:read",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** Does a set of granted scopes satisfy the required scope? */
export function hasScope(granted: string[], required: string): boolean {
  if (granted.includes("*") || granted.includes("*:*")) return true;
  if (granted.includes(required)) return true;

  const [reqRes, reqAct] = splitScope(required);
  return granted.some((g) => {
    const [res, act] = splitScope(g);
    return (res === reqRes || res === "*") && (act === reqAct || act === "*");
  });
}

function splitScope(scope: string): [string, string] {
  const idx = scope.indexOf(":");
  if (idx === -1) return [scope, "*"];
  return [scope.slice(0, idx), scope.slice(idx + 1)];
}

/** Extract the token from an `Authorization: Bearer <token>` header. */
export function parseBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1]!.trim() : null;
}

/** Validate that scopes requested when minting a key are known. */
export function validateScopes(scopes: string[]): { ok: boolean; invalid: string[] } {
  const known = new Set<string>([...API_SCOPES, "*", "*:*"]);
  const invalid = scopes.filter((s) => !known.has(s));
  return { ok: invalid.length === 0, invalid };
}
