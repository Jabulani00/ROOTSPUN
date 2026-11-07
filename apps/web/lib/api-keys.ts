import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * API key handling (RS-404 / NFR-01). The plaintext key is shown to the user
 * exactly once; only its SHA-256 hash is stored, so a DB leak never exposes a
 * usable key. Keys are prefixed `rsk_` for easy identification in logs/secrets.
 */
export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `rsk_${randomBytes(24).toString("base64url")}`;
  return { plaintext, hash: hashApiKey(plaintext) };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
