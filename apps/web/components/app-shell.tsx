import Link from "next/link";
import {
  BarChart3,
  FileText,
  Gauge,
  Lightbulb,
  ListChecks,
  LogOut,
  Settings,
  Wrench,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Switcher, type SwitcherOption } from "./switcher";
import { signOutAction } from "@/app/(app)/actions";

const clientNav = (clientId: string) => [
  { href: `/clients/${clientId}/visibility`, label: "Visibility", icon: Gauge },
  { href: `/clients/${clientId}/prompts`, label: "Prompts", icon: ListChecks },
  { href: `/clients/${clientId}/technical`, label: "Technical", icon: BarChart3 },
  { href: `/clients/${clientId}/causes`, label: "Causes", icon: Lightbulb },
  { href: `/clients/${clientId}/fixes`, label: "Fixes", icon: Wrench },
  { href: `/clients/${clientId}/reports`, label: "Reports", icon: FileText },
];

export function AppShell({
  agencies,
  clients,
  activeAgencyId,
  activeClientId,
  userEmail,
  children,
}: {
  agencies: SwitcherOption[];
  clients: SwitcherOption[];
  activeAgencyId?: string;
  activeClientId?: string;
  userEmail?: string;
  children: React.ReactNode;
}) {
  const nav = activeClientId ? clientNav(activeClientId) : [];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            R
          </span>
          Rootspun
        </Link>
        <div className="ml-2 flex items-center gap-2">
          <Switcher
            label="Agency"
            value={activeAgencyId}
            options={agencies}
            onNavigate={() => `/dashboard`}
          />
          {clients.length > 0 && (
            <Switcher
              label="Client"
              value={activeClientId}
              options={clients}
              onNavigate={(id) => `/clients/${id}/visibility`}
            />
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {userEmail && (
            <span className="mr-1 hidden text-sm text-muted-foreground sm:inline" title={userEmail}>
              {userEmail}
            </span>
          )}
          <Link
            href="/settings"
            className="grid h-9 w-9 place-items-center rounded-md hover:bg-secondary"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <ThemeToggle />
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-md hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        {nav.length > 0 && (
          <aside className="w-56 shrink-0 border-r bg-card/50 p-3">
            <nav className="flex flex-col gap-1">
              {nav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href as never}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
        )}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
