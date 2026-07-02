import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { parsePdf } from "@/lib/pdf";
import { callAi } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Upload, Loader2, Sparkles, BookOpen, Lock, LogIn } from "lucide-react";
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

const GUEST_INTRO =
  "👋 You're in free trial mode — no account needed. You can summarize PDFs and learn any topic here. " +
  "Sign in free to unlock the full experience: multi-day adaptive plans, YouTube tutorials matched to each lesson, " +
  "AI flashcards with spaced repetition, quizzes & CBT mode, live tutor chat with memory, deep-learning mode, " +
  "PDF page images, mind maps, study reminders, notes, groups and progress analytics. " +
  "Nothing you do here is saved — sign in to keep your work.";

function TryPage() {
  const [tab, setTab] = useState<"pdf" | "topic">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [lesson, setLesson] = useState<DeepLesson | null>(null);
  const [status, setStatus] = useState("");

  const runPdf = async () => {
    if (!file) return;
    setBusy(true); setLesson(null); setStatus("Reading PDF…");
    try {
      const pages = await parsePdf(file);
      const combined = pages.map((p) => `--- Page ${p.page} ---\n${p.text}`).join("\n\n").slice(0, 18000);
      setStatus("Summarizing…");
      const result = (await callAi("deep_teach", {
        mode: "notes",
        pageText: combined,
      })) as DeepLesson;
      setLesson(result);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); setStatus(""); }
  };

  const runTopic = async () => {
    if (!topic.trim()) return;
    setBusy(true); setLesson(null); setStatus("Teaching…");
    try {
      const result = (await callAi("deep_teach", {
        mode: "topic",
        topic: topic.trim(),
      })) as DeepLesson;
      setLesson(result);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); setStatus(""); }
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
          <p className="text-sm text-muted-foreground mt-1">Summarize a PDF or learn any topic. Nothing is saved.</p>
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

            <Card className="p-4 border-primary/30 bg-primary/5">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Want to save this and go deeper?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sign in free to save your work, get multi-day plans, YouTube tutorials, flashcards, quizzes, live tutor chat and more.
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
