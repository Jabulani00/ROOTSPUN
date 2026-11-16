import { describe, expect, it } from "vitest";
import { organizationSchema, faqSchema, jsonLdScript } from "./snippets.js";

describe("organizationSchema", () => {
  it("builds valid Organization JSON-LD with a derived brand name and url", () => {
    const obj = JSON.parse(organizationSchema("www.asakhe-hardware.co.za"));
    expect(obj["@type"]).toBe("Organization");
    expect(obj.name).toBe("Asakhe Hardware");
    expect(obj.url).toBe("https://asakhe-hardware.co.za");
    expect(obj["@context"]).toBe("https://schema.org");
  });

  it("uses a supplied name when given", () => {
    expect(JSON.parse(organizationSchema("x.co", "Acme Ltd")).name).toBe("Acme Ltd");
  });
});

describe("faqSchema", () => {
  it("builds FAQPage JSON-LD from Q/A pairs", () => {
    const obj = JSON.parse(faqSchema([{ q: "What is X?", a: "X is a thing." }]));
    expect(obj["@type"]).toBe("FAQPage");
    expect(obj.mainEntity[0].name).toBe("What is X?");
    expect(obj.mainEntity[0].acceptedAnswer.text).toBe("X is a thing.");
  });

  it("emits a placeholder when no items are given", () => {
    expect(JSON.parse(faqSchema()).mainEntity).toHaveLength(1);
  });
});

describe("jsonLdScript", () => {
  it("wraps JSON in a ld+json script tag", () => {
    expect(jsonLdScript("{}")).toContain('type="application/ld+json"');
  });
});
