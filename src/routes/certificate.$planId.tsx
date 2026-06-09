import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Award, Printer, Loader2 } from "lucide-react";

export const Route = createFileRoute("/certificate/$planId")({ component: Certificate });

function Certificate() {
  const { planId } = Route.useParams();
  const { user, username, loading } = useAuth();
  const nav = useNavigate();
  const [plan, setPlan] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [completedDays, setCompletedDays] = useState(0);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("learning_plans").select("*").eq("id", planId).single();
      if (!p) return;
      setPlan(p);
      const { data: d } = await supabase.from("documents").select("*").eq("id", p.document_id).single();
      setDoc(d);
      const { data: s } = await supabase.from("daily_sessions").select("id").eq("plan_id", planId).eq("completed", true);
      setCompletedDays(s?.length ?? 0);
    })();
  }, [user, planId]);

  if (!user) return null;
  if (!plan || !doc) return <AppShell><div className="py-20 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></AppShell>;

  const allDone = completedDays >= plan.days;
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/learn/$planId" params={{ planId }} className="text-sm text-muted-foreground hover:text-foreground">← Back to lesson</Link>
        <Button onClick={() => window.print()} disabled={!allDone}>
          <Printer className="w-4 h-4 mr-1" /> Print / Save PDF
        </Button>
      </div>

      {!allDone && (
        <Card className="p-5 mb-4 print:hidden border-accent/40 bg-accent/5">
          <p className="text-sm">
            You've completed <strong>{completedDays} of {plan.days}</strong> day{plan.days === 1 ? "" : "s"}.
            Finish all days to unlock printing.
          </p>
        </Card>
      )}

      <div className="bg-card border-8 border-double border-primary/40 p-8 sm:p-14 rounded-xl text-center print:border-primary print:rounded-none print:shadow-none">
        <Award className="w-14 h-14 mx-auto text-accent" />
        <div className="text-xs sm:text-sm uppercase tracking-[0.3em] text-muted-foreground mt-4">KE-FORGE LEARN</div>
        <h1 className="text-3xl sm:text-5xl font-bold mt-3">Certificate of Completion</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-6">This certifies that</p>
        <p className="text-2xl sm:text-4xl font-semibold mt-2 text-primary">@{username ?? "learner"}</p>
        <p className="text-sm sm:text-base text-muted-foreground mt-6">has successfully completed the {plan.days}-day learning plan</p>
        <p className="text-xl sm:text-2xl font-semibold mt-3 italic">"{doc.title}"</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-8">Awarded on {dateStr}</p>
        <div className="mt-10 flex items-center justify-center gap-10 text-xs text-muted-foreground">
          <div className="border-t border-muted-foreground/40 pt-2 px-6">Issued by KE-FORGE LEARN</div>
        </div>
      </div>
    </AppShell>
  );
}
