import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { callAi } from "@/lib/api";
import { Loader2, Sparkles, RotateCw, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { sm2, nextDueAt } from "@/lib/sm2";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/flashcards/$planId")({ component: Flashcards });

type FC = {
  id: string; front: string; back: string; ease: number;
  interval_days: number; reps: number; due_at: string; day: number | null;
};

function Flashcards() {
  const { planId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [plan, setPlan] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [cards, setCards] = useState<FC[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  const share = async () => {
    if (!plan) return;
    setSharing(true);
    try {
      let token = plan.share_token;
      if (!token || !plan.is_public) {
        token = token ?? Math.random().toString(36).slice(2, 12);
        const { error } = await supabase.from("learning_plans").update({ share_token: token, is_public: true }).eq("id", plan.id);
        if (error) throw error;
        setPlan({ ...plan, share_token: token, is_public: true });
      }
      const url = `${window.location.origin}/shared/${token}`;
      setShareUrl(url);
      setShareOpen(true);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setSharing(false); }
  };

  const unshare = async () => {
    if (!plan) return;
    await supabase.from("learning_plans").update({ is_public: false }).eq("id", plan.id);
    setPlan({ ...plan, is_public: false });
    setShareOpen(false);
    toast.success("Sharing disabled");
  };

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("learning_plans").select("*").eq("id", planId).single();
    if (!p) return;
    setPlan(p);
    const { data: d } = await supabase.from("documents").select("*").eq("id", p.document_id).single();
    setDoc(d);
    const now = new Date().toISOString();
    const { data: due } = await supabase
      .from("flashcards").select("*")
      .eq("plan_id", planId).lte("due_at", now)
      .order("due_at", { ascending: true }).limit(50);
    setCards((due as FC[]) ?? []);
    setIdx(0); setFlipped(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, planId]);

  const current = cards[idx];

  const grade = async (q: 0 | 3 | 4 | 5) => {
    if (!current) return;
    setBusy(true);
    const next = sm2(current, q);
    const due = nextDueAt(next.dueInDays);
    await supabase.from("flashcards").update({
      ease: next.ease, interval_days: next.interval_days, reps: next.reps,
      due_at: due, last_reviewed_at: new Date().toISOString(),
    }).eq("id", current.id);
    setBusy(false);
    setFlipped(false);
    if (idx + 1 >= cards.length) {
      toast.success("All due cards reviewed! 🎉");
      load();
    } else {
      setIdx(idx + 1);
    }
  };

  const generate = async (day?: number) => {
    if (!user || !plan || !doc) return;
    setGenerating(true);
    try {
      const pages = (doc.pages as { page: number; text: string }[]) ?? [];
      let dayContent: any = null;
      let sourceText = pages.map((p) => p.text).join("\n").slice(0, 14000);
      if (day) {
        const chunk = (plan.page_chunks as any[]).find((c) => c.day === day);
        if (chunk) {
          sourceText = pages.filter((p) => p.page >= chunk.startPage && p.page <= chunk.endPage)
            .map((p) => p.text).join("\n").slice(0, 14000);
        }
        const { data: sess } = await supabase.from("daily_sessions").select("content").eq("plan_id", planId).eq("day", day).maybeSingle();
        dayContent = sess?.content;
      }
      const result = await callAi("generate_flashcards", { sourceText, dayContent, count: 12 });
      const rows = (result.cards as any[]).map((c) => ({
        user_id: user.id, plan_id: planId, day: day ?? null,
        front: c.front, back: c.back,
      }));
      const { error } = await supabase.from("flashcards").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} cards added`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setGenerating(false); }
  };

  const stats = useMemo(() => ({ remaining: cards.length - idx }), [cards, idx]);

  if (!user || !plan || !doc) return <AppShell><div className="py-20 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></AppShell>;

  return (
    <AppShell>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <Link to="/learn/$planId" params={{ planId }} className="text-sm text-muted-foreground hover:text-foreground">← Back to lesson</Link>
          <h1 className="text-2xl font-bold mt-1 truncate max-w-xl">Flashcards · {doc.title}</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={share} variant="secondary" size="sm" disabled={sharing}>
            <Share2 className="w-4 h-4 mr-1" /> {plan.is_public ? "Manage share" : "Share deck"}
          </Button>
          <Button onClick={() => generate()} variant="outline" disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Generate from whole doc
          </Button>
          {(plan.page_chunks as any[]).map((c) => (
            <Button key={c.day} onClick={() => generate(c.day)} variant="ghost" size="sm" disabled={generating}>
              + Day {c.day}
            </Button>
          ))}
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share this flashcard deck</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Anyone with the link can review these cards (read-only).</p>
          <div className="flex gap-2 mt-2">
            <Input value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={async () => { await navigator.clipboard.writeText(shareUrl); toast.success("Copied"); }}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="destructive" size="sm" onClick={unshare} className="mt-2 w-full">Disable sharing</Button>
        </DialogContent>
      </Dialog>

      {cards.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No cards due. Generate some to start studying.</p>
        </Card>
      ) : (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
            <span>{stats.remaining} remaining</span>
            {current?.day && <Badge variant="secondary">Day {current.day}</Badge>}
          </div>
          <Card
            className="p-10 min-h-[260px] cursor-pointer select-none flex items-center justify-center text-center transition hover:shadow-[var(--shadow-glow)]"
            onClick={() => setFlipped(!flipped)}
          >
            <div>
              <div className="text-xs uppercase tracking-wider text-primary mb-3">{flipped ? "Answer" : "Question"}</div>
              <p className="text-xl font-medium whitespace-pre-wrap">{flipped ? current.back : current.front}</p>
              {!flipped && <p className="text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1"><RotateCw className="w-3 h-3" /> Tap to flip</p>}
            </div>
          </Card>

          {flipped && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <Button onClick={() => grade(0)} variant="destructive" disabled={busy}>Again</Button>
              <Button onClick={() => grade(3)} variant="outline" disabled={busy}>Hard</Button>
              <Button onClick={() => grade(4)} disabled={busy}>Good</Button>
              <Button onClick={() => grade(5)} variant="secondary" disabled={busy}>Easy</Button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
