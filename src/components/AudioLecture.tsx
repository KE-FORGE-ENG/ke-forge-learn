import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Pause, Square } from "lucide-react";

export function AudioLecture({ text, title }: { text: string; title?: string }) {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prefer a clear English voice
      const preferred =
        voices.find((v) => /en[-_](US|GB)/i.test(v.lang) && /female|samantha|google/i.test(v.name)) ||
        voices.find((v) => /^en/i.test(v.lang)) ||
        voices[0];
      if (preferred) setVoice(preferred);
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const full = (title ? `${title}. ` : "") + text;
    // Chunk long text to avoid browser cut-offs
    const chunks = full.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [full];
    const utterAll = chunks.map((c) => {
      const u = new SpeechSynthesisUtterance(c.trim());
      if (voice) u.voice = voice;
      u.rate = 1; u.pitch = 1; u.volume = 1;
      return u;
    });
    utterAll.forEach((u, i) => {
      if (i === utterAll.length - 1) u.onend = () => setPlaying(false);
      window.speechSynthesis.speak(u);
    });
    setPlaying(true);
    setPaused(false);
  };

  const toggle = () => {
    if (!playing) return speak();
    if (paused) { window.speechSynthesis.resume(); setPaused(false); }
    else { window.speechSynthesis.pause(); setPaused(true); }
  };

  const stop = () => { window.speechSynthesis.cancel(); setPlaying(false); setPaused(false); };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={toggle} variant={playing ? "secondary" : "outline"} size="sm">
        {!playing ? <><Volume2 className="w-4 h-4 mr-1" /> Listen</> : paused ? <><Volume2 className="w-4 h-4 mr-1" /> Resume</> : <><Pause className="w-4 h-4 mr-1" /> Pause</>}
      </Button>
      {playing && <Button onClick={stop} variant="ghost" size="sm"><Square className="w-3 h-3 mr-1" /> Stop</Button>}
    </div>
  );
}
