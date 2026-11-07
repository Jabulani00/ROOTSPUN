import { redirect } from "next/navigation";
import type { Branding } from "@rootspun/core";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { BrandStyle } from "@/components/brand-style";
import type { SwitcherOption } from "@/components/switcher";

type AgencyRow = { id: string; name: string; branding: Branding | null };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS scopes these to the agencies/clients the user may see.
  const { data: memberships } = await supabase
    .from("memberships")
    .select("agency_id, agencies(id, name, branding)");
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");

  const agencyRows = (memberships ?? [])
    .map((m) => m.agencies as unknown as AgencyRow | null)
    .filter((a): a is AgencyRow => Boolean(a));

  const agencies: SwitcherOption[] = agencyRows.map((a) => ({ id: a.id, name: a.name }));
  const clientOptions: SwitcherOption[] = (clients ?? []).map((c) => ({ id: c.id, name: c.name }));
  const branding = agencyRows[0]?.branding ?? null;

  return (
    <>
      <BrandStyle branding={branding} />
      <AppShell agencies={agencies} clients={clientOptions} activeAgencyId={agencies[0]?.id}>
        {children}
      </AppShell>
    </>
  );
}
