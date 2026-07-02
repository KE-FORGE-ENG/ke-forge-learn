import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { parsePdf } from "@/lib/pdf";
import { callAi, youtubeSearchDirect } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Upload, Loader2, Sparkles, BookOpen, Lock, LogIn, RotateCw, RefreshCcw,
  Timer, CheckCircle2, XCircle, Network, Youtube, ClipboardCheck, FlaskConical,
  BookOpenCheck, Layers,
} from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/ke-forge-logo.png.asset.json";

export const Route = createFileRoute("/try")({ component: TryPage });

type DeepLesson = {
  title: string;
  deep_explanation: string;
  keywords: { term: string; definition: string; why_it_matters?: string }[];
  important_facts: string[];
  examples?: string[];
  likely_exam_questions: { question: string; answer: string }[];
  recap: string;
};

type QuizMode = "practice" | "test" | "cbt";
type Q = {
  type: "mcq" | "tf" | "fill" | "theory";
  question: string;
  options?: string[];
  answer: string;
  keywords?: string[];
  explanation: string;
};
type FC = { front: string; back: string };
type Mind = { root: string; branches: { label: string; children: string[] }[] };
type Vid = { videoId: string; title: string; channelTitle?: string; thumbnail?: string };

const GUEST_INTRO =
  "👋 You're in free trial mode — no account needed. Summarize a PDF or learn any topic, then unlock quizzes (Practice / Test / CBT exam), flashcards, mind maps and matched YouTube tutorials — all without signing up. " +
  "Sign in free to unlock even more: multi-day adaptive study plans, spaced-repetition flashcards, live tutor chat with memory, deep-learning mode, PDF page images, study reminders, notes, groups and progress analytics. " +
  "Nothing you do here is saved — sign in to keep your work.";

function gradeAnswer(q: Q, userA: string): boolean {
  const a = (userA ?? "").trim().toLowerCase();
  if (!a) return false;
  if (q.type === "mcq" || q.type === "tf") return a === q.answer.trim().toLowerCase();
  if (q.type === "fill") return a === q.answer.trim().toLowerCase() || a.includes(q.answer.trim().toLowerCase());
  const kws = (q.keywords?.length ? q.keywords : q.answer.split(/[\s,;.]+/).filter((w) => w.length > 4)).map((k) => k.toLowerCase());
  if (!kws.length) return a.length > 20;
  const hit = kws.filter((k) => a.includes(k)).length;
  return hit / kws.length >= 0.5;
}

function TryPage() {
  const [tab, setTab] = useState<"pdf" | "topic">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [lesson, setLesson] = useState<DeepLesson | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [status, setStatus] = useState("");

  const runPdf = async () => {
    if (!file) return;
    setBusy(true); setLesson(null); setStatus("Reading PDF…");
    try {
      const pages = await parsePdf(file);
      const combined = pages.map((p) => `--- Page ${p.page} ---\n${p.text}`).join("\n\n");
      const trimmed = combined.slice(0, 18000);
      setSourceText(trimmed);
      setStatus("Summarizing…");
      const result = (await callAi("deep_teach", { mode: "notes", pageText: trimmed })) as DeepLesson;
      setLesson(result);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); setStatus(""); }
  };

  const runTopic = async () => {
    if (!topic.trim()) return;
    setBusy(true); setLesson(null); setStatus("Teaching…");
    try {
      const result = (await callAi("deep_teach", { mode: "topic", topic: topic.trim() })) as DeepLesson;
      setLesson(result);
      setSourceText(`Topic: ${topic.trim()}\n\n${result.deep_explanation}\n\nFacts: ${(result.important_facts || []).join("; ")}`);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); setStatus(""); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 font-semibold min-w-0">
            <div className="w-9 h-9 rounded-lg bg-black grid place-items-center overflow-hidden flex-shrink-0">
              <img src={logoAsset.url} alt="KE-FORGE LEARN" className="w-full h-full object-contain" />
            </div>
            <span className="truncate hidden xs:inline">KE-FORGE LEARN</span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex">Free trial</Badge>
            <ThemeToggle />
            <Button asChild size="sm"><Link to="/auth"><LogIn className="w-4 h-4 mr-1" /> Sign in</Link></Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Try it free — no sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">Summarize a PDF or learn any topic, then unlock quizzes, flashcards, mind maps and YouTube.</p>
        </div>

        <Card className="p-4 mb-4 border-primary/30 bg-primary/5">
          <p className="text-sm leading-relaxed">{GUEST_INTRO}</p>
          <Button asChild size="sm" className="mt-3"><Link to="/auth">Sign in free to unlock everything</Link></Button>
        </Card>

        <Card className="p-4 sm:p-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="pdf"><BookOpen className="w-4 h-4 mr-1" /> PDF summary</TabsTrigger>
              <TabsTrigger value="topic"><Sparkles className="w-4 h-4 mr-1" /> Topic</TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-4 space-y-3">
              <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition">
                <input type="file" accept="application/pdf" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Upload className="w-7 h-7 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">{file ? file.name : "Click to choose a PDF"}</p>
              </label>
              <Button disabled={busy || !file} onClick={runPdf} className="w-full">
                {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {status || "Working…"}</> : "Summarize PDF"}
              </Button>
            </TabsContent>

            <TabsContent value="topic" className="mt-4 space-y-3">
              <Label>What do you want to learn?</Label>
              <Textarea rows={4} value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Photosynthesis, Newton's laws, Binary search…" />
              <Button disabled={busy || !topic.trim()} onClick={runTopic} className="w-full">
                {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {status || "Working…"}</> : "Teach me"}
              </Button>
            </TabsContent>
          </Tabs>
        </Card>

        {lesson && (
          <div className="space-y-4 mt-6">
            <Card className="p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold">{lesson.title}</h2>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-sm sm:text-base text-foreground/90">
                {lesson.deep_explanation}
              </p>
            </Card>

            {lesson.keywords?.length > 0 && (
              <Card className="p-4 sm:p-6">
                <h3 className="font-semibold text-base sm:text-lg mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Key terms
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {lesson.keywords.map((k, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-secondary/30">
                      <div className="font-semibold text-sm">{k.term}</div>
                      <p className="text-xs mt-1 text-foreground/85">{k.definition}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {lesson.important_facts?.length > 0 && (
              <Card className="p-4 sm:p-6">
                <h3 className="font-semibold text-base sm:text-lg mb-3">Important facts</h3>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {lesson.important_facts.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </Card>
            )}

            {lesson.likely_exam_questions?.length > 0 && (
              <Card className="p-4 sm:p-6">
                <h3 className="font-semibold text-base sm:text-lg mb-3">Likely exam questions</h3>
                <div className="space-y-3">
                  {lesson.likely_exam_questions.map((q, i) => (
                    <details key={i} className="border rounded-lg p-3">
                      <summary className="cursor-pointer font-medium text-sm">{i + 1}. {q.question}</summary>
                      <p className="mt-2 text-sm text-foreground/85">{q.answer}</p>
                    </details>
                  ))}
                </div>
              </Card>
            )}

            {lesson.recap && (
              <Card className="p-4 sm:p-6">
                <h3 className="font-semibold mb-2">Recap</h3>
                <p className="text-sm text-foreground/85">{lesson.recap}</p>
              </Card>
            )}

            {/* Tools section */}
            <Card className="p-3 sm:p-4">
              <Tabs defaultValue="quiz">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="quiz" className="text-xs sm:text-sm"><ClipboardCheck className="w-4 h-4 mr-1" /> Quiz</TabsTrigger>
                  <TabsTrigger value="cards" className="text-xs sm:text-sm"><Layers className="w-4 h-4 mr-1" /> Cards</TabsTrigger>
                  <TabsTrigger value="mind" className="text-xs sm:text-sm"><Network className="w-4 h-4 mr-1" /> Mind</TabsTrigger>
                  <TabsTrigger value="yt" className="text-xs sm:text-sm"><Youtube className="w-4 h-4 mr-1" /> Videos</TabsTrigger>
                </TabsList>
                <TabsContent value="quiz" className="mt-4"><QuizPanel sourceText={sourceText} lessonTitle={lesson.title} /></TabsContent>
                <TabsContent value="cards" className="mt-4"><FlashPanel sourceText={sourceText} lessonTitle={lesson.title} /></TabsContent>
                <TabsContent value="mind" className="mt-4"><MindPanel sourceText={sourceText} lessonTitle={lesson.title} /></TabsContent>
                <TabsContent value="yt" className="mt-4"><YoutubePanel lessonTitle={lesson.title} sourceText={sourceText} /></TabsContent>
              </Tabs>
            </Card>

            <Card className="p-4 border-primary/30 bg-primary/5">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Want to save this and go deeper?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sign in free to save your work, get multi-day plans, spaced-repetition flashcards, live tutor chat, deep-learning mode and more.
                  </p>
                  <Button asChild size="sm" className="mt-3"><Link to="/auth">Sign in free</Link></Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------------- Quiz panel (Practice / Test / CBT) ---------------- */
function QuizPanel({ sourceText, lessonTitle }: { sourceText: string; lessonTitle: string }) {
  const [mode, setMode] = useState<QuizMode>("practice");
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

  const maxCount = mode === "cbt" ? 60 : 30;
  useEffect(() => { if (count > maxCount) setCount(maxCount); }, [mode, maxCount, count]);

  const submit = () => {
    setSubmitted(true);
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (!questions || submitted || !useTimer || mode === "practice" || secondsLeft <= 0) return;
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { window.clearInterval(timerRef.current!); submit(); return 0; }
        return s - 1;
      });
    }, 1000) as unknown as number;
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    // eslint-disable-next-line
  }, [questions, submitted, useTimer, mode]);

  const generate = async (refresh = false) => {
    setStarted(true); setBusy(true); setQuestions(null); setAnswers({}); setSubmitted(false);
    try {
      const seed = refresh ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : undefined;
      const r = (await callAi("generate_quiz", {
        sourceText: sourceText || lessonTitle,
        day: 1,
        count: Math.max(3, Math.min(maxCount, count)),
        mode, seed,
      })) as { questions: Q[] };
      setQuestions(r.questions);
      if (useTimer && mode !== "practice") setSecondsLeft(timerMin * 60);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const score = useMemo(() => {
    if (!questions || !submitted) return 0;
    return questions.reduce((s, q, i) => s + (gradeAnswer(q, answers[i] ?? "") ? 1 : 0), 0);
  }, [questions, answers, submitted]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const modeMeta: Record<QuizMode, { label: string; icon: any; desc: string }> = {
    practice: { label: "Practice", icon: BookOpenCheck, desc: "Mixed MCQ, true/false, fill-in." },
    test: { label: "Test mode", icon: FlaskConical, desc: "Theory. Instant feedback per question. Up to 30." },
    cbt: { label: "CBT exam", icon: ClipboardCheck, desc: "MCQ only. Timed. Graded at end. Up to 60." },
  };

  if (!started) {
    return (
      <div className="space-y-5">
        <div>
          <Label className="text-sm mb-2 block">Choose a mode</Label>
          <div className="grid sm:grid-cols-3 gap-2">
            {(Object.keys(modeMeta) as QuizMode[]).map((m) => {
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
          <div className="flex items-center gap-3 mt-2 flex-wrap">
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
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Input id="qtimer" type="number" min={1} max={180} value={timerMin} disabled={!useTimer}
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
      </div>
    );
  }

  if (busy) {
    return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="mt-3 text-sm text-muted-foreground">Generating {count} questions…</p></div>;
  }

  if (!questions) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">{modeMeta[mode].label} • {questions.length} questions</div>
        <div className="flex items-center gap-2">
          {useTimer && mode !== "practice" && !submitted && (
            <div className={`text-sm font-mono px-2.5 py-1 rounded-md border ${secondsLeft < 60 ? "border-destructive text-destructive" : ""}`}>
              <Timer className="w-3.5 h-3.5 inline mr-1" /> {fmtTime(secondsLeft)}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => generate(true)} disabled={busy}>
            <RefreshCcw className="w-3.5 h-3.5 mr-1" /> New questions
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setStarted(false); setQuestions(null); }}>Reset</Button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {questions.map((q, i) => {
          const userA = answers[i] ?? "";
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
                  <Textarea rows={4} value={userA} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} placeholder="Type your answer…" disabled={locked} />
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
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

/* ---------------- Flashcards panel (simple flip, no persistence) ---------------- */
function FlashPanel({ sourceText, lessonTitle }: { sourceText: string; lessonTitle: string }) {
  const [cards, setCards] = useState<FC[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true); setCards(null); setIdx(0); setFlipped(false);
    try {
      const r = await callAi("generate_flashcards", {
        sourceText: sourceText || lessonTitle,
        dayContent: { title: lessonTitle, summary: "", concepts: [] },
        count: 12,
      });
      setCards(r.cards as FC[]);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  if (!cards) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">Generate 12 flashcards from this lesson.</p>
        <Button onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Generate flashcards
        </Button>
        <p className="text-[11px] text-muted-foreground mt-3">Sign in to save cards and use spaced repetition.</p>
      </div>
    );
  }

  const current = cards[idx];
  const next = () => { setFlipped(false); setIdx((i) => (i + 1) % cards.length); };
  const prev = () => { setFlipped(false); setIdx((i) => (i - 1 + cards.length) % cards.length); };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
        <span>Card {idx + 1} / {cards.length}</span>
        <Button variant="ghost" size="sm" onClick={generate}><RefreshCcw className="w-3.5 h-3.5 mr-1" /> New set</Button>
      </div>
      <Card
        className="p-8 min-h-[200px] cursor-pointer select-none flex items-center justify-center text-center transition"
        onClick={() => setFlipped(!flipped)}
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-primary mb-3">{flipped ? "Answer" : "Question"}</div>
          <p className="text-lg font-medium whitespace-pre-wrap">{flipped ? current.back : current.front}</p>
          {!flipped && <p className="text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1"><RotateCw className="w-3 h-3" /> Tap to flip</p>}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button variant="outline" onClick={prev}>← Previous</Button>
        <Button onClick={next}>Next →</Button>
      </div>
    </div>
  );
}

/* ---------------- Mind map panel ---------------- */
function MindPanel({ sourceText, lessonTitle }: { sourceText: string; lessonTitle: string }) {
  const [mind, setMind] = useState<Mind | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const r = (await callAi("generate_mindmap", { sourceText: sourceText || lessonTitle, docTitle: lessonTitle })) as Mind;
      setMind(r);
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const W = 1000, H = 700, cx = W / 2, cy = H / 2;

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button onClick={generate} disabled={busy} size="sm">
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          {mind ? "Regenerate" : "Generate"}
        </Button>
      </div>
      {!mind ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <Network className="w-8 h-8 mx-auto mb-2 text-primary/60" />
          Visualize the key concepts of "{lessonTitle}".
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto min-w-[600px]">
            {mind.branches.map((b, i) => {
              const n = mind.branches.length;
              const a = (i / n) * Math.PI * 2 - Math.PI / 2;
              const bx = cx + 220 * Math.cos(a);
              const by = cy + 220 * Math.sin(a);
              return (
                <g key={i}>
                  <line x1={cx} y1={cy} x2={bx} y2={by} stroke="var(--primary)" strokeWidth={2} opacity={0.6} />
                  {b.children.map((_, j) => {
                    const cn = b.children.length;
                    const spread = Math.PI / 3;
                    const ca = a - spread / 2 + (j / Math.max(1, cn - 1)) * spread;
                    const cax = cx + 360 * Math.cos(ca);
                    const cay = cy + 360 * Math.sin(ca);
                    return <line key={j} x1={bx} y1={by} x2={cax} y2={cay} stroke="var(--muted-foreground)" strokeWidth={1.2} opacity={0.4} />;
                  })}
                </g>
              );
            })}
            <circle cx={cx} cy={cy} r={70} fill="var(--primary)" />
            <foreignObject x={cx - 65} y={cy - 30} width={130} height={60}>
              <div style={{ width: 130, height: 60 }} className="flex items-center justify-center text-center text-primary-foreground text-sm font-bold leading-tight px-2">
                {mind.root}
              </div>
            </foreignObject>
            {mind.branches.map((b, i) => {
              const n = mind.branches.length;
              const a = (i / n) * Math.PI * 2 - Math.PI / 2;
              const bx = cx + 220 * Math.cos(a);
              const by = cy + 220 * Math.sin(a);
              return (
                <g key={`b-${i}`}>
                  <rect x={bx - 70} y={by - 22} width={140} height={44} rx={12} fill="var(--card)" stroke="var(--primary)" strokeWidth={1.5} />
                  <foreignObject x={bx - 65} y={by - 18} width={130} height={36}>
                    <div style={{ width: 130, height: 36 }} className="flex items-center justify-center text-center text-foreground text-xs font-semibold leading-tight px-1">{b.label}</div>
                  </foreignObject>
                  {b.children.map((c, j) => {
                    const cn = b.children.length;
                    const spread = Math.PI / 3;
                    const ca = a - spread / 2 + (j / Math.max(1, cn - 1)) * spread;
                    const cax = cx + 360 * Math.cos(ca);
                    const cay = cy + 360 * Math.sin(ca);
                    return (
                      <g key={j}>
                        <rect x={cax - 55} y={cay - 16} width={110} height={32} rx={10} fill="var(--secondary)" />
                        <foreignObject x={cax - 50} y={cay - 12} width={100} height={24}>
                          <div style={{ width: 100, height: 24 }} className="flex items-center justify-center text-center text-secondary-foreground text-[10px] leading-tight px-1">{c}</div>
                        </foreignObject>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

/* ---------------- YouTube panel ---------------- */
function YoutubePanel({ lessonTitle, sourceText }: { lessonTitle: string; sourceText: string }) {
  const [vids, setVids] = useState<Vid[] | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    try {
      const r = await youtubeSearchDirect(lessonTitle, {
        docTitle: lessonTitle,
        pageText: sourceText.slice(0, 4000),
        dayTitle: lessonTitle,
      });
      setVids((r?.videos ?? r?.items ?? []) as Vid[]);
    } catch (e: any) { toast.error(e.message ?? "Search failed"); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Button onClick={search} disabled={busy} size="sm">
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Youtube className="w-4 h-4 mr-1" />}
          {vids ? "Refresh" : "Find tutorials"}
        </Button>
      </div>
      {!vids ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <Youtube className="w-8 h-8 mx-auto mb-2 text-primary/60" />
          Find YouTube tutorials matched to "{lessonTitle}".
        </div>
      ) : vids.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No videos found. Try again.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {vids.map((v) => (
            <a key={v.videoId} href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer"
              className="border rounded-lg overflow-hidden hover:border-primary transition">
              <div className="aspect-video bg-black">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${v.videoId}`}
                  title={v.title}
                  allow="accelerometer; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-2">
                <div className="text-sm font-medium line-clamp-2">{v.title}</div>
                {v.channelTitle && <div className="text-xs text-muted-foreground mt-0.5">{v.channelTitle}</div>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
