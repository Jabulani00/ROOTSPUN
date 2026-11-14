"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@rootspun/ui";
import { removeMemberAction, updateMemberRoleAction } from "@/app/(app)/settings/team/actions";

type Role = "owner" | "admin" | "analyst" | "client_viewer";
export interface Member {
  id: string;
  email: string;
  role: Role;
  isSelf: boolean;
}

const ROLES: Role[] = ["owner", "admin", "analyst", "client_viewer"];

export function TeamTable({ members }: { members: Member[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <ul className="divide-y rounded-md border text-sm">
      {members.map((m) => (
        <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0 truncate">
            {m.email}
            {m.isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
          </span>
          <div className="flex items-center gap-2">
            <select
              aria-label={`Role for ${m.email}`}
              defaultValue={m.role}
              disabled={pending}
              onChange={(e) =>
                startTransition(() => {
                  void updateMemberRoleAction(m.id, e.target.value as Role);
                })
              }
              className="h-8 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </select>
            {!m.isSelf && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${m.email}`}
                disabled={pending}
                onClick={() => startTransition(() => { void removeMemberAction(m.id); })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
