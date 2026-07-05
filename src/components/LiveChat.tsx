import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Send, Volume2, VolumeX, Sparkles, Brain, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string; sources?: string[] };

export function LiveChat({ planId, day, sourceText }: { planId?: string; day?: number; sourceText?: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "👋 Hi! I'm your adaptive tutor. I'll learn how you learn and adjust on the fly. Ask me anything about today's lesson — or use the mic to speak." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const recRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("learning_profiles").select("profile").maybeSingle();
      if (data?.profile) setProfile(data.profile);
    })();
  }, [messages.length]);

  const speak = (text: string) => {
    if (!speakOn || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*_`#>\-]/g, "").slice(0, 800);
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1; u.pitch = 1;
    window.speechSynthesis.speak(u);
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("tutor-chat", {
        body: { message: msg, planId, day, sourceText, history: messages },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const answer = (data as any).answer as string;
      const sources = ((data as any).sources ?? []) as string[];
      setMessages((m) => [...m, { role: "assistant", content: answer, sources }]);
      speak(answer);

    } catch (e: any) {
      toast.error(e.message ?? "Chat failed");
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I hit an error. Try again." }]);
    } finally { setBusy(false); }
  };

  const toggleMic = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported in this browser"); return; }
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.continuous = false;
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput(t); send(t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r; r.start(); setListening(true);
  };

  return (
    <Card className="flex flex-col h-[560px] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Live Tutor Chat</span>
          {profile?.level && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
              {profile.level} • {profile.pace}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSpeakOn((v) => !v)} aria-label="Toggle voice">
          {speakOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`rounded-2xl px-3 py-2 max-w-[85%] text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Thinking…</div>}
      </div>

      <div className="p-3 border-t flex gap-2">
        <Button variant={listening ? "default" : "outline"} size="icon" onClick={toggleMic} aria-label="Voice">
          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
        <input
          className="flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          placeholder="Ask anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={busy}
        />
        <Button onClick={() => send()} disabled={busy || !input.trim()} size="icon"><Send className="w-4 h-4" /></Button>
      </div>
      {profile?.notes && (
        <div className="px-3 py-2 border-t text-[10px] text-muted-foreground flex items-start gap-1">
          <Sparkles className="w-3 h-3 mt-0.5 text-primary shrink-0" /> <span className="line-clamp-2">{profile.notes}</span>
        </div>
      )}
    </Card>
  );
}
