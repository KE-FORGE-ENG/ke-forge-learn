import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { callAi } from "@/lib/api";
import { Loader2, Sparkles, Network } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/mindmap/$planId")({ component: MindMap });

type Mind = { root: string; branches: { label: string; children: string[] }[] };

function MindMap() {
  const { planId } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [mind, setMind] = useState<Mind | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("learning_plans").select("*").eq("id", planId).single();
      if (!p) return;
      const { data: d } = await supabase.from("documents").select("*").eq("id", p.document_id).single();
      setDoc(d);
      const { data: cached } = await supabase.from("mindmaps").select("*").eq("plan_id", planId).maybeSingle();
      if (cached) setMind(cached.data as Mind);
    })();
  }, [user, planId]);

  const generate = async () => {
    if (!user || !doc) return;
    setBusy(true);
    try {
      const sourceText = ((doc.pages as any[]) ?? []).map((p) => p.text).join("\n").slice(0, 16000);
      const result = (await callAi("generate_mindmap", { sourceText, docTitle: doc.title })) as Mind;
      await supabase.from("mindmaps").upsert({ user_id: user.id, plan_id: planId, data: result }, { onConflict: "user_id,plan_id" });
      setMind(result);
      toast.success("Mind map ready");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  if (!user || !doc) return <AppShell><div className="py-20 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></AppShell>;

  // Layout branches in a circle around root
  const W = 1000, H = 700, cx = W / 2, cy = H / 2;
  const renderMap = () => {
    if (!mind) return null;
    const n = mind.branches.length;
    const r1 = 220;
    const r2 = 360;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* connections */}
        {mind.branches.map((b, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const bx = cx + r1 * Math.cos(a);
          const by = cy + r1 * Math.sin(a);
          return (
            <g key={`l-${i}`}>
              <line x1={cx} y1={cy} x2={bx} y2={by} stroke="hsl(var(--primary))" strokeWidth={2} opacity={0.6} />
              {b.children.map((_, j) => {
                const cn = b.children.length;
                const spread = Math.PI / 3;
                const ca = a - spread / 2 + (j / Math.max(1, cn - 1)) * spread;
                const cax = cx + r2 * Math.cos(ca);
                const cay = cy + r2 * Math.sin(ca);
                return <line key={`cl-${i}-${j}`} x1={bx} y1={by} x2={cax} y2={cay} stroke="hsl(var(--muted-foreground))" strokeWidth={1.2} opacity={0.4} />;
              })}
            </g>
          );
        })}
        {/* root */}
        <g>
          <circle cx={cx} cy={cy} r={70} fill="hsl(var(--primary))" />
          <foreignObject x={cx - 65} y={cy - 30} width={130} height={60}>
            <div style={{ width: 130, height: 60 }} className="flex items-center justify-center text-center text-primary-foreground text-sm font-bold leading-tight px-2">
              {mind.root}
            </div>
          </foreignObject>
        </g>
        {/* branches */}
        {mind.branches.map((b, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const bx = cx + r1 * Math.cos(a);
          const by = cy + r1 * Math.sin(a);
          return (
            <g key={`b-${i}`}>
              <rect x={bx - 70} y={by - 22} width={140} height={44} rx={12} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={1.5} />
              <foreignObject x={bx - 65} y={by - 18} width={130} height={36}>
                <div style={{ width: 130, height: 36 }} className="flex items-center justify-center text-center text-foreground text-xs font-semibold leading-tight px-1">
                  {b.label}
                </div>
              </foreignObject>
              {b.children.map((c, j) => {
                const cn = b.children.length;
                const spread = Math.PI / 3;
                const ca = a - spread / 2 + (j / Math.max(1, cn - 1)) * spread;
                const cax = cx + r2 * Math.cos(ca);
                const cay = cy + r2 * Math.sin(ca);
                return (
                  <g key={`c-${i}-${j}`}>
                    <rect x={cax - 55} y={cay - 16} width={110} height={32} rx={10} fill="hsl(var(--secondary))" />
                    <foreignObject x={cax - 50} y={cay - 12} width={100} height={24}>
                      <div style={{ width: 100, height: 24 }} className="flex items-center justify-center text-center text-secondary-foreground text-[10px] leading-tight px-1">
                        {c}
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <Link to="/learn/$planId" params={{ planId }} className="text-sm text-muted-foreground hover:text-foreground">← Back to lesson</Link>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-2"><Network className="w-5 h-5 text-primary" /> Mind map</h1>
        </div>
        <Button onClick={generate} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
          {mind ? "Regenerate" : "Generate"}
        </Button>
      </div>

      <Card className="p-4 overflow-x-auto">
        {!mind ? (
          <div className="py-20 text-center text-muted-foreground">
            <Network className="w-10 h-10 mx-auto mb-3 text-primary/60" />
            <p>Generate a visual concept map of "{doc.title}".</p>
          </div>
        ) : renderMap()}
      </Card>
    </AppShell>
  );
}
