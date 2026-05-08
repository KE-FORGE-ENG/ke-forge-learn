import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { callAi, youtubeSearchDirect } from "@/lib/api";
import { Loader2, HelpCircle, CheckCircle2, Youtube, Sparkles, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { LiveChat } from "@/components/LiveChat";

export const Route = createFileRoute("/learn/$planId")({ component: Learn });

type Chunk = { day: number; startPage: number; endPage: number };
type DayContent = {
  title: string; summary: string; classification: string[];
  concepts: { name: string; explanation: string; example?: string }[];
  followups: string[]; youtube_query: string;
};

function Learn() {
  const { planId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [plan, setPlan] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [day, setDay] = useState(1);
  const [content, setContent] = useState<DayContent | null>(null);
  const [simplified, setSimplified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("learning_plans").select("*").eq("id", planId).single();
      if (!p) return;
      setPlan(p);
      setDay(p.current_day);
      const { data: d } = await supabase.from("documents").select("*").eq("id", p.document_id).single();
      setDoc(d);
    })();
  }, [user, planId]);

  const chunks = (plan?.page_chunks ?? []) as Chunk[];
  const currentChunk = useMemo(() => chunks.find((c) => c.day === day), [chunks, day]);

  const sourceText = useMemo(() => {
    if (!doc || !currentChunk) return "";
    const pages = (doc.pages as { page: number; text: string }[]) ?? [];
    return pages
      .filter((p) => p.page >= currentChunk.startPage && p.page <= currentChunk.endPage)
      .map((p) => `--- Page ${p.page} ---\n${p.text}`)
      .join("\n\n");
  }, [doc, currentChunk]);

  const loadDay = async (force = false) => {
    if (!user || !plan || !doc) return;
    setContent(null); setSimplified(false); setVideos([]);
    setBusy(true);
    try {
      const { data: existing } = await supabase
        .from("daily_sessions").select("*").eq("plan_id", planId).eq("day", day).maybeSingle();

      let sess = existing;
      if (!sess || force) {
        // Count "lost" interactions in prior days for adaptive logic
        const { data: lost } = await supabase
          .from("user_interactions").select("id").eq("plan_id", planId).eq("kind", "lost");
        const lostCount = lost?.length ?? 0;

        const result = (await callAi("generate_day", {
          day, days: plan.days, sourceText, lostCount,
        })) as DayContent;

        const upsert = await supabase.from("daily_sessions").upsert({
          plan_id: planId, user_id: user.id, day, content: result,
        }, { onConflict: "plan_id,day" }).select().single();
        sess = upsert.data;
      }
      setContent(sess?.content as DayContent);
      setCompleted(!!sess?.completed);

      // Fetch youtube — build a focused, topic-correlated query
      try {
        const c = sess?.content as DayContent;
        const topics = (c?.classification ?? []).slice(0, 3).join(" ");
        const built = [c?.youtube_query, c?.title, topics, doc.title]
          .filter(Boolean).join(" ").slice(0, 180);
        const yt = await youtubeSearchDirect(built || doc.title);
        setVideos(yt.items ?? []);
      } catch { /* ignore */ }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load day");
    } finally { setBusy(false); }
  };

  useEffect(() => { if (plan && doc) loadDay(); /* eslint-disable-next-line */ }, [plan, doc, day]);

  const explainSimpler = async () => {
    if (!user || !plan) return;
    setBusy(true);
    try {
      await supabase.from("user_interactions").insert({
        user_id: user.id, plan_id: planId, day, kind: "lost",
      });
      const result = (await callAi("generate_day", {
        day, days: plan.days, sourceText, lostCount: 99, simplified: true,
      })) as DayContent;
      setContent(result); setSimplified(true);
      toast.success("Re-explained in simpler terms");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const completeDay = async () => {
    if (!user || !plan) return;
    await supabase.from("daily_sessions").update({ completed: true })
      .eq("plan_id", planId).eq("day", day);
    await supabase.from("user_interactions").insert({
      user_id: user.id, plan_id: planId, day, kind: "complete",
    });
    const next = Math.min(day + 1, plan.days);
    if (next > plan.current_day) {
      await supabase.from("learning_plans").update({ current_day: next }).eq("id", planId);
      setPlan({ ...plan, current_day: next });
    }
    setCompleted(true);
    toast.success("Day complete! 🎉");
  };

  if (!user || !plan || !doc) return <AppShell><div className="py-20 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></AppShell>;

  return (
    <AppShell>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back to dashboard</Link>
          <h1 className="text-2xl font-bold mt-1 truncate max-w-xl">{doc.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {chunks.map((c) => (
            <button
              key={c.day}
              onClick={() => setDay(c.day)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition ${
                day === c.day ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]" :
                c.day < plan.current_day ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground"
              }`}
            >{c.day}</button>
          ))}
        </div>
      </div>

      {currentChunk && (
        <p className="text-xs text-muted-foreground mb-4">
          Day {day} • Pages {currentChunk.startPage}–{currentChunk.endPage} of {doc.page_count}
          {simplified && <Badge variant="secondary" className="ml-2">Simplified</Badge>}
        </p>
      )}

      {busy && !content ? (
        <Card className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="mt-3 text-muted-foreground">Generating today's lesson…</p></Card>
      ) : content ? (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Day {day} • {plan.days === 5 && day === 5 ? "Intense" : day === 1 ? "Foundational" : "Building"}</span>
              </div>
              <h2 className="text-2xl font-bold">{content.title}</h2>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {content.classification.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
              <p className="mt-4 whitespace-pre-wrap leading-relaxed text-foreground/90">{content.summary}</p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Key concepts</h3>
              <div className="space-y-4">
                {content.concepts.map((c, i) => (
                  <div key={i} className="border-l-2 border-primary pl-4">
                    <div className="font-semibold">{c.name}</div>
                    <p className="text-sm text-foreground/80 mt-1">{c.explanation}</p>
                    {c.example && <p className="text-xs text-muted-foreground mt-1 italic">Example: {c.example}</p>}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3">Follow-up questions</h3>
              <ul className="space-y-2 list-disc list-inside text-foreground/85">
                {content.followups.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold"><Youtube className="w-4 h-4 text-destructive" /> Recommended videos</div>
              {videos.length === 0 ? (
                <p className="text-xs text-muted-foreground">No videos found.</p>
              ) : (
                <div className="space-y-3">
                  {videos.slice(0, 2).map((v) => (
                    <div key={v.id} className="rounded-lg overflow-hidden bg-muted aspect-video">
                      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${v.id}`} title={v.title} allowFullScreen />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 space-y-2">
              <Button onClick={explainSimpler} variant="outline" className="w-full" disabled={busy}>
                <HelpCircle className="w-4 h-4 mr-1" /> I'm lost — explain simpler
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/quiz/$planId/$day" params={{ planId, day: String(day) }}>Take quiz</Link>
              </Button>
              <Button onClick={completeDay} disabled={completed} className="w-full">
                <CheckCircle2 className="w-4 h-4 mr-1" /> {completed ? "Day complete" : "Mark day complete"}
              </Button>
            </Card>

            <div className="flex justify-between text-sm">
              <Button variant="ghost" size="sm" disabled={day === 1} onClick={() => setDay(day - 1)}><ChevronLeft className="w-4 h-4" /> Prev</Button>
              <Button variant="ghost" size="sm" disabled={day === plan.days} onClick={() => setDay(day + 1)}>Next <ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
