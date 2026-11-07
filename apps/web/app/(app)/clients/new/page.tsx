import { ClientForm } from "@/components/client-form";

/** RS-101 — add a client with domains, brand terms and competitors. */
export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Add a client</h1>
      <ClientForm />
    </div>
  );
}
