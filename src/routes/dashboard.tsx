import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Plus, Sparkles, Calendar, Brain } from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

type Doc = { id: string; title: string; source_type: string; page_count: number; created_at: string };
type Plan = { id: string; document_id: string; days: number; current_day: number };

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: d }, { data: p }] = await Promise.all([
        supabase.from("documents").select("id,title,source_type,page_count,created_at").order("created_at", { ascending: false }),
        supabase.from("learning_plans").select("id,document_id,days,current_day").order("created_at", { ascending: false }),
      ]);
      setDocs((d ?? []) as Doc[]);
      setPlans((p ?? []) as Plan[]);
    })();
  }, [user]);

  if (!user) return null;

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Your library</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick up where you left off, or start something new.</p>
        </div>
        <Button asChild size="lg" className="shadow-[var(--shadow-glow)] w-full sm:w-auto">
          <Link to="/new"><Plus className="w-4 h-4 mr-1" /> New plan</Link>
        </Button>
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
          <Button asChild size="lg" className="w-full sm:w-auto flex-shrink-0">
            <Link to="/deeplearn"><Brain className="w-4 h-4 mr-1" /> Start deep learn</Link>
          </Button>
        </div>
      </Card>

      {plans.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Active plans</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
            {plans.map((p) => {
              const doc = docs.find((d) => d.id === p.document_id);
              return (
                <Card key={p.id} className="p-3 sm:p-4 min-w-0 overflow-hidden hover:shadow-[var(--shadow-card)] transition">
                  <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3 flex-shrink-0" /> Day {p.current_day}/{p.days}</div>
                  <h3 className="font-semibold mt-1 text-sm sm:text-base truncate">{doc?.title ?? "Plan"}</h3>
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
      {docs.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground">No documents yet. Upload a PDF or create a topic to begin.</p>
          <Button asChild className="mt-4"><Link to="/new"><Plus className="w-4 h-4 mr-1" /> Create your first plan</Link></Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="text-xs text-muted-foreground uppercase">{d.source_type}</div>
              <h3 className="font-semibold mt-1 truncate">{d.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{d.page_count} pages</p>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
