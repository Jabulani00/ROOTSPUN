import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * RS-107 — Google OAuth callback. Exchanges the code for a refresh token and
 * stores it in Vault via the membership-checked connect_gsc_integration RPC.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const clientId = searchParams.get("state");
  const settings = `${origin}/settings/integrations`;

  if (!code || !clientId) return NextResponse.redirect(`${settings}?error=oauth`);

  const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!googleClientId || !googleSecret) return NextResponse.redirect(`${settings}?error=config`);

  // Exchange the authorization code for tokens.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId,
      client_secret: googleSecret,
      redirect_uri: `${origin}/api/integrations/gsc/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${settings}?error=token`);

  const tokens = (await tokenRes.json()) as { refresh_token?: string };
  if (!tokens.refresh_token) return NextResponse.redirect(`${settings}?error=norefresh`);

  // Store the refresh token in Vault and record the integration (RLS-checked).
  const supabase = createClient();
  const { error } = await supabase.rpc("connect_gsc_integration", {
    p_client_id: clientId,
    p_refresh_token: tokens.refresh_token,
  });
  if (error) return NextResponse.redirect(`${settings}?error=store`);

  return NextResponse.redirect(`${settings}?connected=1`);
}
