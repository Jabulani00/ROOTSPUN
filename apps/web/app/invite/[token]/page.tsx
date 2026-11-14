import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants, Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";

/**
 * FR-01 — accept a team invite. Auth-gated by middleware, so an unauthenticated
 * invitee is sent to sign-in (next=/invite/<token>) and returns here after login,
 * at which point accept_invite creates their membership.
 */
export default async function AcceptInvitePage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: params.token });

  if (!error) redirect("/dashboard");

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Invite not valid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>This invite link is invalid, already used, or expired. Ask your admin to send a new one.</p>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Go to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
