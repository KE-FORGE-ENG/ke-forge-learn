import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { callAi } from "@/lib/api";
import { parsePdf } from "@/lib/pdf";
import {
  Loader2, ChevronLeft, ChevronRight, Globe, Brain, Sparkles, BookOpen, Camera, FileText,
  Pause, Play, ExternalLink, Upload, X, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AudioLecture } from "@/components/AudioLecture";

export const Route = createFileRoute("/deeplearn/")({ component: StandaloneDeepLearn });

type DeepLesson = {
  title: string;
  deep_explanation: string;
  keywords: { term: string; definition: string; why_it_matters?: string }[];
  important_facts: string[];
  examples?: string[];
  likely_exam_questions: { question: string; answer: string }[];
  recap: string;
  youtube_query: string;
};

type Mode = "pdf" | "topic" | "notes";

async function webSearch(queries: string[]) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-search`;
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ queries }),
  });
  return await r.json();
}

function StandaloneDeepLearn() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("pdf");
  const [pdfPages, setPdfPages] = useState<{ page: number; text: string }[]>([]);
  const [pdfName, setPdfName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [page, setPage] = useState(1);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [webOn, setWebOn] = useState(false);
  const [lesson, setLesson] = useState<DeepLesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [imgOn, setImgOn] = useState(false);
  const [refImages, setRefImages] = useState<{ url: string; thumbnail: string; title: string; source: string; author?: string }[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  const totalPages = pdfPages.length;
  const pageText = pdfPages.find((p) => p.page === page)?.text ?? "";

  const handlePdf = async (file: File) => {
    setParsing(true);
    setLesson(null);
    try {
      const pages = await parsePdf(file);
      setPdfPages(pages);
      setPdfName(file.name);
      setPage(1);
      toast.success(`Loaded ${pages.length} pages`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to parse PDF");
    } finally {
      setParsing(false);
    }
  };

  const teach = async () => {
    if (!user || paused) return;
    setLesson(null); setSources([]); setBusy(true);
    try {
      let webContext = "";
      if (webOn) {
        const seed =
          mode === "topic" ? topic :
          mode === "notes" ? notes.slice(0, 300) :
          (pageText.split(/\s+/).slice(0, 30).join(" ") + ` ${pdfName}`);
        if (seed.trim()) {
          const w = await webSearch([seed.slice(0, 200)]);
          webContext = w.text || "";
          setSources(w.sources ?? []);
        }
      }
      const result = (await callAi("deep_teach", {
        mode,
        pageText: mode === "pdf" ? pageText : mode === "notes" ? notes : undefined,
        pageNumber: mode === "pdf" ? page : undefined,
        totalPages: mode === "pdf" ? totalPages : undefined,
        topic: mode === "topic" ? topic : undefined,
        webContext,
      })) as DeepLesson;
      setLesson(result);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  // Auto-teach when PDF page changes
  useEffect(() => {
    if (!user || paused || mode !== "pdf") return;
    if (pageText) teach();
    // eslint-disable-next-line
  }, [page, mode, paused, webOn, pdfPages.length]);

  const handleOcr = async (file: File) => {
    setOcrBusy(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const r = (await callAi("ocr_image", { imageDataUrl: dataUrl })) as { text: string };
      setNotes((prev) => (prev ? prev + "\n\n" : "") + (r.text || ""));
      toast.success("Extracted text from image");
    } catch (e: any) {
      toast.error(e.message ?? "OCR failed");
    } finally {
      setOcrBusy(false);
    }
  };

  if (!user) return null;

  return (
    <AppShell>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div className="min-w-0">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back to dashboard</Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1 flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary flex-shrink-0" /> Deep Learning
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Standalone — teach yourself from any PDF, topic, or lecture notes.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border">
            <Globe className="w-4 h-4 text-primary" />
            <Label htmlFor="web" className="text-xs">Web search</Label>
            <Switch id="web" checked={webOn} onCheckedChange={setWebOn} />
          </div>
          <Button variant={paused ? "default" : "outline"} size="sm" onClick={() => setPaused((p) => !p)}>
            {paused ? <><Play className="w-4 h-4 mr-1" /> Resume</> : <><Pause className="w-4 h-4 mr-1" /> Pause</>}
          </Button>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {([
          { k: "pdf", label: "PDF", icon: BookOpen },
          { k: "topic", label: "Topic", icon: Sparkles },
          { k: "notes", label: "Notes", icon: Camera },
        ] as const).map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => { setMode(k); setLesson(null); }}
            className={`px-2 py-2 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1.5 border transition ${
              mode === k ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-secondary"
            }`}
          ><Icon className="w-4 h-4" />{label}</button>
        ))}
      </div>

      {/* PDF mode */}
      {mode === "pdf" && (
        pdfPages.length === 0 ? (
          <Card className="p-6 mb-4 text-center">
            {parsing ? (
              <div className="py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="mt-2 text-sm text-muted-foreground">Parsing PDF…</p></div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm mb-3">Upload a PDF to learn page by page</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground cursor-pointer text-sm font-medium">
                  <Upload className="w-4 h-4" /> Choose PDF
                  <input type="file" accept="application/pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdf(f); e.target.value = ""; }} />
                </label>
              </>
            )}
          </Card>
        ) : (
          <Card className="p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm min-w-0 flex-1">
              <span className="font-semibold">Page {page}</span> of {totalPages}
              <button onClick={() => { setPdfPages([]); setPdfName(""); setLesson(null); }} className="ml-2 inline-flex items-center text-xs text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" /> remove
              </button>
              <div className="text-xs text-muted-foreground truncate">{pdfName}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <Input type="number" min={1} max={totalPages} value={page}
                onChange={(e) => setPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
                className="w-20" />
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )
      )}

      {/* Topic mode */}
      {mode === "topic" && (
        <Card className="p-4 mb-4 space-y-2">
          <Label>Topic to study deeply</Label>
          <div className="flex gap-2 flex-wrap">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis" className="flex-1 min-w-[180px]" />
            <Button onClick={teach} disabled={busy || !topic.trim()}>Teach</Button>
          </div>
        </Card>
      )}

      {/* Notes mode */}
      {mode === "notes" && (
        <Card className="p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label>Lecture notes</Label>
            <div className="flex items-center gap-2">
              {ocrBusy && (
                <button type="button" onClick={() => setOcrBusy(false)} className="text-xs text-muted-foreground hover:text-destructive">Cancel</button>
              )}
              <label className="cursor-pointer text-xs text-primary inline-flex items-center gap-1">
                <Camera className="w-4 h-4" />
                {ocrBusy ? "Extracting…" : "Snap photo"}
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleOcr(f); e.target.value = ""; }} />
              </label>
              {notes.trim().length > 0 && (
                <button type="button" onClick={() => setNotes("")} className="text-xs text-muted-foreground hover:text-destructive">Clear</button>
              )}
            </div>
          </div>
          <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste or extract your lecture notes here…" />
          <Button onClick={teach} disabled={busy || notes.trim().length < 20}>
            <FileText className="w-4 h-4 mr-1" /> Teach from notes
          </Button>
        </Card>
      )}

      {/* Lesson body */}
      {paused ? (
        <Card className="p-10 text-center">
          <Pause className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold">Paused</p>
        </Card>
      ) : busy ? (
        <Card className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="mt-3 text-muted-foreground">Teaching{webOn ? " with web context" : ""}…</p></Card>
      ) : lesson ? (
        <div className="space-y-4 sm:space-y-5">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-xs uppercase tracking-wide font-semibold text-primary">
                {mode === "pdf" ? `Page ${page}/${totalPages}` : mode === "topic" ? "Topic deep dive" : "Notes deep dive"}
              </span>
              {webOn && <Badge variant="secondary"><Globe className="w-3 h-3 mr-1" />Web</Badge>}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">{lesson.title}</h2>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-sm sm:text-base text-foreground/90">{lesson.deep_explanation}</p>
            <div className="mt-4">
              <AudioLecture title={lesson.title} text={`${lesson.deep_explanation}\n\n${lesson.keywords.map((k) => `${k.term}: ${k.definition}`).join("\n")}\n\nRecap: ${lesson.recap}`} />
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold text-base sm:text-lg mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Keywords lecturers test</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {lesson.keywords.map((k, i) => (
                <div key={i} className="border rounded-lg p-3 bg-secondary/30">
                  <div className="font-semibold text-sm">{k.term}</div>
                  <p className="text-xs mt-1 text-foreground/85">{k.definition}</p>
                  {k.why_it_matters && <p className="text-[11px] mt-1 text-muted-foreground italic">Why tested: {k.why_it_matters}</p>}
                </div>
              ))}
            </div>
          </Card>

          {lesson.important_facts?.length > 0 && (
            <Card className="p-4 sm:p-6">
              <h3 className="font-semibold text-base sm:text-lg mb-3">Important facts</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {lesson.important_facts.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </Card>
          )}

          {lesson.examples && lesson.examples.length > 0 && (
            <Card className="p-4 sm:p-6">
              <h3 className="font-semibold text-base sm:text-lg mb-3">Worked examples</h3>
              <ul className="space-y-2 text-sm">
                {lesson.examples.map((e, i) => <li key={i} className="border-l-2 border-primary pl-3">{e}</li>)}
              </ul>
            </Card>
          )}

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

          <Card className="p-4 sm:p-6">
            <h3 className="font-semibold mb-2">Recap</h3>
            <p className="text-sm text-foreground/85">{lesson.recap}</p>
          </Card>

          {sources.length > 0 && (
            <Card className="p-4">
              <details>
                <summary className="cursor-pointer text-xs font-semibold flex items-center gap-1 select-none">
                  <Globe className="w-3 h-3" /> View sources ({sources.length})
                </summary>
                <ul className="text-xs space-y-1 mt-3">
                  {sources.map((s) => (
                    <li key={s}><a href={s} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 break-all">{s} <ExternalLink className="w-3 h-3 flex-shrink-0" /></a></li>
                  ))}
                </ul>
              </details>
            </Card>
          )}

          {mode === "pdf" && pdfPages.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)} className="flex-1"><ChevronLeft className="w-4 h-4" /> Previous</Button>
              <Button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="flex-1">Next <ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          {mode === "pdf" ? "Upload a PDF to start." : mode === "topic" ? "Enter a topic to start." : "Add or snap your lecture notes to start."}
        </Card>
      )}
    </AppShell>
  );
}
