import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LessonVisual } from "@/components/RichVisual";
import { nextChunk, critiqueTeachBack } from "@/lib/adaptive.functions";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/adaptive/$sessionId")({
  head: () => ({
    meta: [
      { title: "Adaptive lesson — KE-FORGE LEARN" },
      { name: "description", content: "Your adaptive, paced lesson." },
      { property: "og:title", content: "Adaptive lesson — KE-FORGE LEARN" },
      { property: "og:description", content: "Your adaptive, paced lesson." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Player,
});

type Adjust = "simpler" | "same" | "harder";

function Player() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const fetchNext = useServerFn(nextChunk);
  const [s, setS] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [prereqDone, setPrereqDone] = useState(false);
  const [adjust, setAdjust] = useState<Adjust>("same");
  const shownAt = useRef(Date.now());
  const critique = useServerFn(critiqueTeachBack);
  const [teach, setTeach] = useState("");
  const [fb, setFb] = useState<any>(null);
  const [fbBusy, setFbBusy] = useState(false);
  const runTeach = async () => {
    if (!chunk) return;
    setFbBusy(true);
    try {
      const r = await critique({ data: { concept: chunk.title ?? "", lesson: String(chunk.body ?? "").slice(0, 8000), explanation: teach } });
      if (!r.ok) { toast.error(r.error); return; }
      setFb(r.data);
      save({ progress: { ...progress, teach: { ...(progress.teach ?? {}), [idx]: r.data.score } } });
    } finally { setFbBusy(false); }
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("adaptive_sessions").select("*").eq("id", sessionId).maybeSingle().then(({ data }) => {
      if (!data) return;
      setS(data);
      const n = (data.chunks as any[])?.length ?? 0;
      setIdx(Math.max(0, n - 1));
      setPrereqDone(n > 0 || data.mode !== "A");
    });
  }, [user, sessionId]);

  const chunks: any[] = s?.chunks ?? [];
  const chunk = chunks[idx];
  const progress: any = s?.progress ?? {};
  const results: Record<number, boolean> = progress.results ?? {};

  const save = async (patch: any) => {
    const next = { ...s, ...patch };
    setS(next);
    await supabase.from("adaptive_sessions").update(patch).eq("id", sessionId);
  };

  const load = (() => {
    const vals = Object.values(results);
    const wrong = vals.filter((v) => !v).length;
    const lost = progress.lost ?? 0;
    const times = Object.values(progress.times ?? {}).map(Number);
    const slow = times.filter((t) => t > (s?.mode === "C" ? 600 : 300)).length;
    const score = wrong * 1 + lost * 1.5 + slow * 0.5 + (progress.backs ?? 0) * 0.3 - (progress.easy ?? 0);
    return score >= 3 ? "heavy" : score <= 0 ? "light" : "balanced";
  })();

  const generate = async (conceptId?: string, adj: Adjust = adjust) => {
    setBusy(true);
    try {
      const r = await fetchNext({ data: { sessionId, conceptId, adjust: adj } });
      if (!r.ok) { toast.error(r.error); return; }
      setS((prev: any) => ({ ...prev, chunks: [...(prev.chunks ?? []), r.data] }));
      setIdx(chunks.length);
      setPicked(null); setTeach(""); setFb(null);
      shownAt.current = Date.now();
    } finally { setBusy(false); }
  };

  const pick = (i: number) => {
    if (picked !== null || !chunk) return;
    setPicked(i);
    const ok = i === chunk.check?.answerIndex;
    const times = { ...(progress.times ?? {}), [idx]: Math.round((Date.now() - shownAt.current) / 1000) };
    save({ progress: { ...progress, results: { ...results, [idx]: ok }, times } });
    if (!ok) setAdjust("simpler");
    else if (load === "light" && adjust === "same") setAdjust("harder");
  };

  const signal = (kind: "lost" | "easy") => {
    save({ progress: { ...progress, [kind]: (progress[kind] ?? 0) + 1 } });
    const adj: Adjust = kind === "lost" ? "simpler" : "harder";
    setAdjust(adj);
    toast.message(kind === "lost" ? "Got it — I'll slow down and simplify." : "Nice — I'll go faster and deeper.");
  };

  if (!s) return <AppShell><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div></AppShell>;
  const a = s.analysis ?? {};
  const covered = new Set(chunks.map((c) => c.conceptId));

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4 pb-10">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/adaptive"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link></Button>
          <div className="flex items-center gap-2">
            <Badge variant={load === "heavy" ? "destructive" : "secondary"}>Load: {load}</Badge>
            <select aria-label="Switch mode" value={s.mode} onChange={(e) => save({ mode: e.target.value })}
              className="text-sm rounded-md border border-border bg-background px-2 py-1">
              <option value="A">Mode A</option><option value="B">Mode B</option><option value="C">Mode C</option>
            </select>
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold">{s.title}</h1>

        {/* Big picture map */}
        <Card className="p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Big picture</p>
          <div className="flex flex-wrap gap-1.5">
            {(a.keyConcepts ?? []).map((c: any) => (
              <button key={c.id} disabled={busy || s.mode === "A"} onClick={() => generate(c.id)}
                className={`text-xs rounded-full px-2.5 py-1 border transition ${covered.has(c.id) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"} ${s.mode !== "A" ? "hover:border-primary" : ""}`}>
                {c.name}
              </button>
            ))}
          </div>
          {s.mode !== "A" && <p className="text-[11px] text-muted-foreground mt-2">Tap a concept to explore that branch.</p>}
        </Card>

        {load === "heavy" && (
          <Card className="p-3 border-destructive/40 text-sm space-y-2">
            <p>This is getting heavy. Take a short break, or review earlier chunks before moving on.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setIdx(0); setPicked(null); }}>Recap from start</Button>
              <Button size="sm" variant="outline" onClick={() => { setAdjust("simpler"); save({ progress: { ...progress, lost: 0, backs: 0, times: {} } }); toast.message("Break taken — next lesson will be lighter."); }}>I took a break</Button>
            </div>
          </Card>
        )}

        {!prereqDone && (
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold">What you need to know first</h2>
            {(a.prerequisites ?? []).map((p: any, i: number) => (
              <div key={i} className="rounded-lg bg-muted/50 p-3"><p className="font-medium text-sm">{p.name}</p><p className="text-sm text-muted-foreground">{p.why}</p></div>
            ))}
            <Button className="w-full" onClick={() => { setPrereqDone(true); generate(); }}>I'm ready — start</Button>
          </Card>
        )}

        {prereqDone && !chunk && (
          <Button className="w-full" size="lg" disabled={busy} onClick={() => generate()}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing lesson…</> : "Start first lesson"}
          </Button>
        )}

        {chunk && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Chunk {idx + 1} of {chunks.length}</span><span className="capitalize">{chunk.difficulty} · pace: {adjust}</span>
            </div>
            <h2 className="text-lg font-semibold">{chunk.title}</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:block [&_table]:overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{chunk.body ?? ""}</ReactMarkdown>
            </div>
            {chunk.analogy && <div className="rounded-lg bg-accent/20 p-3 text-sm"><b>Analogy:</b> {chunk.analogy}</div>}
            <LessonVisual visual={chunk.visual} />
            {chunk.whyItWorks && <details className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">Why does this work?</summary><p className="mt-2">{chunk.whyItWorks}</p></details>}
            {chunk.goDeeper && <details className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">Go deeper</summary><p className="mt-2">{chunk.goDeeper}</p></details>}
            {chunk.connections && <details className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">Connect it to other fields</summary><p className="mt-2">{chunk.connections}</p></details>}

            {chunk.check && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="font-medium text-sm">Quick check: {chunk.check.question}</p>
                {(chunk.check.options ?? []).map((o: string, i: number) => {
                  const answered = picked !== null || results[idx] !== undefined;
                  const correct = i === chunk.check.answerIndex;
                  return (
                    <button key={i} onClick={() => pick(i)} disabled={answered}
                      className={`w-full text-left text-sm rounded-lg border p-3 flex items-center gap-2 ${answered && correct ? "border-primary bg-primary/10" : answered && picked === i ? "border-destructive bg-destructive/10" : "border-border"}`}>
                      {answered && correct && <Check className="w-4 h-4 text-primary" />}{answered && picked === i && !correct && <X className="w-4 h-4 text-destructive" />}{o}
                    </button>
                  );
                })}
                {(picked !== null || results[idx] !== undefined) && <p className="text-xs text-muted-foreground">{chunk.check.explanation}</p>}
              </div>
            )}

            {s.mode === "C" && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="font-medium text-sm">Teach it back</p>
                <Textarea rows={4} value={teach} onChange={(e) => setTeach(e.target.value)} placeholder="Explain this idea in your own words…" />
                <Button size="sm" disabled={fbBusy || teach.trim().length < 10} onClick={runTeach}>
                  {fbBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get feedback"}
                </Button>
                {fb && (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                    <p className="font-semibold">Score: {fb.score}/10</p>
                    {fb.strengths.length > 0 && <p><b>Strengths:</b> {fb.strengths.join("; ")}</p>}
                    {fb.gaps.length > 0 && <p><b>Gaps:</b> {fb.gaps.join("; ")}</p>}
                    {fb.misconceptions.length > 0 && <p><b>Misconceptions:</b> {fb.misconceptions.join("; ")}</p>}
                    {fb.betterVersion && <p className="text-muted-foreground"><b>Model answer:</b> {fb.betterVersion}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => signal("lost")}>I'm lost</Button>
              <Button variant="outline" size="sm" onClick={() => signal("easy")}>Too easy</Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => { setIdx(idx - 1); setPicked(null); save({ progress: { ...progress, backs: (progress.backs ?? 0) + 1 } }); }}>Previous</Button>
              {idx < chunks.length - 1 ? (
                <Button size="sm" onClick={() => { setIdx(idx + 1); setPicked(null); }}>Next</Button>
              ) : (
                <Button size="sm" disabled={busy || (s.mode === "A" && results[idx] === undefined && picked === null)} onClick={() => generate()}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
