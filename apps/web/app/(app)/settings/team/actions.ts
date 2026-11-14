"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureAgencyId } from "@/lib/auth";

type Role = "owner" | "admin" | "analyst" | "client_viewer";

/** FR-01 — invite a teammate by email. Returns a shareable accept link. */
export async function inviteMemberAction(
  email: string,
  role: Role,
): Promise<{ error?: string; url?: string }> {
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Enter a valid email" };
  const agencyId = await ensureAgencyId();
  if (!agencyId) return { error: "No agency" };

  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const db = createClient();
  const { error } = await db.from("invites").insert({ agency_id: agencyId, email: clean, role, token });
  if (error) return { error: error.message };

  revalidatePath("/settings/team");
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { url: `${origin}/invite/${token}` };
}

export async function revokeInviteAction(id: string): Promise<{ error?: string }> {
  const db = createClient();
  const { error } = await db.from("invites").update({ status: "revoked" }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings/team");
  return {};
}

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
