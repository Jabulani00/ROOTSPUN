"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";
import { createClientAction } from "@/app/(app)/clients/new/actions";

const field =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Competitor {
  name: string;
  host: string;
}

export function ClientForm() {
  const [competitors, setCompetitors] = useState<Competitor[]>([{ name: "", host: "" }]);
  const [brandTerms, setBrandTerms] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const input = {
      name: String(form.get("name") ?? ""),
      country: String(form.get("country") ?? "ZA") || "ZA",
      language: String(form.get("language") ?? "en") || "en",
      primaryDomain: String(form.get("primaryDomain") ?? ""),
      competitors: competitors.filter((c) => c.name && c.host),
      brandTerms: brandTerms
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    startTransition(async () => {
      const result = await createClientAction(input);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <input id="name" name="name" required className={field} placeholder="Acme Inc." />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="primaryDomain" className="text-sm font-medium">Primary domain</label>
              <input id="primaryDomain" name="primaryDomain" required className={field} placeholder="acme.com" />
            </div>
            <div className="space-y-1">
              <label htmlFor="country" className="text-sm font-medium">Country</label>
              <input id="country" name="country" defaultValue="ZA" maxLength={2} className={field} />
            </div>
            <div className="space-y-1">
              <label htmlFor="language" className="text-sm font-medium">Language</label>
              <input id="language" name="language" defaultValue="en" maxLength={5} className={field} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Competitors (up to 10)</legend>
            {competitors.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  aria-label={`Competitor ${i + 1} name`}
                  className={field}
                  placeholder="Name"
                  value={c.name}
                  onChange={(e) =>
                    setCompetitors((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                />
                <input
                  aria-label={`Competitor ${i + 1} domain`}
                  className={field}
                  placeholder="domain.com"
                  value={c.host}
                  onChange={(e) =>
                    setCompetitors((list) => list.map((x, j) => (j === i ? { ...x, host: e.target.value } : x)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove competitor"
                  onClick={() => setCompetitors((list) => list.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {competitors.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCompetitors((list) => [...list, { name: "", host: "" }])}
              >
                <Plus className="h-4 w-4" /> Add competitor
              </Button>
            )}
          </fieldset>

          <div className="space-y-1">
            <label htmlFor="brandTerms" className="text-sm font-medium">Brand terms</label>
            <input
              id="brandTerms"
              className={field}
              placeholder="Acme, Acme Pro (comma-separated)"
              value={brandTerms}
              onChange={(e) => setBrandTerms(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create client"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
