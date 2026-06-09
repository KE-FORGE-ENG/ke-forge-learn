import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parsePdf, chunkPages } from "@/lib/pdf";
import { callAi } from "@/lib/api";
import { TEMPLATES } from "@/lib/templates";
import { Upload, Loader2, Camera, X, FileStack } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/new")({
  component: NewPlan,
  validateSearch: (s: Record<string, unknown>) => ({ template: typeof s.template === "string" ? s.template : undefined }),
});

function NewPlan() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const search = Route.useSearch();
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [ocrPreview, setOcrPreview] = useState<string>("");
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [templateTab, setTemplateTab] = useState<string>("pdf");

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!search.template) return;
    const t = TEMPLATES.find((x) => x.id === search.template);
    if (!t) return;
    setTopic(t.prompt);
    setDays(t.days);
    setTitle(t.title);
    setTemplateTab("topic");
  }, [search.template]);

  const onFile = async (f: File) => {
    setFile(f);
    setTitle(f.name.replace(/\.pdf$/i, ""));
    setPageCount(null);
  };

  const createFromPdf = async () => {
    if (!file || !user) return;
    setBusy(true);
    try {
      toast.message("Reading PDF…");
      const pages = await parsePdf(file);
      setPageCount(pages.length);

      // Upload to storage
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("pdfs").upload(path, file);
      if (upErr) throw upErr;

      const { data: doc, error: dErr } = await supabase.from("documents").insert({
        user_id: user.id, title: title || file.name, source_type: "pdf",
        storage_path: path, pages, page_count: pages.length,
      }).select().single();
      if (dErr) throw dErr;

      const chunks = chunkPages(pages.length, days);
      const { data: plan, error: pErr } = await supabase.from("learning_plans").insert({
        user_id: user.id, document_id: doc.id, days, page_chunks: chunks,
      }).select().single();
      if (pErr) throw pErr;

      toast.success(`Plan ready! ${pages.length} pages over ${days} days.`);
      nav({ to: "/learn/$planId", params: { planId: plan.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); }
  };

  const createBatch = async () => {
    if (!user || batchFiles.length === 0) return;
    setBusy(true);
    setBatchProgress({ done: 0, total: batchFiles.length });
    try {
      for (let i = 0; i < batchFiles.length; i++) {
        const f = batchFiles[i];
        const pages = await parsePdf(f);
        const path = `${user.id}/${Date.now()}-${i}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("pdfs").upload(path, f);
        if (upErr) throw upErr;
        const { data: doc, error: dErr } = await supabase.from("documents").insert({
          user_id: user.id, title: f.name.replace(/\.pdf$/i, ""), source_type: "pdf",
          storage_path: path, pages, page_count: pages.length,
        }).select().single();
        if (dErr) throw dErr;
        const chunks = chunkPages(pages.length, days);
        const { error: pErr } = await supabase.from("learning_plans").insert({
          user_id: user.id, document_id: doc.id, days, page_chunks: chunks,
        });
        if (pErr) throw pErr;
        setBatchProgress({ done: i + 1, total: batchFiles.length });
      }
      toast.success(`Created ${batchFiles.length} plans`);
      nav({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Batch failed");
    } finally { setBusy(false); setBatchProgress(null); }
  };

  const createFromTopic = async () => {
    if (!topic.trim() || !user) return;
    setBusy(true);
    try {
      // Treat topic as 1 "page"
      const pages = [{ page: 1, text: topic }];
      const { data: doc, error: dErr } = await supabase.from("documents").insert({
        user_id: user.id, title: title || topic.slice(0, 60), source_type: "topic",
        pages, page_count: 1,
      }).select().single();
      if (dErr) throw dErr;
      const chunks = chunkPages(1, days);
      const { data: plan, error: pErr } = await supabase.from("learning_plans").insert({
        user_id: user.id, document_id: doc.id, days, page_chunks: chunks,
      }).select().single();
      if (pErr) throw pErr;
      toast.success("Plan created!");
      nav({ to: "/learn/$planId", params: { planId: plan.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); }
  };

  const onImages = async (files: FileList) => {
    const arr: { name: string; dataUrl: string }[] = [];
    for (const f of Array.from(files)) {
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.readAsDataURL(f);
      });
      arr.push({ name: f.name, dataUrl });
    }
    setImages([...images, ...arr]);
  };

  const createFromImages = async () => {
    if (!user || images.length === 0) return;
    setBusy(true);
    try {
      toast.message(`Reading ${images.length} image${images.length > 1 ? "s" : ""}…`);
      const pages: { page: number; text: string }[] = [];
      for (let i = 0; i < images.length; i++) {
        const res = await callAi("ocr_image", { imageDataUrl: images[i].dataUrl });
        const text = (res.text || "").trim();
        if (text) pages.push({ page: i + 1, text });
        setOcrPreview((prev) => prev + (prev ? "\n\n" : "") + text.slice(0, 200) + "…");
      }
      if (pages.length === 0) throw new Error("No readable text found in images");
      const { data: doc, error: dErr } = await supabase.from("documents").insert({
        user_id: user.id, title: title || `Notes ${new Date().toLocaleDateString()}`,
        source_type: "images", pages, page_count: pages.length,
      }).select().single();
      if (dErr) throw dErr;
      const chunks = chunkPages(pages.length, days);
      const { data: plan, error: pErr } = await supabase.from("learning_plans").insert({
        user_id: user.id, document_id: doc.id, days, page_chunks: chunks,
      }).select().single();
      if (pErr) throw pErr;
      toast.success(`Plan ready from ${pages.length} note${pages.length > 1 ? "s" : ""}!`);
      nav({ to: "/learn/$planId", params: { planId: plan.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); }
  };

  if (!user) return null;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold">Create a learning plan</h1>
        <p className="text-muted-foreground mt-1">Upload a PDF, snap photos of notes, or describe a topic.</p>

        <Card className="mt-6 p-6">
          <Tabs value={templateTab} onValueChange={setTemplateTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="pdf">PDF</TabsTrigger>
              <TabsTrigger value="batch">Batch</TabsTrigger>
              <TabsTrigger value="images">Photos</TabsTrigger>
              <TabsTrigger value="topic">Topic</TabsTrigger>
            </TabsList>
            <TabsContent value="pdf" className="mt-6 space-y-4">
              <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition">
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">{file ? file.name : "Click to choose a PDF"}</p>
                {pageCount && <p className="text-xs text-muted-foreground mt-1">{pageCount} pages</p>}
              </label>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
              </div>
            </TabsContent>
            <TabsContent value="batch" className="mt-6 space-y-4">
              <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition">
                <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) setBatchFiles(Array.from(e.target.files)); }} />
                <FileStack className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">{batchFiles.length ? `${batchFiles.length} PDFs selected` : "Choose multiple PDFs"}</p>
                <p className="text-xs text-muted-foreground mt-1">One plan per file — uses the duration below for all.</p>
              </label>
              {batchFiles.length > 0 && (
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {batchFiles.map((f, i) => <li key={i} className="truncate text-muted-foreground">• {f.name}</li>)}
                </ul>
              )}
              {batchProgress && (
                <div className="text-xs text-muted-foreground">Processing {batchProgress.done}/{batchProgress.total}…</div>
              )}
            </TabsContent>
            <TabsContent value="images" className="mt-6 space-y-4">
              <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition">
                <input type="file" accept="image/*" multiple capture="environment" className="hidden"
                  onChange={(e) => { if (e.target.files) onImages(e.target.files); e.target.value = ""; }} />
                <Camera className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">{images.length ? `${images.length} image${images.length > 1 ? "s" : ""} selected — tap to add more` : "Snap or choose photos of handwritten / printed notes"}</p>
                <p className="text-xs text-muted-foreground mt-1">High-accuracy AI OCR (Gemini 2.5 Pro vision).</p>
              </label>
              {images.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{images.length} photo{images.length > 1 ? "s" : ""} ready</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setImages([]); setOcrPreview(""); }}>
                      <X className="w-3 h-3 mr-1" /> Clear all
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((im, i) => (
                      <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-muted group">
                        <img src={im.dataUrl} alt={im.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          aria-label="Remove photo"
                          onClick={() => setImages(images.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 bg-background/90 hover:bg-destructive hover:text-destructive-foreground rounded-full p-1 shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lecture notes — Week 3" />
              </div>
              {ocrPreview && (
                <div className="text-xs bg-muted/50 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {ocrPreview}
                </div>
              )}
            </TabsContent>
            <TabsContent value="topic" className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Linear algebra basics" />
              </div>
              <div className="space-y-2">
                <Label>Describe the topic</Label>
                <Textarea rows={6} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Paste notes or describe what you want to learn…" />
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <Label>Learning duration</Label>
              <span className="text-sm font-semibold text-primary">{days} {days === 1 ? "day" : "days"}</span>
            </div>
            <Slider min={1} max={5} step={1} value={[days]} onValueChange={(v) => setDays(v[0])} />
            <p className="text-xs text-muted-foreground">
              {days === 1 && "Foundational summary in 24h."}
              {days === 2 && "Day 1 + extend with examples & edge cases."}
              {days === 3 && "Adds cross-topic connections and deeper follow-ups."}
              {days === 4 && "Adds reviews and classification recap."}
              {days === 5 && "Intense mode: micro-topics, aggressive follow-ups, daily reviews."}
            </p>
          </div>

          <Button
            disabled={busy || (!file && !topic.trim() && images.length === 0)}
            onClick={() => (images.length > 0 ? createFromImages() : file ? createFromPdf() : createFromTopic())}
            className="w-full mt-6 shadow-[var(--shadow-glow)]"
            size="lg"
          >
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building plan…</> : "Create plan"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
