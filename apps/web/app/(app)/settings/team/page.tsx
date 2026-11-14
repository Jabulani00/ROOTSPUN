import { serviceClient } from "@rootspun/db";
import { Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { TeamTable, type Member } from "@/components/team-table";

/** FR-01 — team members and roles. */
export default async function TeamSettingsPage() {
  const supabase = createClient();
  const me = await getUser();

  const { data: memberships } = await supabase.from("memberships").select("id, user_id, role");

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
    </div>
  );
}
