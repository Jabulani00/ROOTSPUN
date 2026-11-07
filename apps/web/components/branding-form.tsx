"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";
import { updateBrandingAction } from "@/app/(app)/settings/actions";
import type { Branding } from "@rootspun/core";

const field =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BrandingForm({ initial }: { initial: Branding }) {
  const [name, setName] = useState(initial.name ?? "");
  const [primary, setPrimary] = useState(initial.primary ?? "#2f9e6b");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const r = await updateBrandingAction({ name, primary, logoUrl });
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Branding saved — reload to see it applied" });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="brand-name" className="text-sm font-medium">Display name</label>
            <input id="brand-name" className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your agency" />
          </div>
          <div className="space-y-1">
            <label htmlFor="brand-color" className="text-sm font-medium">Brand colour</label>
            <div className="flex items-center gap-3">
              <input
                id="brand-color"
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(primary) ? primary : "#2f9e6b"}
                onChange={(e) => setPrimary(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-input bg-card"
              />
              <input
                aria-label="Brand colour hex"
                className={field}
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                placeholder="#2f9e6b"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="logo-url" className="text-sm font-medium">Logo URL</label>
            <input id="logo-url" className={field} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.svg" />
          </div>
          {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save branding"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
