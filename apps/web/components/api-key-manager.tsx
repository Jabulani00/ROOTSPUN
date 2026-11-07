"use client";

import { useState, useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";
import { createApiKeyAction, revokeApiKeyAction } from "@/app/(app)/settings/actions";

export interface KeyRow {
  id: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

export function ApiKeyManager({ keys }: { keys: KeyRow[] }) {
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    setCreated(null);
    startTransition(async () => {
      const r = await createApiKeyAction(["clients:read", "scores:read"]);
      if (r.error) setError(r.error);
      else setCreated(r.plaintext ?? null);
    });
  }

  function revoke(id: string) {
    startTransition(() => {
      void revokeApiKeyAction(id);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Keys authenticate the public REST API. Default scopes: clients:read, scores:read.
        </p>
        <Button onClick={create} disabled={pending} size="sm">
          {pending ? "…" : "Create key"}
        </Button>

        {created && (
          <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm">
            <p className="font-medium text-success">Copy this key now — it won&apos;t be shown again:</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="truncate rounded bg-card px-2 py-1 font-mono text-xs">{created}</code>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Copy key"
                onClick={() => navigator.clipboard?.writeText(created)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {keys.length > 0 && (
          <ul className="divide-y rounded-md border text-sm">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {k.scopes.join(", ")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    created {k.created_at.slice(0, 10)}
                    {k.last_used_at ? ` · last used ${k.last_used_at.slice(0, 10)}` : " · never used"}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Revoke key"
                  disabled={pending}
                  onClick={() => revoke(k.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
