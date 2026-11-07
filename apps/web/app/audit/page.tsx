import type { Metadata } from "next";
import { AuditForm } from "@/components/audit-form";

export const metadata: Metadata = {
  title: "Free AI visibility audit — Rootspun",
  description: "See how your brand shows up in Google and AI answers. Free, in minutes.",
};

export default function AuditPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-4 py-12 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">R</span>
          Rootspun
        </div>
        <h1 className="text-4xl font-semibold leading-tight">
          Are you visible where buyers now ask — <span className="text-primary">AI answers?</span>
        </h1>
        <p className="text-muted-foreground">
          Google isn&apos;t the only front door anymore. See how your brand appears across Google
          organic, AI Overviews and ChatGPT — and where competitors are winning the citation.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>✓ Your Unified Visibility Score across engines</li>
          <li>✓ Competitor share of voice</li>
          <li>✓ The top reasons you&apos;re losing citations</li>
        </ul>
      </div>
      <AuditForm />
    </main>
  );
}
