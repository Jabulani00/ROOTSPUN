/**
 * Structured-data (schema.org) detection (AEO/FR-12) — pure, testable.
 *
 * AEO scoring already asks "is there any JSON-LD?"; this says *which* types are
 * declared (Organization, Product, FAQPage, LocalBusiness, Article, …) and which
 * high-value types are missing. Rich results and AI answers lean on the right
 * schema for the page's purpose, so naming the gap is far more actionable than a
 * yes/no. Regex over the JSON-LD blocks — no DOM, no JSON schema validation.
 */

/** Pull every `@type` value out of a page's JSON-LD blocks. */
export function detectSchemaTypes(html: string): string[] {
  const blocks = [...html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  const types = new Set<string>();
  for (const b of blocks) {
    const body = b[1] ?? "";
    // "@type": "Product"  or  "@type": ["Product","Offer"]
    for (const m of body.matchAll(/"@type"\s*:\s*(?:"([^"]+)"|\[([^\]]+)\])/gi)) {
      if (m[1]) types.add(m[1].trim());
      else if (m[2]) {
        for (const t of m[2].split(",")) {
          const cleaned = t.replace(/["'\s]/g, "");
          if (cleaned) types.add(cleaned);
        }
      }
    }
  }
  return [...types];
}

/** High-value schema types worth recommending when absent, with why. */
const VALUABLE_SCHEMA: { type: string; why: string }[] = [
  { type: "Organization", why: "establishes your brand entity for Google's Knowledge Graph and AI answers" },
  { type: "FAQPage", why: "lets AI answers and rich results lift your Q&A directly" },
  { type: "BreadcrumbList", why: "clarifies site structure and earns breadcrumb rich results" },
];

export interface SchemaAudit {
  present: string[];
  /** Recommended high-value types the page/site is missing. */
  missing: { type: string; why: string }[];
  hasAny: boolean;
}

/**
 * Compare the schema types present against the high-value set and report gaps.
 * `isProductPage` adds a Product recommendation for commercial pages.
 */
export function auditSchema(html: string, opts: { isProductPage?: boolean } = {}): SchemaAudit {
  const present = detectSchemaTypes(html);
  const presentLc = new Set(present.map((t) => t.toLowerCase()));
  const wanted = [...VALUABLE_SCHEMA];
  if (opts.isProductPage)
    wanted.push({ type: "Product", why: "enables price/availability/review rich results for shopping and AI answers" });

  const missing = wanted.filter((w) => !presentLc.has(w.type.toLowerCase()));
  return { present, missing, hasAny: present.length > 0 };
}
