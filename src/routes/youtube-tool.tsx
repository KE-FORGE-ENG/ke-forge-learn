import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Youtube, Sparkles } from "lucide-react";
import { callAi } from "@/lib/api";
import { toast } from "sonner";
import { KeypointsView, type Keypoints } from "@/components/YoutubeKeypoints";

export const Route = createFileRoute("/youtube-tool")({ component: YoutubeTool });

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
  // Use oEmbed (public, no key) for title + channel
  const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
  if (!r.ok) throw new Error("Could not fetch video info — make sure the video is public.");
  return (await r.json()) as { title: string; author_name: string };
}

function YoutubeTool() {
  const [url, setUrl] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ title: string; channel: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Keypoints | null>(null);

  const run = async () => {
    const id = extractVideoId(url);
    if (!id) { toast.error("Paste a valid YouTube URL or 11-char video ID"); return; }
    setBusy(true); setData(null); setMeta(null); setVideoId(id);
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
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back to dashboard</Link>
        <h1 className="text-2xl font-bold mt-1 flex items-center gap-2">
          <Youtube className="w-6 h-6 text-destructive" /> YouTube key points
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Paste any YouTube link and get a structured study outline: main topic, sub-topics, key points and exam takeaways.
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
          <div className="lg:col-span-2">
            {busy ? (
              <Card className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="mt-3 text-xs text-muted-foreground">Analyzing…</p></Card>
            ) : data ? (
              <Card className="p-6"><KeypointsView data={data} /></Card>
            ) : null}
          </div>
        </div>
      )}
    </AppShell>
  );
}
