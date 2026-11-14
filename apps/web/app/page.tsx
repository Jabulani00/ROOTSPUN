import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Check, Gauge, Lightbulb, Palette, Search, Wrench } from "lucide-react";
import { PLANS } from "@rootspun/payments";
import { buttonVariants, Card, CardContent } from "@rootspun/ui";
import { getUser } from "@/lib/auth";

export default async function Landing() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">R</span>
          Rootspun
        </span>
        <nav className="flex items-center gap-2">
          <Link href="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>Sign in</Link>
          <Link href="/sign-up" className={buttonVariants({ size: "sm" })}>Start free</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 pb-10 pt-12 text-center">
        <p className="mb-3 text-sm font-medium text-primary">Search &amp; AI visibility for agencies</p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Measure your clients&apos; visibility in Google <span className="text-primary">and AI answers</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Track every client across Google organic, AI Overviews, AI Mode, ChatGPT, Gemini, Perplexity and Claude.
          Understand <em>why</em> rankings move against Google&apos;s own documentation, and turn it into fixes —
          under your own brand.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>Start free</Link>
          <Link href="/audit" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <Search className="h-4 w-4" /> Run a free AI audit
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Gauge, title: "Unified Visibility Score", desc: "One 0–100 number per client across every engine, plus competitor share of voice." },
            { icon: BarChart3, title: "AI engine tracking", desc: "Sample ChatGPT, Gemini, Perplexity and Claude — shown as a share with confidence, never a single yes/no." },
            { icon: Lightbulb, title: "The Why Engine", desc: "Every lost ranking explained with evidence and the Google rule behind it." },
            { icon: Search, title: "Technical lab", desc: "Crawl, Core Web Vitals, and whether Googlebot and AI crawlers can even reach the site." },
            { icon: Wrench, title: "Fix Studio", desc: "Turn causes into dev tickets and content briefs — with a guardrail against Google's spam policies." },
            { icon: Palette, title: "White-label", desc: "Your logo, colours and a client portal. Clients only ever see your brand." },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="space-y-2 p-5">
                <f.icon className="h-5 w-5 text-primary" />
                <h3 className="font-medium">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-center text-2xl font-semibold">Simple agency pricing</h2>
        <p className="mb-6 mt-1 text-center text-sm text-muted-foreground">Paystack for South Africa, Stripe elsewhere.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.values(PLANS).map((p, i) => (
            <Card key={p.id} className={i === 1 ? "border-primary ring-1 ring-primary" : undefined}>
              <CardContent className="space-y-3 p-6">
                <h3 className="font-medium">{p.name}</h3>
                <p className="text-3xl font-semibold">${p.priceUsd}<span className="text-sm text-muted-foreground">/mo</span></p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> {p.promptRunsPerMonth.toLocaleString()} prompt runs/mo</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Up to {p.clients} clients</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> All engines &amp; the Why Engine</li>
                </ul>
                <Link href="/sign-up" className={buttonVariants({ variant: i === 1 ? "default" : "outline", className: "w-full" })}>
                  Start free
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h2 className="text-2xl font-semibold">See where your brand stands in AI search</h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Add a client and get your first Unified Visibility Score in under 15 minutes.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>Create your agency account</Link>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Rootspun · Built on official APIs and licensed SERP data — no scraping.
      </footer>
    </div>
  );
}
