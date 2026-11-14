import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** RS-107 — begin Google Search Console OAuth (read-only). Auth-gated by middleware. */
export async function GET(request: NextRequest): Promise<Response> {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  // Confirm the caller may see this client (RLS).
  const supabase = createClient();
  const { data: client } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!googleClientId) return NextResponse.json({ error: "OAuth not configured" }, { status: 500 });

  const redirectUri = `${request.nextUrl.origin}/api/integrations/gsc/callback`;
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    access_type: "offline",
    prompt: "consent",
    state: clientId,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
