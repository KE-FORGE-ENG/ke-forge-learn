import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import {
  Loader2, ChevronLeft, ChevronRight, Globe, Brain, Sparkles, BookOpen, Camera, FileText, Pause, Play, ExternalLink, Image as ImageIcon, Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { AudioLecture } from "@/components/AudioLecture";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renderPdfPageImage, pageHasImages } from "@/lib/pdf";

export const Route = createFileRoute("/deeplearn/$planId")({ component: DeepLearn });

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

function DeepLearn() {
  const { planId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [plan, setPlan] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [mode, setMode] = useState<Mode>("pdf");
  const [page, setPage] = useState(1);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [webOn, setWebOn] = useState(false);
  const [lesson, setLesson] = useState<DeepLesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [pageImgOpen, setPageImgOpen] = useState(false);
  const [pageImgUrl, setPageImgUrl] = useState<string | null>(null);
  const [pageImgBusy, setPageImgBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hasImages, setHasImages] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  // Load plan + doc + saved progress
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("learning_plans").select("*").eq("id", planId).single();
      if (!p) return;
      setPlan(p);
      const { data: d } = await supabase.from("documents").select("*").eq("id", p.document_id).single();
      setDoc(d);
      const { data: pr } = await supabase
        .from("deep_progress").select("*")
        .eq("plan_id", planId).eq("user_id", user.id).maybeSingle();
      if (pr) {
        setProgressId(pr.id);
        setMode("pdf");
        setPage(pr.position ?? 1);
        setWebOn(!!pr.web_search);
      }
    })();
  }, [user, planId]);

  const totalPages = doc?.page_count ?? 0;
  const pageText = useMemo(() => {
    if (!doc) return "";
    const pages = (doc.pages as { page: number; text: string }[]) ?? [];
    return pages.find((p) => p.page === page)?.text ?? "";
  }, [doc, page]);

  // Resolve a signed URL for the PDF so we can render full-page images on demand
  useEffect(() => {
    if (!doc?.storage_path) { setPdfUrl(null); return; }
    (async () => {
      const { data } = await supabase.storage.from("pdfs").createSignedUrl(doc.storage_path, 3600);
      if (data?.signedUrl) setPdfUrl(data.signedUrl);
    })();
  }, [doc?.storage_path]);

  // Detect whether the current page contains diagrams/images
  useEffect(() => {
    let cancelled = false;
    setHasImages(false);
    if (!pdfUrl || mode !== "pdf") return;
    (async () => {
      const has = await pageHasImages(pdfUrl, page);
      if (!cancelled) setHasImages(has);
    })();
    return () => { cancelled = true; };
  }, [pdfUrl, page, mode]);

  const viewPageImage = async () => {
    if (!pdfUrl) { toast.error("Original PDF not available for this document"); return; }
    setPageImgOpen(true);
    setPageImgBusy(true);
    setPageImgUrl(null);
    try {
      const url = await renderPdfPageImage(pdfUrl, page, 1.8);
      setPageImgUrl(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to render page");
      setPageImgOpen(false);
    } finally {
      setPageImgBusy(false);
    }
  };

  const saveProgress = async (patch: Partial<{ mode: Mode; position: number; topic: string; notes_text: string; web_search: boolean }>) => {
    if (!user) return;
    const row = {
      user_id: user.id, plan_id: planId,
      mode, position: page, topic, notes_text: notes, web_search: webOn,
      ...patch, updated_at: new Date().toISOString(),
    };
    if (progressId) {
      await supabase.from("deep_progress").update(row).eq("id", progressId);
    } else {
      const { data } = await supabase.from("deep_progress").insert(row).select().single();
      if (data) setProgressId(data.id);
    }
  };

  const teach = async () => {
    if (!user || paused) return;
    setLesson(null); setSources([]); setBusy(true);
    try {
      // Build queries for web search
      let webContext = "";
      if (webOn) {
        const seed =
          mode === "topic" ? topic :
          mode === "notes" ? notes.slice(0, 300) :
          (pageText.split(/\s+/).slice(0, 30).join(" ") + ` ${doc?.title ?? ""}`);
        if (seed.trim()) {
          const queries = [seed.slice(0, 200)];
          const w = await webSearch(queries);
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
      await saveProgress({});
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  // Auto-teach for PDF page changes (topic/notes use explicit button)
  useEffect(() => {
    if (!user || !plan || !doc || paused) return;
    if (mode === "pdf" && pageText) teach();
    // eslint-disable-next-line
  }, [mode, page, doc, paused, webOn]);

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
    } catch (e: any) { toast.error(e.message ?? "OCR failed"); }
    finally { setOcrBusy(false); }
  };

  if (!user || !plan || !doc) {
    return <AppShell><div className="py-20 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <Link to="/learn/$planId" params={{ planId }} className="text-sm text-muted-foreground hover:text-foreground">← Back to lesson</Link>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" /> Deep Learning Mode
          </h1>
          <p className="text-xs text-muted-foreground">Page-by-page lecturer-style teaching with keywords lecturers test on.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border">
            <Globe className="w-4 h-4 text-primary" />
            <Label htmlFor="web" className="text-xs">Web search</Label>
            <Switch id="web" checked={webOn} onCheckedChange={(v) => { setWebOn(v); saveProgress({ web_search: v }); }} />
          </div>
          <Button variant={paused ? "default" : "outline"} size="sm" onClick={() => setPaused((p) => !p)}>
            {paused ? <><Play className="w-4 h-4 mr-1" /> Resume</> : <><Pause className="w-4 h-4 mr-1" /> Pause</>}
          </Button>
        </div>
      </div>

      {/* Active-plan deep learn is locked to current PDF — no mode switcher, topic, or notes upload */}

      {/* PDF page controls */}
      <Card className="p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm">
          <span className="font-semibold">Page {page}</span> of {totalPages} — <span className="break-all">{doc.title}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => { const n = page - 1; setPage(n); saveProgress({ position: n }); }}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <Input type="number" min={1} max={totalPages} value={page}
            onChange={(e) => { const n = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)); setPage(n); }}
            onBlur={() => saveProgress({ position: page })}
            className="w-20" />
          <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => { const n = page + 1; setPage(n); saveProgress({ position: n }); }}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
          {pdfUrl && (
            <Button
              size="sm"
              variant={hasImages ? "default" : "secondary"}
              onClick={viewPageImage}
              title="See the original page image (diagrams, figures, equations)"
              className={hasImages ? "animate-pulse" : ""}
            >
              <ImageIcon className="w-4 h-4 mr-1" />
              {hasImages ? "Diagrams on this page — view" : "View page image"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!user) return;
              await supabase.from("bookmarks").insert({ user_id: user.id, plan_id: planId, document_id: doc.id, page });
              toast.success(`Page ${page} bookmarked`);
            }}
            title="Bookmark this page"
          >
            <Bookmark className="w-4 h-4 mr-1" /> Bookmark
          </Button>
        </div>
      </Card>

      {/* notes/topic UI removed in active-plan deep learn */}

      {/* Lesson body */}
      {paused ? (
        <Card className="p-10 text-center">
          <Pause className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold">Paused</p>
          <p className="text-sm text-muted-foreground">Press Resume to continue from where you stopped.</p>
        </Card>
      ) : busy ? (
        <Card className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="mt-3 text-muted-foreground">Teaching{webOn ? " with web context" : ""}…</p></Card>
      ) : lesson ? (
        <div className="space-y-5">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-xs uppercase tracking-wide font-semibold text-primary">
                {mode === "pdf" ? `Page ${page}/${totalPages}` : mode === "topic" ? "Topic deep dive" : "Lecture notes deep dive"}
              </span>
              {webOn && <Badge variant="secondary" className="ml-1"><Globe className="w-3 h-3 mr-1" />Web-augmented</Badge>}
            </div>
            <h2 className="text-2xl font-bold">{lesson.title}</h2>
            <p className="mt-4 whitespace-pre-wrap leading-relaxed text-foreground/90">{lesson.deep_explanation}</p>
            <div className="mt-4">
              <AudioLecture title={lesson.title} text={`${lesson.deep_explanation}\n\n${lesson.keywords.map((k) => `${k.term}: ${k.definition}`).join("\n")}\n\nRecap: ${lesson.recap}`} />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Keywords lecturers test</h3>
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
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3">Important facts to memorize</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {lesson.important_facts.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </Card>
          )}

          {lesson.examples && lesson.examples.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-3">Worked examples</h3>
              <ul className="space-y-2 text-sm">
                {lesson.examples.map((e, i) => <li key={i} className="border-l-2 border-primary pl-3">{e}</li>)}
              </ul>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-3">Likely exam questions</h3>
            <div className="space-y-3">
              {lesson.likely_exam_questions.map((q, i) => (
                <details key={i} className="border rounded-lg p-3">
                  <summary className="cursor-pointer font-medium text-sm">{i + 1}. {q.question}</summary>
                  <p className="mt-2 text-sm text-foreground/85">{q.answer}</p>
                </details>
              ))}
            </div>
          </Card>

          <Card className="p-6">
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

          <div className="flex flex-wrap gap-2 justify-between">
            {mode === "pdf" && (
              <div className="flex gap-2">
                <Button variant="outline" disabled={page === 1} onClick={() => { const n = page - 1; setPage(n); saveProgress({ position: n }); }}><ChevronLeft className="w-4 h-4" /> Previous page</Button>
                <Button disabled={page === totalPages} onClick={() => { const n = page + 1; setPage(n); saveProgress({ position: n }); }}>Next page <ChevronRight className="w-4 h-4" /></Button>
              </div>
            )}
            <Button asChild variant="outline">
              <Link to="/quiz/$planId/$day" params={{ planId, day: "1" }}>Take quiz</Link>
            </Button>
          </div>
        </div>
      ) : (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          {mode === "pdf" ? "Loading page…" : mode === "topic" ? "Enter a topic to start." : "Add or snap your lecture notes to start."}
        </Card>
      )}

      <Dialog open={pageImgOpen} onOpenChange={setPageImgOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Page {page} — original</DialogTitle>
          </DialogHeader>
          {pageImgBusy ? (
            <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="text-xs text-muted-foreground mt-2">Rendering page…</p></div>
          ) : pageImgUrl ? (
            <img src={pageImgUrl} alt={`Page ${page}`} className="w-full h-auto rounded border" />
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
