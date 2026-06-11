import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ListTree, Sparkles } from "lucide-react";
import { callAi } from "@/lib/api";
import { toast } from "sonner";

export type Keypoints = {
  main_topic: string;
  overview: string;
  sub_topics: { name: string; summary: string; key_points: string[] }[];
  exam_takeaways: string[];
};

export function YoutubeKeypointsButton({
  videoTitle,
  videoDescription,
  channel,
  contextText,
  label = "Generate key points",
  size = "sm",
  variant = "outline",
}: {
  videoTitle: string;
  videoDescription?: string;
  channel?: string;
  contextText?: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Keypoints | null>(null);

  const run = async () => {
    setOpen(true);
    if (data) return;
    setBusy(true);
    try {
      const r = (await callAi("youtube_keypoints", {
        videoTitle, videoDescription, channel, contextText,
      })) as Keypoints;
      setData(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate key points");
      setOpen(false);
    } finally { setBusy(false); }
  };

  return (
    <>
      <Button size={size} variant={variant} onClick={run}>
        <ListTree className="w-4 h-4 mr-1" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Video key points</DialogTitle>
          </DialogHeader>
          {busy || !data ? (
            <div className="py-16 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
              <p className="mt-3 text-xs text-muted-foreground">Generating structured key points…</p>
            </div>
          ) : (
            <KeypointsView data={data} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function KeypointsView({ data }: { data: Keypoints }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-primary font-semibold">Main topic</div>
        <h3 className="text-xl font-bold mt-1">{data.main_topic}</h3>
        <p className="text-sm text-foreground/85 mt-2">{data.overview}</p>
      </div>

      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wide text-primary font-semibold">Sub-topics</div>
        {data.sub_topics.map((s, i) => (
          <div key={i} className="border rounded-lg p-4 bg-secondary/30">
            <div className="font-semibold">{i + 1}. {s.name}</div>
            <p className="text-sm text-foreground/80 mt-1">{s.summary}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
              {s.key_points.map((k, j) => <li key={j}>{k}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-2">Likely exam takeaways</div>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {data.exam_takeaways.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>
    </div>
  );
}
