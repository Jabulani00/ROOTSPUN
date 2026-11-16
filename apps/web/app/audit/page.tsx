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
          Google isn&apos;t the only front door anymore. Get an instant score for how ready your
          site is to rank in Google and to be quoted by AI answers — with the exact fixes to climb.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>✓ A live SEO + AEO (AI-answer) readiness score</li>
          <li>✓ Whether Google and AI crawlers (GPTBot, Perplexity, Claude) can reach you</li>
          <li>✓ Your top prioritised fixes — no email, no credit card</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Want full tracking across Google, AI Overviews, ChatGPT, Gemini and Perplexity with
          competitor share of voice? That&apos;s the paid Rootspun platform — start free after your audit.
        </p>
      </div>
      <AuditForm />
    </main>
  );
}
