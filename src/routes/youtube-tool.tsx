import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Youtube, Sparkles, Brain, Pause, Play, Square, History, Trash2 } from "lucide-react";
import { callAi } from "@/lib/api";
import { toast } from "sonner";
import { KeypointsView, type Keypoints } from "@/components/YoutubeKeypoints";
import { AudioLecture } from "@/components/AudioLecture";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/youtube-tool")({
  component: YoutubeTool,
  head: () => ({
    meta: [
      { title: "YouTube Key Points & Deep Dive | KE-FORGE LEARN" },
      { name: "description", content: "Turn any YouTube video into structured study key points, then keep learning deeper with an AI tutor. All sessions saved to your history." },
      { property: "og:title", content: "YouTube Key Points & Deep Dive | KE-FORGE LEARN" },
      { property: "og:description", content: "Structured key points from any YouTube video, plus an endless AI deep dive you can pause anytime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type DeepLesson = {
  title: string;
  deep_explanation: string;
  keywords: { term: string; definition: string; why_it_matters?: string }[];
  important_facts: string[];
  examples?: string[];
  likely_exam_questions: { question: string; answer: string }[];
  recap: string;
};

type StudyRow = {
  id: string;
  video_id: string;
  video_url: string | null;
  title: string;
  channel: string | null;
  context_text: string | null;
  keypoints: Keypoints;
  lessons: DeepLesson[];
  created_at: string;
};

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch { /* not a URL */ }
  return null;
}

async function fetchVideoMeta(videoId: string) {
  const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
  if (!r.ok) throw new Error("Could not fetch video info — make sure the video is public.");
  return (await r.json()) as { title: string; author_name: string };
}

function YoutubeTool() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ title: string; channel: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Keypoints | null>(null);
  const [studyId, setStudyId] = useState<string | null>(null);

  // deep dive
  const [lessons, setLessons] = useState<DeepLesson[]>([]);
  const [diving, setDiving] = useState(false);
  const [paused, setPaused] = useState(false);
  const runningRef = useRef(false);

  // history
  const [history, setHistory] = useState<StudyRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data: rows, error } = await supabase
      .from("youtube_studies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setHistory((rows ?? []) as unknown as StudyRow[]);
    setLoadingHistory(false);
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const persistLessons = async (id: string | null, next: DeepLesson[]) => {
    if (!id || !user) return;
    await supabase.from("youtube_studies").update({ lessons: next as any }).eq("id", id);
  };

  const run = async () => {
    const id = extractVideoId(url);
    if (!id) { toast.error("Paste a valid YouTube URL or 11-char video ID"); return; }
    stopDive();
    setBusy(true); setData(null); setMeta(null); setVideoId(id); setLessons([]); setStudyId(null);
    try {
      const m = await fetchVideoMeta(id);
      setMeta({ title: m.title, channel: m.author_name });
      const r = (await callAi("youtube_keypoints", {
        videoTitle: m.title,
        channel: m.author_name,
        videoDescription: "",
        contextText: extraContext.trim() || undefined,
      })) as Keypoints;
      setData(r);
      if (user) {
        const { data: row, error } = await supabase
          .from("youtube_studies")
          .insert({
            user_id: user.id,
            video_id: id,
            video_url: `https://www.youtube.com/watch?v=${id}`,
            title: m.title,
            channel: m.author_name,
            context_text: extraContext.trim() || null,
            keypoints: r as any,
            lessons: [],
          })
          .select()
          .single();
        if (!error && row) { setStudyId(row.id); loadHistory(); }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setBusy(false); }
  };

  const generateLesson = async (current: DeepLesson[]) => {
    const covered = current.map((l) => `${l.title}: ${l.recap}`);
    return (await callAi("youtube_deep_lesson", {
      videoTitle: meta?.title,
      channel: meta?.channel,
      mainTopic: data?.main_topic,
      overview: data?.overview,
      subTopics: (data?.sub_topics ?? []).map((s) => s.name),
      covered,
      contextText: extraContext.trim() || undefined,
      step: current.length + 1,
    })) as DeepLesson;
  };

  const diveLoop = async () => {
    runningRef.current = true;
    setDiving(true); setPaused(false);
    try {
      while (runningRef.current) {
        const current = lessonsRef.current;
        const lesson = await generateLesson(current);
        if (!runningRef.current) break;
        const next = [...lessonsRef.current, lesson];
        lessonsRef.current = next;
        setLessons(next);
        await persistLessons(studyIdRef.current, next);
        // brief breather so the user can read / pause
        await new Promise((res) => setTimeout(res, 1200));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Deep dive failed");
    } finally {
      runningRef.current = false;
      setDiving(false);
    }
  };

  // refs mirroring state for the async loop
  const lessonsRef = useRef<DeepLesson[]>([]);
  const studyIdRef = useRef<string | null>(null);
  useEffect(() => { lessonsRef.current = lessons; }, [lessons]);
  useEffect(() => { studyIdRef.current = studyId; }, [studyId]);

  const pauseDive = () => { runningRef.current = false; setPaused(true); };
  const stopDive = () => { runningRef.current = false; setPaused(false); setDiving(false); };

  useEffect(() => () => { runningRef.current = false; }, []);

  const openStudy = (row: StudyRow) => {
    stopDive();
    setStudyId(row.id);
    setVideoId(row.video_id);
    setMeta({ title: row.title, channel: row.channel ?? "" });
    setData(row.keypoints);
    setLessons(Array.isArray(row.lessons) ? row.lessons : []);
    setExtraContext(row.context_text ?? "");
    setUrl(row.video_url ?? `https://www.youtube.com/watch?v=${row.video_id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteStudy = async (id: string) => {
    await supabase.from("youtube_studies").delete().eq("id", id);
    setHistory((h) => h.filter((x) => x.id !== id));
    if (studyId === id) setStudyId(null);
  };

  return (
    <AppShell>
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back to dashboard</Link>
        <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
          <Youtube className="w-6 h-6 text-destructive" /> YouTube key points
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Paste any YouTube link to get a structured study outline — then keep going deeper into the subject with your AI tutor. Everything is saved to your history.
        </p>
      </div>

      <Card className="p-5 space-y-3">
        <div>
          <Label htmlFor="yt-url">YouTube URL or video ID</Label>
          <Input id="yt-url" placeholder="https://www.youtube.com/watch?v=…"
            value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="yt-ctx" className="text-xs">Optional: what are you studying? (helps the AI focus)</Label>
          <Textarea id="yt-ctx" rows={2} placeholder="e.g. preparing for a biology exam on cell respiration"
            value={extraContext} onChange={(e) => setExtraContext(e.target.value)} />
        </div>
        <Button onClick={run} disabled={busy || !url.trim()}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          Generate key points
        </Button>
        {!user && (
          <p className="text-xs text-muted-foreground">Sign in to save your key points and deep dives to history.</p>
        )}
      </Card>

      {videoId && (
        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-1 space-y-3">
            <div className="rounded-lg overflow-hidden bg-muted aspect-video">
              <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoId}`} title={meta?.title ?? "video"} allowFullScreen />
            </div>
            {meta && (
              <Card className="p-3 text-sm">
                <div className="font-semibold leading-tight">{meta.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{meta.channel}</div>
              </Card>
            )}
          </div>
          <div className="lg:col-span-2 space-y-6">
            {busy ? (
              <Card className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="mt-3 text-xs text-muted-foreground">Analyzing…</p></Card>
            ) : data ? (
              <>
                <Card className="p-6"><KeypointsView data={data} /></Card>

                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    <div className="font-semibold">Go deeper into {data.main_topic}</div>
                    {lessons.length > 0 && <Badge variant="secondary">{lessons.length} lesson{lessons.length > 1 ? "s" : ""}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    No day plan — the tutor keeps teaching this subject deeper and deeper. Pause or stop anytime; your progress is saved.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {!diving ? (
                      <Button onClick={diveLoop}>
                        <Play className="w-4 h-4 mr-1" />
                        {lessons.length ? (paused ? "Resume deep dive" : "Continue learning") : "Continue learning / go deeper"}
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={pauseDive}><Pause className="w-4 h-4 mr-1" /> Pause</Button>
                        <Button variant="outline" onClick={stopDive}><Square className="w-4 h-4 mr-1" /> Stop</Button>
                      </>
                    )}
                  </div>
                </Card>

                {lessons.map((l, i) => (
                  <Card key={i} className="p-5 sm:p-6">
                    <div className="text-xs uppercase tracking-wide text-primary font-semibold">Deep dive · Lesson {i + 1}</div>
                    <h3 className="text-lg sm:text-xl font-bold mt-1">{l.title}</h3>
                    <p className="mt-3 whitespace-pre-wrap leading-relaxed text-sm sm:text-base text-foreground/90">{l.deep_explanation}</p>
                    <div className="mt-3">
                      <AudioLecture title={l.title} text={`${l.deep_explanation}\n\n${(l.keywords ?? []).map((k) => `${k.term}: ${k.definition}`).join("\n")}\n\nRecap: ${l.recap}`} />
                    </div>

                    {!!l.keywords?.length && (
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-2">Key terms</div>
                        <div className="space-y-2">
                          {l.keywords.map((k, j) => (
                            <div key={j} className="border rounded-lg p-3 bg-secondary/30 text-sm">
                              <span className="font-semibold">{k.term}</span> — {k.definition}
                              {k.why_it_matters && <div className="text-xs text-muted-foreground mt-1">{k.why_it_matters}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!!l.important_facts?.length && (
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-2">Must-know facts</div>
                        <ul className="list-disc pl-5 space-y-1 text-sm">{l.important_facts.map((f, j) => <li key={j}>{f}</li>)}</ul>
                      </div>
                    )}

                    {!!l.examples?.length && (
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-2">Examples</div>
                        <ul className="list-disc pl-5 space-y-1 text-sm">{l.examples.map((f, j) => <li key={j}>{f}</li>)}</ul>
                      </div>
                    )}

                    {!!l.likely_exam_questions?.length && (
                      <div className="mt-4">
                        <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-2">Likely exam questions</div>
                        <div className="space-y-2">
                          {l.likely_exam_questions.map((q, j) => (
                            <div key={j} className="text-sm">
                              <div className="font-medium">Q{j + 1}. {q.question}</div>
                              <div className="text-foreground/80">{q.answer}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {l.recap && <p className="mt-4 text-sm text-muted-foreground border-t pt-3"><span className="font-semibold text-foreground">Recap: </span>{l.recap}</p>}
                  </Card>
                ))}

                {diving && (
                  <Card className="p-6 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-xs text-muted-foreground">Teaching lesson {lessons.length + 1}…</p>
                  </Card>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {user && (
        <Card className="p-5 mt-8">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <div className="font-semibold">Saved YouTube studies</div>
            {loadingHistory && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-2">Nothing saved yet — generate key points from a video and it will appear here.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {history.map((row) => (
                <div key={row.id} className="border rounded-lg p-3 bg-secondary/20 flex gap-3">
                  <img
                    src={`https://i.ytimg.com/vi/${row.video_id}/mqdefault.jpg`}
                    alt={`Thumbnail for ${row.title}`}
                    loading="lazy"
                    className="w-24 h-14 object-cover rounded shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{row.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{row.channel}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button size="sm" variant="secondary" onClick={() => openStudy(row)}>Open</Button>
                      {Array.isArray(row.lessons) && row.lessons.length > 0 && (
                        <Badge variant="outline">{row.lessons.length} deep lesson{row.lessons.length > 1 ? "s" : ""}</Badge>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deleteStudy(row.id)} aria-label="Delete saved study">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </AppShell>
  );
}
