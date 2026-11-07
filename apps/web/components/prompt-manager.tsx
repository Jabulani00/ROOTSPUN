"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@rootspun/ui";
import { addPromptAction, importPromptsCsvAction } from "@/app/(app)/clients/[id]/prompts/actions";
import { PROMPT_INTENTS } from "@/lib/validation";

const field =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PromptManager({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<"manual" | "csv">("manual");
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [intent, setIntent] = useState("");
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function addManual() {
    setMsg(null);
    startTransition(async () => {
      const r = await addPromptAction(clientId, {
        text,
        topic: topic || undefined,
        intent: intent || undefined,
        priority: false,
        searchVolume: 0,
      });
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: "Prompt added" });
        setText("");
        setTopic("");
      }
    });
  }

  function importCsv() {
    setMsg(null);
    startTransition(async () => {
      const r = await importPromptsCsvAction(clientId, csv);
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: `Imported ${r.added} prompts` });
        setCsv("");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add prompts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-1 text-sm">
          {(["manual", "csv"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 ${tab === t ? "bg-secondary font-medium" : "text-muted-foreground"}`}
            >
              {t === "manual" ? "Manual" : "CSV import"}
            </button>
          ))}
        </div>

        {tab === "manual" ? (
          <div className="space-y-3">
            <input
              className={field}
              placeholder="What question do buyers ask?"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input className={field} placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <select className={field} value={intent} onChange={(e) => setIntent(e.target.value)} aria-label="Intent">
                <option value="">Intent…</option>
                {PROMPT_INTENTS.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <Button onClick={addManual} disabled={pending || text.trim().length < 3}>
              {pending ? "Adding…" : "Add prompt"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              className="min-h-32 w-full rounded-md border border-input bg-card p-3 font-mono text-xs"
              placeholder={"text,topic,intent,search_volume\nbest crm for startups,CRM,commercial,1200"}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
            <Button onClick={importCsv} disabled={pending || csv.trim().length === 0}>
              {pending ? "Importing…" : "Import CSV"}
            </Button>
          </div>
        )}

        {msg && (
          <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>
            {msg.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
