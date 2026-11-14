import { serviceClient } from "@rootspun/db";
import { Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { TeamTable, type Member } from "@/components/team-table";
import { InviteForm } from "@/components/invite-form";

/** FR-01 — team members and roles. */
export default async function TeamSettingsPage() {
  const supabase = createClient();
  const me = await getUser();

  const { data: memberships } = await supabase.from("memberships").select("id, user_id, role");
  const { data: invites } = await supabase
    .from("invites")
    .select("id, email, role, status")
    .eq("status", "pending");

  // Resolve emails with the service-role admin API (server-only).
  const admin = serviceClient();
  const members: Member[] = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return {
        id: m.id,
        email: data.user?.email ?? m.user_id,
        role: m.role,
        isSelf: m.user_id === me?.id,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">
          Members and roles: owner, admin, analyst, client viewer. Owners and admins manage the team.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length > 0 ? (
            <TeamTable members={members} />
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InviteForm />
          {invites && invites.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Pending invites</p>
              <ul className="divide-y rounded-md border text-sm">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between px-3 py-2">
                    <span>{i.email}</span>
                    <span className="text-xs text-muted-foreground">{i.role.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
