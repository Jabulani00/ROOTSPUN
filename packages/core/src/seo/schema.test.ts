import { describe, expect, it } from "vitest";
import { auditSchema, detectSchemaTypes } from "./schema.js";

describe("detectSchemaTypes", () => {
  it("extracts single and array @type values across blocks", () => {
    const html = `
      <script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
      <script type="application/ld+json">{"@type":["Product","Offer"]}</script>`;
    expect(detectSchemaTypes(html).sort()).toEqual(["Offer", "Organization", "Product"]);
  });

  it("returns nothing when no JSON-LD is present", () => {
    expect(detectSchemaTypes("<p>no schema here</p>")).toEqual([]);
  });

  it("ignores @type outside ld+json scripts", () => {
    expect(detectSchemaTypes('<div>"@type": "Fake"</div>')).toEqual([]);
  });
});

describe("auditSchema", () => {
  it("reports present types and recommends missing high-value ones", () => {
    const html = `<script type="application/ld+json">{"@type":"Organization"}</script>`;
    const a = auditSchema(html);
    expect(a.hasAny).toBe(true);
    expect(a.present).toEqual(["Organization"]);
    expect(a.missing.map((m) => m.type)).toEqual(["FAQPage", "BreadcrumbList"]); // Organization satisfied
  });

  it("adds a Product recommendation for product pages that lack it", () => {
    const a = auditSchema("<p>no schema</p>", { isProductPage: true });
    expect(a.hasAny).toBe(false);
    expect(a.missing.map((m) => m.type)).toContain("Product");
  });

  it("does not recommend a type that is already present", () => {
    const html = `<script type="application/ld+json">{"@type":"FAQPage"}</script>`;
    expect(auditSchema(html).missing.map((m) => m.type)).not.toContain("FAQPage");
  });
});
