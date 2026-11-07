"use client";

import { useState } from "react";
import { Button, Card, CardContent } from "@rootspun/ui";

const field =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AuditForm() {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [competitors, setCompetitors] = useState(["", "", ""]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/public/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, email, competitors: competitors.filter(Boolean) }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(body.error ?? "Something went wrong");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error — please try again");
    }
  }

  if (state === "done") {
    return (
      <Card>
        <CardContent className="space-y-2 p-6 text-center">
          <p className="text-lg font-medium text-success">You&apos;re in the queue 🎉</p>
          <p className="text-sm text-muted-foreground">
            We&apos;re checking how <strong>{domain}</strong> shows up across Google and AI engines.
            Your report lands in <strong>{email}</strong> shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="domain" className="text-sm font-medium">Your domain</label>
            <input id="domain" required className={field} placeholder="yourbrand.com"
              value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">Where should we send it?</label>
            <input id="email" type="email" required className={field} placeholder="you@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Up to 3 competitors</legend>
            {competitors.map((c, i) => (
              <input key={i} className={field} placeholder={`competitor${i + 1}.com`} value={c}
                onChange={(e) => setCompetitors((list) => list.map((x, j) => (j === i ? e.target.value : x)))} />
            ))}
          </fieldset>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={state === "loading"}>
            {state === "loading" ? "Queuing your audit…" : "Run my free audit"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            20 prompts across Google, AI Overviews and ChatGPT. No credit card.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
