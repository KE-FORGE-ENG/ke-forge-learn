import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { callAi } from "@/lib/api";
import { Loader2, CheckCircle2, XCircle, RefreshCcw, Timer, BookOpenCheck, ClipboardCheck, FlaskConical } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/quiz/$planId/$day")({ component: Quiz });

type Mode = "practice" | "test" | "cbt";
type Q = {
  type: "mcq" | "tf" | "fill" | "theory";
  question: string;
  options?: string[];
  answer: string;
  keywords?: string[];
  explanation: string;
};

function gradeAnswer(q: Q, userA: string): boolean {
  const a = (userA ?? "").trim().toLowerCase();
  if (!a) return false;
  if (q.type === "mcq" || q.type === "tf") return a === q.answer.trim().toLowerCase();
  if (q.type === "fill") return a === q.answer.trim().toLowerCase() || a.includes(q.answer.trim().toLowerCase());
  // theory: keyword-based grading
  const kws = (q.keywords && q.keywords.length ? q.keywords : q.answer.split(/[\s,;.]+/).filter((w) => w.length > 4)).map((k) => k.toLowerCase());
  if (!kws.length) return a.length > 20;
  const hit = kws.filter((k) => a.includes(k)).length;
  return hit / kws.length >= 0.5;
}

function Quiz() {
  const { planId, day } = Route.useParams();
  const dayN = parseInt(day, 10);
  const { user, loading } = useAuth();
  const nav = useNavigate();

  const [mode, setMode] = useState<Mode>("practice");
  const [count, setCount] = useState(10);
  const [timerMin, setTimerMin] = useState(15);
  const [useTimer, setUseTimer] = useState(true);

  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  const maxCount = mode === "cbt" ? 60 : mode === "test" ? 30 : 30;
  useEffect(() => { if (count > maxCount) setCount(maxCount); }, [mode, maxCount, count]);

  const generate = async (refresh = false) => {
    if (!user) return;
    setStarted(true);
    setBusy(true);
    setQuestions(null);
    setAnswers({});
    setSubmitted(false);
    try {
      const { data: plan } = await supabase.from("learning_plans").select("*").eq("id", planId).single();
      const { data: doc } = await supabase.from("documents").select("*").eq("id", plan!.document_id).single();
      const chunks = (plan!.page_chunks as any[]);
      const upTo = chunks.find((c) => c.day === dayN)?.endPage ?? doc!.page_count;
      const pages = (doc!.pages as { page: number; text: string }[]).filter((p) => p.page <= upTo);
      const sourceText = pages.map((p) => p.text).join("\n\n");
      const seed = refresh ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : undefined;
      const r = (await callAi("generate_quiz", {
        sourceText, day: dayN,
        count: Math.max(3, Math.min(maxCount, count)),
        mode,
        seed,
      })) as { questions: Q[] };
      setQuestions(r.questions);
      if (useTimer && mode !== "practice") {
        setSecondsLeft(timerMin * 60);
      }
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  // Timer
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (!questions || submitted || !useTimer || mode === "practice" || secondsLeft <= 0) return;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(timerRef.current!);
          submit();
          return 0;
        }
        return s - 1;
      });
    }, 1000) as unknown as number;
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line
  }, [questions, submitted, useTimer, mode]);

  const score = useMemo(() => {
    if (!questions || !submitted) return 0;
    return questions.reduce((s, q, i) => s + (gradeAnswer(q, answers[i] ?? "") ? 1 : 0), 0);
  }, [questions, answers, submitted]);

  const submit = async () => {
    if (!questions || !user) return;
    setSubmitted(true);
    const total = questions.length;
    const correctCount = questions.reduce((s, q, i) => s + (gradeAnswer(q, answers[i] ?? "") ? 1 : 0), 0);
    const pct = (correctCount / total) * 100;
    const weak = questions.filter((q, i) => !gradeAnswer(q, answers[i] ?? "")).map((q) => q.question);
    await supabase.from("quizzes").insert({
      user_id: user.id, plan_id: planId, day: dayN, questions, answers, score: pct, weak_areas: weak,
    });
    await supabase.from("user_interactions").insert({
      user_id: user.id, plan_id: planId, day: dayN, kind: "quiz_score", payload: { score: pct, mode },
    });
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!user) return null;

  const modeMeta: Record<Mode, { label: string; icon: any; desc: string }> = {
    practice: { label: "Practice", icon: BookOpenCheck, desc: "Mixed MCQ, true/false, fill-in. Review at the end." },
    test: { label: "Test mode", icon: FlaskConical, desc: "Theory only. Instant correct/wrong feedback after each question. Up to 30 questions." },
    cbt: { label: "CBT exam", icon: ClipboardCheck, desc: "Multiple choice only. Timed. Marked at the end like a real exam. Up to 60 questions." },
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <Link to="/learn/$planId" params={{ planId }} className="text-sm text-muted-foreground hover:text-foreground">← Back to lesson</Link>
        <h1 className="text-3xl font-bold mt-2">Day {dayN} quiz</h1>

        {!started ? (
          <Card className="p-6 mt-6 space-y-5">
            <div>
              <Label className="text-sm mb-2 block">Choose a mode</Label>
              <div className="grid sm:grid-cols-3 gap-2">
                {(Object.keys(modeMeta) as Mode[]).map((m) => {
                  const M = modeMeta[m]; const Icon = M.icon;
                  return (
                    <button key={m} onClick={() => setMode(m)}
                      className={`text-left p-3 rounded-lg border transition ${mode === m ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary"}`}>
                      <div className="flex items-center gap-1.5 font-semibold text-sm"><Icon className="w-4 h-4 text-primary" /> {M.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">{M.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="qcount">Number of questions</Label>
              <p className="text-xs text-muted-foreground">Between 3 and {maxCount}.</p>
              <div className="flex items-center gap-3 mt-2">
                <Input id="qcount" type="number" min={3} max={maxCount} value={count}
                  onChange={(e) => setCount(Math.max(3, Math.min(maxCount, parseInt(e.target.value) || 10)))}
                  className="w-24" />
                <div className="flex flex-wrap gap-1">
                  {[10, 20, 30, ...(mode === "cbt" ? [45, 60] : [])].map((n) => (
                    <Button key={n} type="button" size="sm" variant={count === n ? "default" : "outline"} onClick={() => setCount(n)}>{n}</Button>
                  ))}
                </div>
              </div>
            </div>

            {mode !== "practice" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="qtimer" className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> Timer (minutes)</Label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={useTimer} onChange={(e) => setUseTimer(e.target.checked)} /> Use timer
                  </label>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Input id="qtimer" type="number" min={1} max={180} value={timerMin}
                    disabled={!useTimer}
                    onChange={(e) => setTimerMin(Math.max(1, Math.min(180, parseInt(e.target.value) || 15)))}
                    className="w-24" />
                  <div className="flex flex-wrap gap-1">
                    {[10, 20, 30, 45, 60].map((n) => (
                      <Button key={n} type="button" size="sm" variant={timerMin === n ? "default" : "outline"} disabled={!useTimer} onClick={() => setTimerMin(n)}>{n}m</Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button onClick={() => generate(false)} className="w-full" size="lg">Start {modeMeta[mode].label}</Button>
          </Card>
        ) : busy ? (
          <Card className="p-12 text-center mt-6"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="mt-3 text-sm text-muted-foreground">Generating {count} {mode === "practice" ? "mixed" : "theory"} questions…</p></Card>
        ) : !questions ? null : (
          <>
            <div className="mt-6 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-muted-foreground">
                {modeMeta[mode].label} • {questions.length} questions
              </div>
              <div className="flex items-center gap-2">
                {useTimer && mode !== "practice" && !submitted && (
                  <div className={`text-sm font-mono px-2.5 py-1 rounded-md border ${secondsLeft < 60 ? "border-destructive text-destructive" : ""}`}>
                    <Timer className="w-3.5 h-3.5 inline mr-1" /> {fmtTime(secondsLeft)}
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => generate(true)} disabled={busy}>
                  <RefreshCcw className="w-3.5 h-3.5 mr-1" /> New questions
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {questions.map((q, i) => {
                const userA = answers[i] ?? "";
                // Test mode: immediate per-question feedback once an answer is provided
                const showFeedback =
                  submitted ||
                  (mode === "test" && userA.trim().length > 0 &&
                    (q.type === "mcq" || q.type === "tf" || (userA.trim().length > 5)));
                const isCorrect = showFeedback && gradeAnswer(q, userA);
                const locked = submitted || (mode === "test" && showFeedback);
                const typeLabel =
                  q.type === "mcq" ? "Multiple choice" :
                  q.type === "tf" ? "True / False" :
                  q.type === "fill" ? "Fill in the blank" : "Theory";

                return (
                  <Card key={i} className="p-5">
                    <div className="text-xs text-muted-foreground uppercase">{typeLabel}</div>
                    <p className="font-medium mt-1">{i + 1}. {q.question}</p>
                    <div className="mt-3 space-y-2">
                      {q.type === "mcq" && q.options?.map((o) => (
                        <label key={o} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${userA === o ? "border-primary bg-secondary" : "border-border"}`}>
                          <input type="radio" name={`q${i}`} value={o} checked={userA === o} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} disabled={locked} />
                          <span className="text-sm">{o}</span>
                        </label>
                      ))}
                      {q.type === "tf" && ["True", "False"].map((o) => (
                        <label key={o} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${userA === o ? "border-primary bg-secondary" : "border-border"}`}>
                          <input type="radio" name={`q${i}`} value={o} checked={userA === o} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} disabled={locked} />
                          <span className="text-sm">{o}</span>
                        </label>
                      ))}
                      {q.type === "fill" && (
                        <Input value={userA} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} placeholder="Your answer" disabled={locked} />
                      )}
                      {q.type === "theory" && (
                        <Textarea rows={4} value={userA} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} placeholder="Type your answer (theory)…" disabled={locked} />
                      )}
                    </div>
                    {showFeedback && (
                      <div className={`mt-3 text-sm flex items-start gap-2 ${isCorrect ? "text-emerald-700" : "text-destructive"}`}>
                        {isCorrect ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
                        <div>
                          <div className="font-semibold">{isCorrect ? "Correct" : "Not quite"}</div>
                          <div className="text-foreground/85"><span className="font-medium">Model answer:</span> {q.answer}</div>
                          {q.keywords && q.keywords.length > 0 && (
                            <div className="text-xs mt-1 text-muted-foreground">Key terms: {q.keywords.join(", ")}</div>
                          )}
                          <div className="text-foreground/80 mt-1">{q.explanation}</div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}

              {!submitted ? (
                <Button onClick={submit} className="w-full" size="lg" disabled={Object.keys(answers).length < questions.length}>
                  Submit {mode === "cbt" ? "exam" : "quiz"}
                </Button>
              ) : (
                <Card className="p-6 text-center bg-[image:var(--gradient-soft)]">
                  <div className="text-3xl font-bold">{score} / {questions.length}</div>
                  <p className="text-muted-foreground mt-1">{(score / questions.length) >= 0.7 ? "Great work!" : "Review the explanations and try again."}</p>
                  <div className="flex gap-2 justify-center mt-4">
                    <Button onClick={() => generate(true)} variant="outline"><RefreshCcw className="w-4 h-4 mr-1" /> New questions</Button>
                    <Button asChild><Link to="/learn/$planId" params={{ planId }}>Back to lesson</Link></Button>
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
