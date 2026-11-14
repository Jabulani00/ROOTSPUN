import { z } from "zod";
import type { JobContext } from "./context.js";

/** RS-107 — daily Search Console sync (read-only OAuth, token from Vault). */
export const gscSyncJobSchema = z.object({
  type: z.literal("gsc_sync"),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  backfillMonths: z.number().int().min(0).max(16).default(0),
});
export type GscSyncJob = z.infer<typeof gscSyncJobSchema>;

interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  position: number;
}

export async function runGscSyncJob(job: GscSyncJob, ctx: JobContext): Promise<void> {
  const { db, log } = ctx;

  const { data: integ } = await db
    .from("integrations")
    .select("id")
    .eq("client_id", job.clientId)
    .eq("provider", "gsc")
    .eq("status", "connected")
    .maybeSingle();
  if (!integ) {
    log.info({ clientId: job.clientId }, "gsc-sync: not connected");
    return;
  }

  const { data: refreshToken } = await db.rpc("gsc_refresh_token", { p_integration_id: integ.id });
  if (!refreshToken) throw new Error("gsc-sync: no stored refresh token");

  const accessToken = await refreshAccessToken(refreshToken);

  const { data: domain } = await db
    .from("domains")
    .select("host")
    .eq("client_id", job.clientId)
    .eq("is_primary", true)
    .maybeSingle();
  if (!domain) {
    log.info({ clientId: job.clientId }, "gsc-sync: no primary domain");
    return;
  }
  const siteUrl = `sc-domain:${domain.host}`;

  // GSC data lags ~2 days; backfill on first connect, else a short window.
  const end = daysAgo(2);
  const start = daysAgo(2 + (job.backfillMonths > 0 ? job.backfillMonths * 30 : 7));

  const rows = await querySearchAnalytics(accessToken, siteUrl, start, end);
  if (rows.length === 0) {
    log.info({ clientId: job.clientId }, "gsc-sync: no rows");
    return;
  }

  const { error } = await db.from("gsc_daily").insert(
    rows.map((r) => ({
      agency_id: job.agencyId,
      client_id: job.clientId,
      date: r.keys[0] ?? end,
      query: r.keys[1] ?? null,
      page: r.keys[2] ?? null,
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      position: r.position,
    })),
  );
  if (error) throw new Error(`gsc-sync insert: ${error.message}`);
  log.info({ clientId: job.clientId, rows: rows.length }, "gsc-sync: upserted Search Console data");
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`gsc token refresh ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("gsc: no access_token");
  return json.access_token;
}

async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GscRow[]> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["date", "query", "page"], rowLimit: 5000 }),
    },
  );
  if (!res.ok) throw new Error(`gsc query ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { rows?: GscRow[] };
  return json.rows ?? [];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
