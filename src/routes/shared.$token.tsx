import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RotateCw, Sparkles } from "lucide-react";
import logoAsset from "@/assets/ke-forge-logo.png.asset.json";

export const Route = createFileRoute("/shared/$token")({ component: Shared });

type FC = { id: string; front: string; back: string };

function Shared() {
  const { token } = Route.useParams();
  const [plan, setPlan] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [cards, setCards] = useState<FC[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("learning_plans").select("*").eq("share_token", token).eq("is_public", true).maybeSingle();
      if (!p) { setNotFound(true); setLoading(false); return; }
      setPlan(p);
      const { data: d } = await supabase.from("documents").select("*").eq("id", p.document_id).maybeSingle();
      setDoc(d);
      const { data: c } = await supabase.from("flashcards").select("id,front,back").eq("plan_id", p.id).limit(200);
      setCards((c ?? []) as FC[]);
      setLoading(false);
    })();
  }, [token]);

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (notFound) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Shared deck not found</h1>
        <p className="text-sm text-muted-foreground mt-1">The link may have expired or sharing was disabled.</p>
        <Button asChild className="mt-4"><Link to="/">Go home</Link></Button>
      </div>
    </div>
  );

  const current = cards[idx];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-sm">
            <div className="w-7 h-7 rounded bg-black grid place-items-center overflow-hidden">
              <img src={logoAsset.url} alt="KE-FORGE LEARN" className="w-full h-full object-contain" />
            </div>
            KE-FORGE LEARN
          </Link>
          <Button asChild size="sm" variant="outline"><Link to="/auth">Sign up free</Link></Button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" /> Shared flashcard deck</div>
        <h1 className="text-2xl font-bold mt-1">{doc?.title ?? "Deck"}</h1>
        <p className="text-sm text-muted-foreground">{cards.length} cards</p>

        {cards.length === 0 ? (
          <Card className="p-12 mt-6 text-center text-muted-foreground">No cards in this deck yet.</Card>
        ) : (
          <div className="mt-6">
            <Card
              className="p-10 min-h-[260px] cursor-pointer select-none flex items-center justify-center text-center"
              onClick={() => setFlipped(!flipped)}
            >
              <div>
                <div className="text-xs uppercase tracking-wider text-primary mb-3">{flipped ? "Answer" : "Question"}</div>
                <p className="text-xl font-medium whitespace-pre-wrap">{flipped ? current.back : current.front}</p>
                {!flipped && <p className="text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1"><RotateCw className="w-3 h-3" /> Tap to flip</p>}
              </div>
            </Card>
            <div className="flex justify-between mt-4">
              <Button variant="outline" disabled={idx === 0} onClick={() => { setIdx(idx - 1); setFlipped(false); }}>Previous</Button>
              <div className="text-xs text-muted-foreground self-center">{idx + 1} / {cards.length}</div>
              <Button disabled={idx === cards.length - 1} onClick={() => { setIdx(idx + 1); setFlipped(false); }}>Next</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
