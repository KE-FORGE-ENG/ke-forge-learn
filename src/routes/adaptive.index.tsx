import { styleDirective } from "@/lib/preferences";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { analyzeMaterial } from "@/lib/adaptive.functions";
import { Loader2, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/adaptive/")({
  head: () => ({
    meta: [
      { title: "Adaptive Learn — KE-FORGE LEARN" },
      { name: "description", content: "Upload material, answer a few questions, and learn at a pace that adapts to you." },
      { property: "og:title", content: "Adaptive Learn — KE-FORGE LEARN" },
      { property: "og:description", content: "Cognitive-load-aware lessons tailored to your level." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdaptiveHome,
});

const QUESTIONS = [
  { key: "familiarity", q: "How familiar are you with this topic?", opts: ["Brand new", "I know a little", "Comfortable", "Very experienced"] },
  { key: "goal", q: "What's your goal?", opts: ["Understand", "Apply", "Master"] },
  { key: "time", q: "How much time do you have per session?", opts: ["10 min", "25 min", "45 min", "1 hour+"] },
  { key: "style", q: "How do you like to learn?", opts: ["Visual", "Text", "Mixed"] },
] as const;

const MODES: Record<string, { name: string; desc: string }> = {
  A: { name: "New to the topic", desc: "One idea at a time, analogies, simple visuals." },
  B: { name: "Intermediate", desc: "Connected ideas, concept maps, go-deeper sections." },
  C: { name: "Deep dive", desc: "Dense, fast, edge cases and challenge questions." },
};

function recommend(complexity: string, a: Record<string, string>) {
  const fam = QUESTIONS[0].opts.indexOf(a.familiarity as never);
  const goal = QUESTIONS[1].opts.indexOf(a.goal as never);
  const cx = complexity === "advanced" ? 1 : complexity === "beginner" ? -1 : 0;
  const score = fam + goal * 0.7 - cx * 0.5;
  return score < 1.2 ? "A" : score < 2.8 ? "B" : "C";
}

async function readFile(f: File): Promise<string> {
  const n = f.name.toLowerCase();
  if (n.endsWith(".pdf")) {
    const { parsePdf } = await import("@/lib/pdf");
    const pages = await parsePdf(f);
    return pages.map((p) => `[Page ${p.page}]\n${p.text}`).join("\n\n");
  }
  if (n.endsWith(".docx")) {
    const mammoth: any = await import("mammoth");
    const r = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer: await f.arrayBuffer() });
    return r.value;
  }
  return f.text();
}

function AdaptiveHome() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const analyze = useServerFn(analyzeMaterial);
  const [sessions, setSessions] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);
  useEffect(() => {
    if (!user) return;
    supabase.from("adaptive_sessions").select("id,title,mode,chunks,updated_at").order("updated_at", { ascending: false }).limit(20)
      .then(({ data }) => setSessions(data ?? []));
  }, [user]);

  const onFile = async (f: File) => {
    setBusy(true);
    try { setText(await readFile(f)); setFileName(f.name); }
    catch { toast.error("Couldn't read that file."); }
    finally { setBusy(false); }
  };

  const runAnalysis = async () => {
    setBusy(true);
    try {
      const r = await analyze({ data: { text: text.trim(), style: styleDirective() } });
      if (!r.ok) { toast.error(r.error); return; }
      setAnalysis(r.data); setStep(0); setAnswers({}); setMode(null);
    } finally { setBusy(false); }
  };

  const answer = (key: string, v: string) => {
    const next = { ...answers, [key]: v };
    setAnswers(next);
    if (step + 1 < QUESTIONS.length) setStep(step + 1);
    else { setStep(QUESTIONS.length); setMode(recommend(analysis.complexity, next)); }
  };

  const start = async (m: string) => {
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.from("adaptive_sessions").insert({
      user_id: user.id, title: analysis.topic, source_text: text.slice(0, 60000),
      analysis, answers, mode: m,
    }).select("id").single();
    setBusy(false);
    if (error || !data) { toast.error(error?.message ?? "Couldn't start"); return; }
    nav({ to: "/adaptive/$sessionId", params: { sessionId: data.id } });
  };

  if (!user) return null;
  const done = step >= QUESTIONS.length;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Adaptive Learn</h1>
          <p className="text-muted-foreground mt-1">Lessons that adjust to your level and pace.</p>
        </div>

        {!analysis && (
          <Card className="p-5 space-y-4">
            <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition">
              <input type="file" accept=".pdf,.docx,.txt,.md,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              <Upload className="w-7 h-7 mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">{fileName || "Upload PDF, Word, or text file"}</p>
            </label>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="…or type a topic / paste notes" />
            <Button className="w-full" size="lg" disabled={busy || text.trim().length < 3} onClick={runAnalysis}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4 mr-2" /> Analyze material</>}
            </Button>
          </Card>
        )}

        {analysis && (
          <Card className="p-5 space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Here's what I found in your material</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{analysis.topic}</h2>
              <Badge variant="secondary" className="capitalize">{analysis.complexity}</Badge>
            </div>
            <p className="text-sm">{analysis.summary}</p>
            {analysis.prerequisites?.length > 0 && (
              <div><p className="text-sm font-medium mb-1">You'll need first</p>
                <div className="flex flex-wrap gap-1.5">{analysis.prerequisites.map((p: any, i: number) => <Badge key={i} variant="outline">{p.name}</Badge>)}</div></div>
            )}
            <div><p className="text-sm font-medium mb-1">Key concepts ({analysis.keyConcepts.length})</p>
              <div className="flex flex-wrap gap-1.5">{analysis.keyConcepts.map((c: any) => <Badge key={c.id}>{c.name}</Badge>)}</div></div>
            <Button variant="ghost" size="sm" onClick={() => setAnalysis(null)}>Use different material</Button>
          </Card>
        )}

        {analysis && !done && (
          <Card className="p-5 space-y-4">
            <Progress value={(step / QUESTIONS.length) * 100} />
            <p className="font-medium">{QUESTIONS[step].q}</p>
            <div className="grid gap-2">
              {QUESTIONS[step].opts.map((o) => (
                <Button key={o} variant="outline" className="justify-start h-auto py-3" onClick={() => answer(QUESTIONS[step].key, o)}>{o}</Button>
              ))}
            </div>
          </Card>
        )}

        {analysis && done && mode && (
          <Card className="p-5 space-y-3">
            <p className="font-medium">Recommended mode</p>
            {Object.entries(MODES).map(([k, m]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`w-full text-left rounded-lg border p-3 transition ${mode === k ? "border-primary bg-primary/10" : "border-border"}`}>
                <div className="flex items-center gap-2"><span className="font-semibold">Mode {k}: {m.name}</span>
                  {k === recommend(analysis.complexity, answers) && <Badge variant="secondary">Recommended</Badge>}</div>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </button>
            ))}
            <Button className="w-full" size="lg" disabled={busy} onClick={() => start(mode)}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start learning"}
            </Button>
          </Card>
        )}

        {sessions.length > 0 && !analysis && (
          <div className="space-y-2">
            <h2 className="font-semibold">Continue</h2>
            {sessions.map((s) => (
              <Link key={s.id} to="/adaptive/$sessionId" params={{ sessionId: s.id }}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 hover:border-primary/50">
                <span className="truncate text-sm font-medium">{s.title}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">Mode {s.mode} · {(s.chunks ?? []).length} done</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
