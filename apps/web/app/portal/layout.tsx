import { redirect } from "next/navigation";
import type { Branding } from "@rootspun/core";
import { createClient } from "@/lib/supabase/server";
import { BrandStyle } from "@/components/brand-style";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Client portal (RS-308) — a branded, read-only space. Auth-gated; the viewer's
 * agency branding is applied, and no agency navigation is shown.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/portal");

  const { data: membership } = await supabase
    .from("memberships")
    .select("agencies(name, branding)")
    .limit(1)
    .maybeSingle();
  const agency = membership?.agencies as unknown as { name: string; branding: Branding | null } | null;

  return (
    <>
      <BrandStyle branding={agency?.branding ?? null} />
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center gap-2 border-b bg-card px-4">
          {agency?.branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agency.branding.logoUrl} alt={agency.name ?? "Logo"} className="h-7" />
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              {(agency?.name ?? "R").charAt(0)}
            </span>
          )}
          <span className="font-semibold">{agency?.branding?.name ?? agency?.name ?? "Client portal"}</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </>
  );
}
