import "server-only";

/** Core Web Vitals fetch (RS-202): CrUX field data, PSI lab fallback. */
export interface Cwv {
  source: "crux" | "psi";
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
}

function num(v: number | string | undefined | null): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

/** Returns CWV for an origin, or null when no key is configured / no data. */
export async function fetchCwv(host: string): Promise<Cwv | { error: string } | null> {
  const origin = `https://${host.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
  const cruxKey = process.env.GOOGLE_CRUX_API_KEY;
  const psiKey = process.env.GOOGLE_PSI_API_KEY;
  if (!cruxKey && !psiKey) {
    return { error: "Add GOOGLE_CRUX_API_KEY or GOOGLE_PSI_API_KEY to fetch Core Web Vitals." };
  }

  if (cruxKey) {
    const res = await fetch(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${cruxKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        record?: { metrics?: Record<string, { percentiles?: { p75?: number | string } }> };
      };
      const m = json.record?.metrics ?? {};
      const cwv: Cwv = {
        source: "crux",
        lcpMs: num(m.largest_contentful_paint?.percentiles?.p75),
        inpMs: num(m.interaction_to_next_paint?.percentiles?.p75),
        cls: num(m.cumulative_layout_shift?.percentiles?.p75),
      };
      if (cwv.lcpMs != null || cwv.inpMs != null || cwv.cls != null) return cwv;
    }
  }

  if (psiKey) {
    const url = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    url.searchParams.set("url", origin);
    url.searchParams.set("key", psiKey);
    url.searchParams.append("category", "performance");
    const res = await fetch(url);
    if (res.ok) {
      const json = (await res.json()) as {
        lighthouseResult?: { audits?: Record<string, { numericValue?: number }> };
      };
      const a = json.lighthouseResult?.audits ?? {};
      return {
        source: "psi",
        lcpMs: num(a["largest-contentful-paint"]?.numericValue),
        inpMs: num(a["interaction-to-next-paint"]?.numericValue ?? a["total-blocking-time"]?.numericValue),
        cls: num(a["cumulative-layout-shift"]?.numericValue),
      };
    }
  }

  return null;
}
