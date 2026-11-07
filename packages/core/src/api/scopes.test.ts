import { describe, expect, it } from "vitest";
import { hasScope, parseBearer, validateScopes } from "./scopes.js";

describe("hasScope", () => {
  it("matches an exact scope", () => {
    expect(hasScope(["clients:read"], "clients:read")).toBe(true);
    expect(hasScope(["clients:read"], "scores:read")).toBe(false);
  });

  it("honours the global wildcard", () => {
    expect(hasScope(["*"], "scores:read")).toBe(true);
    expect(hasScope(["*:*"], "fixes:read")).toBe(true);
  });

  it("honours a resource wildcard", () => {
    expect(hasScope(["clients:*"], "clients:read")).toBe(true);
    expect(hasScope(["clients:*"], "scores:read")).toBe(false);
  });

  it("honours an action wildcard", () => {
    expect(hasScope(["*:read"], "scores:read")).toBe(true);
    expect(hasScope(["*:read"], "scores:write")).toBe(false);
  });

  it("is false for an empty grant", () => {
    expect(hasScope([], "clients:read")).toBe(false);
  });
});

describe("parseBearer", () => {
  it("extracts the token", () => {
    expect(parseBearer("Bearer rsk_abc123")).toBe("rsk_abc123");
    expect(parseBearer("bearer   rsk_x")).toBe("rsk_x");
  });
  it("returns null when absent or malformed", () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("")).toBeNull();
    expect(parseBearer("Basic abc")).toBeNull();
  });
});

describe("validateScopes", () => {
  it("accepts known scopes and flags unknown ones", () => {
    expect(validateScopes(["clients:read", "*"]).ok).toBe(true);
    const r = validateScopes(["clients:read", "bogus:thing"]);
    expect(r.ok).toBe(false);
    expect(r.invalid).toEqual(["bogus:thing"]);
  });
});
