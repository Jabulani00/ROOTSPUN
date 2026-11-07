/** Human labels for Why-Engine cause types (RS-205). */
export const CAUSE_LABELS: Record<string, string> = {
  not_indexed: "Not indexed",
  crawl_blocked: "Crawl blocked",
  snippet_blocked: "Snippet blocked",
  slow_template: "Slow template (Core Web Vitals)",
  competitor_cited: "Competitor cited instead",
  no_answering_page: "No page answers the prompt",
};

export function causeLabel(type: string): string {
  return CAUSE_LABELS[type] ?? type;
}
