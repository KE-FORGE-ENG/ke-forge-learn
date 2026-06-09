import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Flame, BookOpen, Layers, CheckCircle2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/analytics")({ component: Analytics });

type Stats = {
  totalPlans: number;
  totalDocs: number;
  completedDays: number;
  totalDays: number;
  flashcardsReviewed: number;
  flashcardsDue: number;
  streakDays: number;
  perDayActivity: { date: string; count: number }[];
  recentCompletions: { plan_id: string; title: string; day: number; when: string }[];
};

function calcStreak(dates: string[]): number {
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function Analytics() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: plans }, { data: docs }, { data: sessions }, { data: cards }, { data: cardsDue }] = await Promise.all([
        supabase.from("learning_plans").select("id,days,document_id"),
        supabase.from("documents").select("id,title"),
        supabase.from("daily_sessions").select("plan_id,day,completed,created_at"),
        supabase.from("flashcards").select("id,last_reviewed_at,plan_id"),
        supabase.from("flashcards").select("id").lte("due_at", new Date().toISOString()),
      ]);

      const totalDays = (plans ?? []).reduce((a, p: any) => a + (p.days ?? 0), 0);
      const completed = (sessions ?? []).filter((s: any) => s.completed);
      const reviewed = (cards ?? []).filter((c: any) => c.last_reviewed_at);

      // activity buckets: last 14 days
      const days: { date: string; count: number }[] = [];
      const map: Record<string, number> = {};
      for (const s of completed) {
        const k = String(s.created_at).slice(0, 10);
        map[k] = (map[k] ?? 0) + 1;
      }
      for (const c of reviewed) {
        const k = String(c.last_reviewed_at).slice(0, 10);
        map[k] = (map[k] ?? 0) + 1;
      }
      const today = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        days.push({ date: key, count: map[key] ?? 0 });
      }

      const docMap = new Map((docs ?? []).map((d: any) => [d.id, d.title]));
      const planMap = new Map((plans ?? []).map((p: any) => [p.id, docMap.get(p.document_id) ?? "Plan"]));
      const recent = completed
        .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 6)
        .map((s: any) => ({ plan_id: s.plan_id, title: String(planMap.get(s.plan_id) ?? "Plan"), day: s.day, when: s.created_at }));

      setStats({
        totalPlans: plans?.length ?? 0,
        totalDocs: docs?.length ?? 0,
        completedDays: completed.length,
        totalDays,
        flashcardsReviewed: reviewed.length,
        flashcardsDue: cardsDue?.length ?? 0,
        streakDays: calcStreak(Object.keys(map)),
        perDayActivity: days,
        recentCompletions: recent,
      });
    })();
  }, [user]);

  if (!user) return null;
  if (!stats) return <AppShell><div className="py-20 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></AppShell>;

  const maxCount = Math.max(1, ...stats.perDayActivity.map((d) => d.count));
  const pct = stats.totalDays ? Math.round((stats.completedDays / stats.totalDays) * 100) : 0;

  return (
    <AppShell>
      <h1 className="text-2xl sm:text-3xl font-bold">Study analytics</h1>
      <p className="text-sm text-muted-foreground mt-1">Your progress at a glance.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="w-3 h-3 text-accent" /> Current streak</div>
          <div className="text-2xl font-bold mt-1">{stats.streakDays} day{stats.streakDays === 1 ? "" : "s"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-primary" /> Days completed</div>
          <div className="text-2xl font-bold mt-1">{stats.completedDays}<span className="text-sm text-muted-foreground"> / {stats.totalDays}</span></div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{pct}% of plan days</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="w-3 h-3 text-primary" /> Flashcards reviewed</div>
          <div className="text-2xl font-bold mt-1">{stats.flashcardsReviewed}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{stats.flashcardsDue} due now</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><BookOpen className="w-3 h-3 text-primary" /> Library</div>
          <div className="text-2xl font-bold mt-1">{stats.totalDocs}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{stats.totalPlans} active plans</div>
        </Card>
      </div>

      <Card className="p-5 mt-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold"><TrendingUp className="w-4 h-4 text-primary" /> Activity (last 14 days)</div>
        <div className="flex items-end gap-1 h-32">
          {stats.perDayActivity.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${d.count} actions`}>
              <div
                className="w-full rounded-t bg-primary/70 group-hover:bg-primary transition"
                style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count ? 4 : 1 }}
              />
              <div className="text-[9px] text-muted-foreground">{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 mt-6">
        <div className="text-sm font-semibold mb-3">Recent completions</div>
        {stats.recentCompletions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Complete a day to see it here.</p>
        ) : (
          <ul className="divide-y">
            {stats.recentCompletions.map((r, i) => (
              <li key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
                <Link to="/learn/$planId" params={{ planId: r.plan_id }} className="truncate hover:text-primary">{r.title}</Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary">Day {r.day}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(r.when).toLocaleDateString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
