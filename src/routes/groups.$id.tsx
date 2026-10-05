import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Trophy, Copy, Plus, BookOpen, Trash2, Users, Share2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$id")({ component: GroupDetail });

type Member = { user_id: string; points: number; joined_at: string; username?: string };
type OwnedPlan = { id: string; document_id: string; days: number; title: string };
type SharedPlan = { id: string; plan_id: string; user_id: string; title: string; days: number; author_name: string; created_at: string };
type Challenge = { id: string; user_id: string; plan_title: string; score_pct: number; correct_count: number; question_count: number; duration_seconds: number; created_at: string };

function GroupDetail() {
  const { id } = Route.useParams();
  const { user, loading, username } = useAuth();
  const nav = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [ownedPlans, setOwnedPlans] = useState<OwnedPlan[]>([]);
  const [sharedPlans, setSharedPlans] = useState<SharedPlan[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  const load = async () => {
    if (!user) return;
    const { data: g } = await supabase.from("study_groups").select("*").eq("id", id).maybeSingle();
    setGroup(g);
    if (!g) return;
    const [{ data: m }, { data: shared }, { data: scores }, { data: plans }] = await Promise.all([
      supabase.from("group_members").select("user_id,points,joined_at").eq("group_id", id),
      supabase.from("group_shared_plans").select("id,plan_id,user_id,title,days,author_name,created_at").eq("group_id", id).order("created_at", { ascending: false }),
      supabase.from("group_challenge_scores").select("id,user_id,plan_title,score_pct,correct_count,question_count,duration_seconds,created_at").eq("group_id", id).order("score_pct", { ascending: false }).order("created_at", { ascending: false }).limit(30),
      supabase.from("learning_plans").select("id,document_id,days").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    const ms = (m ?? []) as Member[];
    const ids = ms.map((x) => x.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      const names = new Map((profs ?? []).map((p) => [p.id, p.username]));
      ms.forEach((x) => { x.username = names.get(x.user_id) ?? `learner-${x.user_id.slice(0, 5)}`; });
    }
    ms.sort((a, b) => b.points - a.points);
    setMembers(ms);
    setSharedPlans((shared ?? []) as SharedPlan[]);
    setChallenges((scores ?? []) as Challenge[]);
    const planRows = plans ?? [];
    if (planRows.length) {
      const { data: docs } = await supabase.from("documents").select("id,title").in("id", planRows.map((p) => p.document_id));
      const titles = new Map((docs ?? []).map((d) => [d.id, d.title]));
      const full = planRows.map((p) => ({ ...p, title: titles.get(p.document_id) ?? "Untitled plan" }));
      setOwnedPlans(full);
      if (!selectedPlan && full[0]) setSelectedPlan(full[0].id);
    } else setOwnedPlans([]);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user, id]);

  const award = async (n: number) => {
    if (!user) return;
    const me = members.find((m) => m.user_id === user.id);
    const { error } = await supabase.from("group_members").update({ points: (me?.points ?? 0) + n }).eq("group_id", id).eq("user_id", user.id);
    if (error) toast.error(error.message); else void load();
  };
  const sharePlan = async () => {
    if (!user || !selectedPlan) return;
    const plan = ownedPlans.find((p) => p.id === selectedPlan);
    if (!plan) return;
    setBusy(true);
    const { error } = await supabase.from("group_shared_plans").insert({ group_id: id, plan_id: plan.id, user_id: user.id, title: plan.title, days: plan.days, author_name: username ?? "learner" });
    if (error) toast.error(error.message); else { toast.success("Plan added to the Squad Locker"); await load(); }
    setBusy(false);
  };
  const removeShared = async (item: SharedPlan) => {
    const { error } = await supabase.from("group_shared_plans").delete().eq("id", item.id);
    if (error) toast.error(error.message); else { toast.success("Removed from locker"); await load(); }
  };
  const copyShared = async (item: SharedPlan) => {
    if (!user) return;
    setCopying(item.id);
    try {
      const { data: plan, error: planError } = await supabase.from("learning_plans").select("document_id,days,page_chunks").eq("id", item.plan_id).maybeSingle();
      if (planError || !plan) throw new Error("This shared plan is unavailable.");
      const { data: doc, error: docError } = await supabase.from("documents").select("title,source_type,pages,page_count").eq("id", plan.document_id).maybeSingle();
      if (docError || !doc) throw new Error("The source material is unavailable.");
      const { data: newDoc, error: newDocError } = await supabase.from("documents").insert({ ...doc, user_id: user.id, storage_path: null }).select("id").single();
      if (newDocError) throw newDocError;
      const { data: newPlan, error: newPlanError } = await supabase.from("learning_plans").insert({ user_id: user.id, document_id: newDoc.id, days: plan.days, page_chunks: plan.page_chunks }).select("id").single();
      if (newPlanError) throw newPlanError;
      const { data: cards } = await supabase.from("flashcards").select("front,back,day").eq("plan_id", item.plan_id).limit(500);
      if (cards?.length) {
        const { error } = await supabase.from("flashcards").insert(cards.map((card) => ({ ...card, user_id: user.id, plan_id: newPlan.id })));
        if (error) throw error;
      }
      toast.success("Copied into your library");
      nav({ to: "/learn/$planId", params: { planId: newPlan.id } });
    } catch (e: any) { toast.error(e.message ?? "Could not copy plan"); }
    finally { setCopying(null); }
  };
  const copyCode = async () => {
    if (!group) return;
    await navigator.clipboard.writeText(group.join_code);
    toast.success("Join code copied");
  };

  if (!user) return null;
  if (!group) return <AppShell><div className="py-20 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></AppShell>;

  return (
    <AppShell>
      <Link to="/groups" className="text-sm text-muted-foreground hover:text-foreground">← All groups</Link>
      <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
        <div><h1 className="text-2xl sm:text-3xl font-bold">{group.name}</h1>{group.description && <p className="text-sm text-muted-foreground mt-1">{group.description}</p>}</div>
        <Button variant="outline" size="sm" onClick={copyCode}><Copy className="w-4 h-4 mr-1" /> {group.join_code}</Button>
      </div>

      <section className="mt-7" aria-labelledby="locker-title">
        <div className="flex items-center gap-2 mb-3"><BookOpen className="w-5 h-5 text-primary" /><div><h2 id="locker-title" className="text-lg font-semibold">Squad Locker</h2><p className="text-xs text-muted-foreground">Study plans shared privately with group members.</p></div></div>
        <Card className="p-4 mb-3">
          {ownedPlans.length ? <div className="flex flex-col sm:flex-row gap-2">
            <select aria-label="Choose a plan to share" className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm" value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
              {ownedPlans.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.days} days</option>)}
            </select>
            <Button onClick={sharePlan} disabled={busy || !selectedPlan}><Share2 className="w-4 h-4 mr-1" /> Share with group</Button>
          </div> : <p className="text-sm text-muted-foreground">Create a study plan to share it here.</p>}
        </Card>
        {sharedPlans.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sharedPlans.map((item) => <Card key={item.id} className="p-4 flex flex-col">
            <h3 className="font-semibold line-clamp-2">{item.title}</h3><p className="text-xs text-muted-foreground mt-1">{item.days} days · shared by @{item.author_name}</p>
            <div className="flex gap-2 mt-3"><Button size="sm" className="flex-1" disabled={copying === item.id} onClick={() => void copyShared(item)}>{copying === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Copy to my library"}</Button>
              {item.user_id === user.id && <Button variant="outline" size="icon" aria-label="Remove from locker" title="Remove from locker" onClick={() => void removeShared(item)}><Trash2 className="w-4 h-4" /></Button>}</div>
          </Card>)}
        </div> : <Card className="p-6 text-center text-sm text-muted-foreground">No shared plans yet.</Card>}
      </section>

      <Card className="p-5 mt-7">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2 font-semibold"><Trophy className="w-4 h-4 text-accent" /> Points leaderboard</div>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void award(10)}><Plus className="w-3 h-3 mr-1" /> 10 points</Button><Button size="sm" variant="outline" onClick={() => void award(25)}><Plus className="w-3 h-3 mr-1" /> 25 points</Button></div>
        </div>
        <ul className="divide-y">{members.map((m, i) => <li key={m.user_id} className="py-2 flex items-center justify-between text-sm"><span><span className={`inline-block w-7 text-center font-bold ${i === 0 ? "text-accent" : "text-muted-foreground"}`}>{i + 1}</span> <span className={m.user_id === user.id ? "font-semibold text-primary" : ""}>@{m.username}</span></span><span className="font-mono">{m.points} pts</span></li>)}{members.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">No members yet.</li>}</ul>
      </Card>

      <section className="mt-7" aria-labelledby="challenges-title">
        <div className="flex items-center gap-2 mb-3"><Users className="w-5 h-5 text-primary" /><div><h2 id="challenges-title" className="text-lg font-semibold">CBT peer challenges</h2><p className="text-xs text-muted-foreground">Scores learners chose to share with this group.</p></div></div>
        <Card className="p-4">
          {challenges.length ? <div className="divide-y">{challenges.map((c, i) => <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm"><div><span className="font-semibold">{i + 1}. {c.plan_title}</span><span className="block text-xs text-muted-foreground">Learner {c.user_id.slice(0, 8)} · {c.correct_count}/{c.question_count} correct</span></div><span className="font-semibold tabular-nums">{c.score_pct}%</span></div>)}</div> : <p className="py-3 text-center text-sm text-muted-foreground">No shared challenge scores yet. Share a CBT result from a quiz to start.</p>}
        </Card>
      </section>
    </AppShell>
  );
}