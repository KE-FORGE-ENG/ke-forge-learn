import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { langFlag, docLang, languageInfo } from "@/lib/preferences";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, Plus, Sparkles, Calendar, Brain, Search } from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

type Doc = { id: string; title: string; source_type: string; page_count: number; created_at: string };
type Plan = { id: string; document_id: string; days: number; current_day: number };

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  const { data } = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase.from("documents").select("id,title,source_type,page_count,created_at").order("created_at", { ascending: false }),
        supabase.from("learning_plans").select("id,document_id,days,current_day").order("created_at", { ascending: false }),
      ]);
      return { docs: (d ?? []) as Doc[], plans: (p ?? []) as Plan[] };
    },
  });
  const docs = data?.docs ?? [];
  const plans = data?.plans ?? [];

  const ql = q.trim().toLowerCase();
  const filteredDocs = useMemo(() => !ql ? docs : docs.filter((d) => d.title.toLowerCase().includes(ql)), [docs, ql]);
  const filteredPlans = useMemo(() => {
    if (!ql) return plans;
    return plans.filter((p) => {
      const t = docs.find((d) => d.id === p.document_id)?.title?.toLowerCase() ?? "";
      return t.includes(ql);
    });
  }, [plans, docs, ql]);

  if (!user) return null;

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Your library</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick up where you left off, or start something new.</p>
      </div>

      <Card className="p-5 mb-4 bg-[image:var(--gradient-soft)] border-primary/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary/15 p-2.5 shrink-0"><Calendar className="w-5 h-5 text-primary" /></div>
            <div className="min-w-0">
              <h2 className="font-semibold text-base sm:text-lg">Structured Study Plan</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Upload a PDF or type a topic — AI splits it into daily lessons, quizzes and flashcards.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/new" search={{ template: undefined }}>Browse templates</Link>
            </Button>
            <Button asChild size="lg" className="w-full sm:w-auto shadow-[var(--shadow-glow)]">
              <Link to="/new" search={{ template: undefined }}><Plus className="w-4 h-4 mr-1" /> Create study plan</Link>
            </Button>
          </div>
        </div>
      </Card>

      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents and plans…" className="pl-9" />
      </div>

      {/* Standalone Deep Learning entry */}
      <Card className="p-5 mb-8 bg-[image:var(--gradient-soft)] border-primary/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary/15 p-2.5 flex-shrink-0"><Brain className="w-5 h-5 text-primary" /></div>
            <div className="min-w-0">
              <h2 className="font-semibold text-base sm:text-lg">Deep Learning</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Teach yourself from any PDF, topic, or lecture notes — page by page with optional web search.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0">
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/adaptive">Adaptive learn</Link>
            </Button>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/deeplearn"><Brain className="w-4 h-4 mr-1" /> Start deep learn</Link>
            </Button>
          </div>
        </div>
      </Card>

      {filteredPlans.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Active plans</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
            {filteredPlans.map((p) => {
              const doc = docs.find((d) => d.id === p.document_id);
              return (
                <Card key={p.id} className="p-3 sm:p-4 min-w-0 overflow-hidden hover:shadow-[var(--shadow-card)] transition">
                  <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3 flex-shrink-0" /> Day {p.current_day}/{p.days}</div>
                  <h3 className="font-semibold mt-1 text-sm sm:text-base truncate">{doc?.title ?? "Plan"}</h3>
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{langFlag(docLang(p.document_id))} {languageInfo(docLang(p.document_id)).label}</div>
                  <div className="flex flex-col gap-1.5 mt-3">
                    <Button asChild size="sm" className="w-full h-8 text-xs">
                      <Link to="/learn/$planId" params={{ planId: p.id }}>Continue</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="w-full h-8 text-xs">
                      <Link to="/deeplearn/$planId" params={{ planId: p.id }}><Brain className="w-3 h-3 mr-1" /> Deep learn</Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Saved documents</h2>
      {filteredDocs.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">{ql ? "No documents match your search." : "No documents yet. Upload a PDF or create a topic to begin."}</p>
          {!ql && <Button asChild className="mt-4"><Link to="/new" search={{ template: undefined }}><Plus className="w-4 h-4 mr-1" /> Create your first plan</Link></Button>}
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDocs.map((d) => (
            <Card key={d.id} className="p-3 sm:p-5 min-w-0 overflow-hidden">
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase truncate">{d.source_type}</div>
              <h3 className="font-semibold mt-1 text-sm sm:text-base truncate">{d.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">{d.page_count} pages · {langFlag(docLang(d.id))} {languageInfo(docLang(d.id)).label}</p>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
