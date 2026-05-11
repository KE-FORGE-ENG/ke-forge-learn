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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your library</h1>
          <p className="text-muted-foreground mt-1">Pick up where you left off, or start something new.</p>
        </div>
        <Button asChild size="lg" className="shadow-[var(--shadow-glow)]">
          <Link to="/new"><Plus className="w-4 h-4 mr-1" /> New plan</Link>
        </Button>
      </div>

      {plans.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Active plans</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {plans.map((p) => {
              const doc = docs.find((d) => d.id === p.document_id);
              return (
                <Card key={p.id} className="p-5 hover:shadow-[var(--shadow-card)] transition">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Day {p.current_day} of {p.days}</div>
                  <h3 className="font-semibold mt-1 truncate">{doc?.title ?? "Plan"}</h3>
                  <div className="flex gap-2 mt-4">
                    <Button asChild size="sm" className="flex-1">
                      <Link to="/learn/$planId" params={{ planId: p.id }}>Continue</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link to="/deeplearn/$planId" params={{ planId: p.id }}><Brain className="w-3.5 h-3.5 mr-1" /> Deep</Link>
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
