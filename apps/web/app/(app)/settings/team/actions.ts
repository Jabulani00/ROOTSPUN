"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Role = "owner" | "admin" | "analyst" | "client_viewer";

/** Change a member's role. RLS ("owners manage memberships") enforces authz. */
export async function updateMemberRoleAction(
  membershipId: string,
  role: Role,
): Promise<{ error?: string }> {
  const db = createClient();
  const { error } = await db.from("memberships").update({ role }).eq("id", membershipId);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return {};
}

/** Remove a member from the agency. RLS enforces owner/admin only. */
export async function removeMemberAction(membershipId: string): Promise<{ error?: string }> {
  const db = createClient();
  const { error } = await db.from("memberships").delete().eq("id", membershipId);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return {};
}
