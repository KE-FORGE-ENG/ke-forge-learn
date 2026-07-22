import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Plus, LogIn } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/groups")({ component: Groups });

type Group = { id: string; name: string; description: string | null; owner_id: string; join_code: string };

function Groups() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("study_groups").select("*").order("created_at", { ascending: false });
    setGroups((data ?? []) as Group[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const create = async () => {
    if (!user || !newName.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("study_groups").insert({
        name: newName.trim(), description: newDesc.trim() || null, owner_id: user.id,
      }).select().single();
      if (error) throw error;
      await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id });
      toast.success("Group created");
      setNewName(""); setNewDesc("");
      load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  const join = async () => {
    if (!user || !code.trim()) return;
    setBusy(true);
    try {
      const { data: g, error: ge } = await supabase
        .from("study_groups").select("id").eq("join_code", code.trim().toLowerCase()).maybeSingle();
      if (ge) throw ge;
      if (!g) { toast.error("No group found with that code"); return; }
      const { error } = await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
      if (error && !String(error.message).includes("duplicate")) throw error;
      toast.success("Joined!");
      setCode("");
      load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  if (!user) return null;

  return (
    <AppShell>
      <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-primary" /> Study groups</h1>
      <p className="text-sm text-muted-foreground mt-1">Compete on a private leaderboard with friends.</p>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Card className="p-5">
          <h2 className="font-semibold mb-2 flex items-center gap-1"><Plus className="w-4 h-4 text-primary" /> Create a group</h2>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Bio crew" /></div>
            <div className="space-y-1"><Label>Description (optional)</Label><Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Final exam push" /></div>
            <Button onClick={create} disabled={busy || !newName.trim()} className="w-full">Create group</Button>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold mb-2 flex items-center gap-1"><LogIn className="w-4 h-4 text-primary" /> Join with code</h2>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Join code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. a1b2c3d4" /></div>
            <Button onClick={join} disabled={busy || !code.trim()} variant="outline" className="w-full">Join</Button>
          </div>
        </Card>
      </div>

      <h2 className="text-lg font-semibold mt-8 mb-3">Your groups</h2>
      {groups.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">No groups yet.</Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map((g) => (
            <Card key={g.id} className="p-4">
              <h3 className="font-semibold">{g.name}</h3>
              {g.description && <p className="text-xs text-muted-foreground mt-1">{g.description}</p>}
              <div className="text-[11px] text-muted-foreground mt-2 font-mono">Code: {g.join_code}</div>
              <Button asChild size="sm" className="mt-3 w-full"><Link to="/groups/$id" params={{ id: g.id }}>Open</Link></Button>
            </Card>
          ))}
        </div>
      )}

      {busy && <div className="mt-4 text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Working…</div>}
    </AppShell>
  );
}
