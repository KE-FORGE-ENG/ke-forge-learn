import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GitFork, Library, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { langFlag, languageInfo, type Language } from "@/lib/preferences";
import { SUBJECTS, forkPublication, type Publication } from "@/lib/community";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community Commons — KE-FORGE LEARN" },
      { name: "description", content: "Browse and fork study plans published by learners worldwide." },
      { property: "og:title", content: "Community Commons — KE-FORGE LEARN" },
      { property: "og:description", content: "Browse and fork study plans published by learners worldwide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Commons,
});

function Commons() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("All");
  const [busy, setBusy] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["commons"],
    queryFn: async () => {
      const { data } = await supabase.from("community_publications").select("*").order("fork_count", { ascending: false }).order("created_at", { ascending: false }).limit(200);
      return (data ?? []) as Publication[];
    },
  });

  const list = useMemo(() => data.filter((p) =>
    (subject === "All" || p.subject === subject) &&
    (!q.trim() || (p.title + " " + (p.description ?? "")).toLowerCase().includes(q.toLowerCase()))), [data, q, subject]);

  const fork = async (p: Publication) => {
    if (!user) { nav({ to: "/auth" }); return; }
    setBusy(p.id);
    try {
      const id = await forkPublication(p, user.id);
      toast.success("Added to your library");
      nav({ to: "/learn/$planId", params: { planId: id } });
    } catch (e: any) { toast.error(e.message ?? "Could not fork"); }
    finally { setBusy(null); }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-primary flex items-center gap-1"><Library className="w-3 h-3" /> Community Commons</div>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">Curated study plans from fellow learners</h1>
        <p className="text-sm text-muted-foreground mt-1">Fork any plan into your library — lessons, flashcards and structure included.</p>
      </div>
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the Commons…" className="pl-9" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {["All", ...SUBJECTS].map((s) => (
          <Button key={s} size="sm" variant={subject === s ? "default" : "outline"} className="shrink-0" onClick={() => setSubject(s)}>{s}</Button>
        ))}
      </div>
      {isLoading ? <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        : list.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            No published plans yet. Publish one from your <Link to="/dashboard" className="text-primary underline">library</Link>.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((p) => (
              <Card key={p.id} className="p-4 flex flex-col min-w-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                  <span className="truncate">{p.subject}</span>
                  <span className="shrink-0">{langFlag(p.language as Language)} {languageInfo(p.language as Language).label}</span>
                </div>
                <h3 className="font-semibold mt-1 truncate">{p.title}</h3>
                {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                <div className="text-xs text-muted-foreground mt-2">@{p.author_name} · {p.days} days · <GitFork className="w-3 h-3 inline" /> {p.fork_count}</div>
                <Button size="sm" className="mt-3" disabled={busy === p.id || p.user_id === user?.id} onClick={() => fork(p)}>
                  {busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><GitFork className="w-4 h-4 mr-1" />{p.user_id === user?.id ? "Your publication" : "Fork to library"}</>}
                </Button>
              </Card>
            ))}
          </div>
        )}
    </AppShell>
  );
}
