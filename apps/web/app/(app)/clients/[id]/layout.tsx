import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle();

  if (!client) notFound();

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">Client</div>
      <h1 className="text-2xl font-semibold">{client.name}</h1>
      {children}
    </div>
  );
}
