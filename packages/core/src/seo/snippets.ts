/**
 * Paste-ready structured-data (JSON-LD) templates (AEO/RS-304) — pure.
 *
 * The audit keeps finding sites with no structured data; giving them a correct,
 * paste-ready snippet turns the recommendation into a one-step fix. These emit
 * valid schema.org JSON-LD as a formatted string ready to drop into a <script
 * type="application/ld+json"> tag.
 */

function brandFromHost(host: string): string {
  const core = host
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\..*$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return core ? core.replace(/\b\w/g, (c) => c.toUpperCase()) : host;
}

/** Organization JSON-LD for a host (the baseline entity every brand should have). */
export function organizationSchema(host: string, name?: string): string {
  const h = host.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const obj = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: name ?? brandFromHost(h),
    url: `https://${h.replace(/^www\./, "")}`,
  };
  return JSON.stringify(obj, null, 2);
}

/** FAQPage JSON-LD from question/answer pairs (placeholders when none given). */
export function faqSchema(items: { q: string; a: string }[] = []): string {
  const qa = items.length > 0 ? items : [{ q: "Your question here?", a: "A concise, direct answer." }];
  const obj = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
  return JSON.stringify(obj, null, 2);
}

/** Wrap a JSON-LD object string in the script tag it belongs in. */
export function jsonLdScript(json: string): string {
  return `<script type="application/ld+json">\n${json}\n</script>`;
}
