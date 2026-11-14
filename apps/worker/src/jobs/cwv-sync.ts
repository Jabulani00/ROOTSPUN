import { z } from "zod";
import type { JobContext } from "./context.js";

/** RS-202 — Core Web Vitals per template from CrUX (field) + PageSpeed Insights (lab). */
export const cwvSyncJobSchema = z.object({
  type: z.literal("cwv_sync"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
});
export type CwvSyncJob = z.infer<typeof cwvSyncJobSchema>;

interface Cwv {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
}

export async function runCwvSyncJob(job: CwvSyncJob, ctx: JobContext): Promise<void> {
  const { db, log } = ctx;

  const { data: domain } = await db
    .from("domains")
    .select("host")
    .eq("client_id", job.clientId)
    .eq("is_primary", true)
    .maybeSingle();
  if (!domain) {
    log.info({ clientId: job.clientId }, "cwv-sync: no primary domain");
    return;
  }
  const origin = `https://${domain.host}`;

  // Prefer CrUX field data for the origin; fall back to PSI lab for the homepage.
  const crux = await fetchCrux(origin);
  const rows: { template: string; source: "crux" | "psi"; cwv: Cwv }[] = [];
  if (crux && (crux.lcpMs != null || crux.inpMs != null || crux.cls != null)) {
    rows.push({ template: "origin", source: "crux", cwv: crux });
  } else {
    const psi = await fetchPsi(origin);
    if (psi) rows.push({ template: "home", source: "psi", cwv: psi });
  }

  if (rows.length === 0) {
    log.info({ clientId: job.clientId }, "cwv-sync: no CWV data available");
    return;
  }

  const { error } = await db.from("cwv_metrics").insert(
    rows.map((r) => ({
      agency_id: job.agencyId,
      client_id: job.clientId,
      template: r.template,
      lcp_ms: r.cwv.lcpMs,
      inp_ms: r.cwv.inpMs,
      cls: r.cwv.cls,
      source: r.source,
    })),
  );
  if (error) throw new Error(`cwv-sync insert: ${error.message}`);
  log.info({ clientId: job.clientId, rows: rows.length }, "cwv-sync: stored Core Web Vitals");
}

async function fetchCrux(origin: string): Promise<Cwv | null> {
  const key = process.env.GOOGLE_CRUX_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    record?: { metrics?: Record<string, { percentiles?: { p75?: number | string } }> };
  };
  const m = json.record?.metrics ?? {};
  return {
    lcpMs: num(m.largest_contentful_paint?.percentiles?.p75),
    inpMs: num(m.interaction_to_next_paint?.percentiles?.p75),
    cls: num(m.cumulative_layout_shift?.percentiles?.p75),
  };
}

async function fetchPsi(url: string): Promise<Cwv | null> {
  const key = process.env.GOOGLE_PSI_API_KEY;
  if (!key) return null;
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.append("category", "performance");
  const res = await fetch(endpoint);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    lighthouseResult?: { audits?: Record<string, { numericValue?: number }> };
  };
  const audits = json.lighthouseResult?.audits ?? {};
  return {
    lcpMs: num(audits["largest-contentful-paint"]?.numericValue),
    inpMs: num(audits["interaction-to-next-paint"]?.numericValue ?? audits["total-blocking-time"]?.numericValue),
    cls: num(audits["cumulative-layout-shift"]?.numericValue),
  };
}

function num(v: number | string | undefined | null): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}
