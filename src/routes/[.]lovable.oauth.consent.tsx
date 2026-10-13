import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

type OAuthResult = { data: { redirect_url?: string; redirect_to?: string; client?: { name?: string } } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  head: () => ({ meta: [{ title: "Connect an AI assistant — KE-FORGE LEARN" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center px-4">
      <Card className="p-8 max-w-md text-sm">Could not load this connection request: {error instanceof Error ? error.message : String(error)}</Card>
    </div>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? "An AI assistant";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect was returned. Please try again."); return; }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-[image:var(--gradient-soft)]">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-card)]">
        <ShieldCheck className="w-10 h-10 text-primary" />
        <h1 className="text-2xl font-bold mt-4">Connect {name} to KE-FORGE LEARN</h1>
        <p className="text-sm text-muted-foreground mt-2">It will be able to, as you:</p>
        <ul className="text-sm mt-2 list-disc pl-5 space-y-1">
          <li>See your study plans and their material</li>
          <li>Create new study plans and add flashcards</li>
          <li>Search and copy Community Commons plans</li>
        </ul>
        {error && <p role="alert" className="text-sm text-destructive mt-4">{error}</p>}
        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>Deny</Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>{busy ? "Please wait…" : "Approve"}</Button>
        </div>
      </Card>
    </div>
  );
}
