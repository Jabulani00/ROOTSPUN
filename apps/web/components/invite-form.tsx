"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { Button } from "@rootspun/ui";
import { inviteMemberAction } from "@/app/(app)/settings/team/actions";

type Role = "admin" | "analyst" | "client_viewer";
const field =
  "h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("analyst");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLink(null);
    startTransition(async () => {
      const r = await inviteMemberAction(email, role);
      if (r.error) setError(r.error);
      else {
        setLink(r.url ?? null);
        setEmail("");
      }
    });
  }

  return (
    <form onSubmit={invite} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          className={`${field} flex-1`}
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select className={field} value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
          <option value="admin">admin</option>
          <option value="analyst">analyst</option>
          <option value="client_viewer">client viewer</option>
        </select>
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Invite"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {link && (
        <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm">
          <p className="font-medium text-success">Invite created — share this link:</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="truncate rounded bg-card px-2 py-1 text-xs">{link}</code>
            <Button size="icon" variant="ghost" aria-label="Copy link" onClick={() => navigator.clipboard?.writeText(link)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
