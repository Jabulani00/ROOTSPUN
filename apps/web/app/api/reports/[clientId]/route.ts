import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Branding } from "@rootspun/core";
import { createClient } from "@/lib/supabase/server";
import { ReportDocument, type ReportData } from "@/components/report-document";
import { causeLabel } from "@/lib/cause-labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RS-109 — render a branded PDF report for a client. Auth-gated by middleware + RLS. */
export async function GET(
  _request: Request,
  { params }: { params: { clientId: string } },
): Promise<Response> {
  const db = createClient();

  const { data: client } = await db
    .from("clients")
    .select("id, name, agency_id")
    .eq("id", params.clientId)
    .maybeSingle();
  if (!client) return new Response("Not found", { status: 404 });

  const { data: agency } = await db
    .from("agencies")
    .select("name, branding")
    .eq("id", client.agency_id)
    .maybeSingle();
  const branding = (agency?.branding ?? {}) as Branding;

  const { data: latest } = await db
    .from("scores_daily")
    .select("uvs, share_of_voice, confidence, date")
    .eq("client_id", client.id)
    .is("engine_id", null)
    .is("topic", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: wins } = await db
    .from("fixes")
    .select("title")
    .eq("client_id", client.id)
    .eq("status", "shipped")
    .order("shipped_at", { ascending: false })
    .limit(5);

  const { data: causes } = await db
    .from("causes")
    .select("type, impact")
    .eq("client_id", client.id)
    .eq("status", "new")
    .order("impact", { ascending: false })
    .limit(5);

  const data: ReportData = {
    agencyName: branding.name ?? agency?.name ?? "Rootspun",
    brandColor: branding.primary ?? "#2f9e6b",
    clientName: client.name,
    period: new Date().toISOString().slice(0, 7),
    uvs: latest ? Number(latest.uvs).toFixed(1) : "—",
    shareOfVoice: latest ? `${Number(latest.share_of_voice).toFixed(0)}%` : "—",
    confidence: latest?.confidence ?? "low",
    wins: (wins ?? []).map((w) => w.title.replace(/^Fix:\s*/, "")),
    losses: (causes ?? []).map((c) => causeLabel(c.type)),
    nextSteps: (causes ?? []).slice(0, 3).map((c) => `Address: ${causeLabel(c.type)}`),
  };

  // ReportDocument returns a <Document>; reconcile the element type for renderToBuffer.
  const element = createElement(ReportDocument, { data }) as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);
  const filename = `rootspun-${client.name.replace(/\W+/g, "-").toLowerCase()}-${data.period}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
    },
  });
}
