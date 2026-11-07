const LABELS: Record<string, string> = {
  not_indexed: "Not indexed",
  crawl_blocked: "Crawl blocked",
  snippet_blocked: "Snippet blocked",
  slow_template: "Slow template (Core Web Vitals)",
  competitor_cited: "Competitor cited instead",
  no_answering_page: "No page answers the prompt",
};

export function causeLabelFor(type: string): string {
  return LABELS[type] ?? type;
}
