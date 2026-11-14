import { describe, expect, it } from "vitest";
import { compareFacts, valuesAgree } from "./facts.js";

describe("valuesAgree", () => {
  it("treats normalized-equal and substring values as agreeing", () => {
    expect(valuesAgree("Acme Inc.", "acme inc")).toBe(true);
    expect(valuesAgree("Acme Incorporated", "Acme")).toBe(true);
    expect(valuesAgree("123 Main St, Cape Town", "123 main street cape town", 0.6)).toBe(true);
  });
  it("rejects clearly different values", () => {
    expect(valuesAgree("Acme Inc.", "Globex Corporation")).toBe(false);
    expect(valuesAgree("Jane Doe", "John Smith")).toBe(false);
  });
  it("is false for empty input", () => {
    expect(valuesAgree("", "anything")).toBe(false);
    expect(valuesAgree("x", "")).toBe(false);
  });
});

describe("compareFacts", () => {
  const canonical = {
    name: "Acme Inc.",
    founder: "Jane Doe",
    hq: "Cape Town",
  };

  it("splits observed facts into consistent and mismatched", () => {
    const r = compareFacts(canonical, [
      { field: "name", value: "Acme Inc", source: "chatgpt" },
      { field: "founder", value: "John Smith", source: "https://wiki.example/acme" },
      { field: "hq", value: "Cape Town, South Africa", source: "gemini" },
    ]);
    expect(r.consistent.map((c) => c.field).sort()).toEqual(["hq", "name"]);
    expect(r.mismatches).toHaveLength(1);
    expect(r.mismatches[0]).toMatchObject({
      field: "founder",
      expected: "Jane Doe",
      found: "John Smith",
      source: "https://wiki.example/acme",
    });
  });

  it("reports canonical fields with no observation as unverified", () => {
    const r = compareFacts(canonical, [{ field: "name", value: "Acme Inc.", source: "x" }]);
    expect(r.unverified.sort()).toEqual(["founder", "hq"]);
  });

  it("ignores observed facts for untracked fields", () => {
    const r = compareFacts(canonical, [{ field: "revenue", value: "$1M", source: "x" }]);
    expect(r.consistent).toEqual([]);
    expect(r.mismatches).toEqual([]);
    expect(r.unverified.length).toBe(3);
  });
});
