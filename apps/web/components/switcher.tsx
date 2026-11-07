"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@rootspun/ui";

export interface SwitcherOption {
  id: string;
  name: string;
}

/** Minimal accessible select used for the agency and client switchers (RS-004). */
export function Switcher({
  label,
  value,
  options,
  onNavigate,
  className,
}: {
  label: string;
  value?: string;
  options: SwitcherOption[];
  /** Given the chosen id, return the path to navigate to. */
  onNavigate: (id: string) => string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <label className={cn("relative flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => router.push(onNavigate(e.target.value) as never)}
        className="h-9 appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={label}
      >
        {options.length === 0 && <option value="">No {label.toLowerCase()}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground" />
    </label>
  );
}
