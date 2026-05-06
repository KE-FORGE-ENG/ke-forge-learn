import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { callAi } from "@/lib/api";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/quiz/$planId/$day")({ component: Quiz });

type Q = { type: "mcq" | "tf" | "fill"; question: string; options?: string[]; answer: string; explanation: string };

function Quiz() {
  const { planId, day } = Route.useParams();
  const dayN = parseInt(day, 10);
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setBusy(true);
      try {
        const { data: plan } = await supabase.from("learning_plans").select("*").eq("id", planId).single();
        const { data: doc } = await supabase.from("documents").select("*").eq("id", plan!.document_id).single();
        const chunks = (plan!.page_chunks as any[]);
        const upTo = chunks.find((c) => c.day === dayN)?.endPage ?? doc!.page_count;
        const pages = (doc!.pages as { page: number; text: string }[]).filter((p) => p.page <= upTo);
        const sourceText = pages.map((p) => p.text).join("\n\n");
        const r = (await callAi("generate_quiz", { sourceText, day: dayN, count: 6 })) as { questions: Q[] };
        setQuestions(r.questions);
      } catch (e: any) { toast.error(e.message ?? "Failed"); }
      finally { setBusy(false); }
    })();
  }, [user, planId, dayN]);

  const score = useMemo(() => {
    if (!questions || !submitted) return 0;
    let s = 0;
    questions.forEach((q, i) => {
      const a = (answers[i] ?? "").trim().toLowerCase();
      if (a && a === q.answer.trim().toLowerCase()) s++;
    });
    return s;
  }, [questions, answers, submitted]);

  const submit = async () => {
    if (!questions || !user) return;
    setSubmitted(true);
    const total = questions.length;
    const pct = (score / total) * 100;
    const weak = questions.filter((q, i) => (answers[i] ?? "").toLowerCase() !== q.answer.toLowerCase()).map((q) => q.question);
    await supabase.from("quizzes").insert({
      user_id: user.id, plan_id: planId, day: dayN, questions, answers, score: pct, weak_areas: weak,
    });
    await supabase.from("user_interactions").insert({
      user_id: user.id, plan_id: planId, day: dayN, kind: "quiz_score", payload: { score: pct },
    });
  };

  if (!user) return null;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <Link to="/learn/$planId" params={{ planId }} className="text-sm text-muted-foreground hover:text-foreground">← Back to lesson</Link>
        <h1 className="text-3xl font-bold mt-2">Day {dayN} quiz</h1>
        <p className="text-muted-foreground mt-1">Mix of MCQ, true/false, and fill-in-blank.</p>

        {busy ? (
          <Card className="p-12 text-center mt-6"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="mt-3 text-sm text-muted-foreground">Generating quiz…</p></Card>
        ) : !questions ? null : (
          <div className="mt-6 space-y-4">
            {questions.map((q, i) => {
              const userA = answers[i] ?? "";
              const correct = submitted && userA.trim().toLowerCase() === q.answer.trim().toLowerCase();
              return (
                <Card key={i} className="p-5">
                  <div className="text-xs text-muted-foreground uppercase">{q.type === "mcq" ? "Multiple choice" : q.type === "tf" ? "True / False" : "Fill in the blank"}</div>
                  <p className="font-medium mt-1">{i + 1}. {q.question}</p>
                  <div className="mt-3 space-y-2">
                    {q.type === "mcq" && q.options?.map((o) => (
                      <label key={o} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${userA === o ? "border-primary bg-secondary" : "border-border"}`}>
                        <input type="radio" name={`q${i}`} value={o} checked={userA === o} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} disabled={submitted} />
                        <span className="text-sm">{o}</span>
                      </label>
                    ))}
                    {q.type === "tf" && ["True", "False"].map((o) => (
                      <label key={o} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${userA === o ? "border-primary bg-secondary" : "border-border"}`}>
                        <input type="radio" name={`q${i}`} value={o} checked={userA === o} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} disabled={submitted} />
                        <span className="text-sm">{o}</span>
                      </label>
                    ))}
                    {q.type === "fill" && (
                      <Input value={userA} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} placeholder="Your answer" disabled={submitted} />
                    )}
                  </div>
                  {submitted && (
                    <div className={`mt-3 text-sm flex items-start gap-2 ${correct ? "text-emerald-700" : "text-destructive"}`}>
                      {correct ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
                      <div>
                        <div className="font-semibold">{correct ? "Correct" : `Answer: ${q.answer}`}</div>
                        <div className="text-foreground/80">{q.explanation}</div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            {!submitted ? (
              <Button onClick={submit} className="w-full" size="lg" disabled={Object.keys(answers).length < questions.length}>
                Submit quiz
              </Button>
            ) : (
              <Card className="p-6 text-center bg-[image:var(--gradient-soft)]">
                <div className="text-3xl font-bold">{score} / {questions.length}</div>
                <p className="text-muted-foreground mt-1">{score / questions.length >= 0.7 ? "Great work!" : "Review the explanations and try again tomorrow."}</p>
                <Button asChild className="mt-4"><Link to="/learn/$planId" params={{ planId }}>Back to lesson</Link></Button>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
