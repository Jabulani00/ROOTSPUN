import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";

const sections = [
  { title: "Team", desc: "Invite members and assign roles (owner, admin, analyst, client viewer).", href: null },
  { title: "Branding", desc: "Logo and colours for white-label.", href: "/settings/branding" },
  { title: "Integrations", desc: "Connect Google Search Console and others.", href: "/settings/integrations" },
  { title: "API", desc: "Public REST API keys and OpenAPI docs.", href: "/settings/api" },
  { title: "Billing", desc: "Plan, usage and top-ups (phase 4).", href: null },
] as const;

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => {
          const card = (
            <Card key={s.title} className={s.href ? "transition-colors hover:border-primary" : undefined}>
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{s.desc}</CardContent>
            </Card>
          );
          return s.href ? (
            <Link key={s.title} href={s.href as never} className="block">
              {card}
            </Link>
          ) : (
            card
          );
        })}
      </div>
    </div>
  );
}
