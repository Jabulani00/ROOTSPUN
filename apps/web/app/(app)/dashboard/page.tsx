import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants, Card, CardContent, CardHeader, CardTitle, StatCard } from "@rootspun/ui";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: clients } = await supabase.from("clients").select("id, name");
  const clientCount = clients?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Agency overview</h1>
        <Link href={"/clients/new" as never} className={buttonVariants()}>
          Add client
        </Link>
      </div>

      {clientCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Add your first client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Track a client across Google and AI engines, understand why visibility
              moves, and send a branded report — first results in under 15 minutes.
            </p>
            <Link href={"/clients/new" as never} className={buttonVariants()}>
              Get started
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Clients tracked" value={String(clientCount)} />
          <StatCard label="Avg. visibility (UVS)" value="—" confidence="low" />
          <StatCard label="Prompt runs today" value="—" />
        </div>
      )}
    </div>
  );
}
