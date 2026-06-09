import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Trophy, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$id")({ component: GroupDetail });

type Member = { user_id: string; points: number; joined_at: string; username?: string };

function GroupDetail() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  const load = async () => {
    if (!user) return;
    const { data: g } = await supabase.from("study_groups").select("*").eq("id", id).maybeSingle();
    setGroup(g);
    if (!g) return;
    const { data: m } = await supabase.from("group_members").select("user_id,points,joined_at").eq("group_id", id);
    const ms = (m ?? []) as Member[];
    // Fetch usernames
    const ids = ms.map((x) => x.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.username]));
      ms.forEach((x) => { x.username = map.get(x.user_id) ?? "learner"; });
    }
    ms.sort((a, b) => b.points - a.points);
    setMembers(ms);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, id]);

  const award = async (n: number) => {
    if (!user) return;
    const me = members.find((m) => m.user_id === user.id);
    const next = (me?.points ?? 0) + n;
    await supabase.from("group_members").update({ points: next }).eq("group_id", id).eq("user_id", user.id);
    load();
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
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{group.name}</h1>
          {group.description && <p className="text-sm text-muted-foreground mt-1">{group.description}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={copyCode}><Copy className="w-4 h-4 mr-1" /> {group.join_code}</Button>
      </div>

      <Card className="p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-semibold"><Trophy className="w-4 h-4 text-accent" /> Leaderboard</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => award(10)}><Plus className="w-3 h-3 mr-1" /> 10 pts (study session)</Button>
            <Button size="sm" variant="outline" onClick={() => award(25)}><Plus className="w-3 h-3 mr-1" /> 25 pts (day complete)</Button>
          </div>
        </div>
        <ul className="divide-y">
          {members.map((m, i) => (
            <li key={m.user_id} className="py-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className={`w-6 text-center font-bold ${i === 0 ? "text-accent" : "text-muted-foreground"}`}>{i + 1}</span>
                <span className={m.user_id === user.id ? "font-semibold text-primary" : ""}>@{m.username}</span>
              </div>
              <span className="font-mono">{m.points} pts</span>
            </li>
          ))}
          {members.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">No members yet.</li>}
        </ul>
      </Card>
    </AppShell>
  );
}
