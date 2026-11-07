import type { Branding } from "@rootspun/core";
import { createClient } from "@/lib/supabase/server";
import { ensureAgencyId } from "@/lib/auth";
import { BrandingForm } from "@/components/branding-form";

/** RS-307 — white-label branding settings. */
export default async function BrandingSettingsPage() {
  const supabase = createClient();
  const agencyId = await ensureAgencyId();
  const { data } = agencyId
    ? await supabase.from("agencies").select("branding").eq("id", agencyId).maybeSingle()
    : { data: null };
  const branding = (data?.branding ?? {}) as Branding;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Your logo and colours appear across the app, client portal and reports.
        </p>
      </div>
      <BrandingForm initial={branding} />
    </div>
  );
}
