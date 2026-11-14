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
  hrefTemplate,
  className,
}: {
  label: string;
  value?: string;
  options: SwitcherOption[];
  /**
   * Path to navigate to on change, with `:id` standing in for the chosen id
   * (e.g. `/clients/:id/visibility`). A plain string is passed instead of a
   * function so this works from a Server Component across the client boundary.
   */
  hrefTemplate: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <label className={cn("relative flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => router.push(hrefTemplate.replace(":id", encodeURIComponent(e.target.value)) as never)}
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
