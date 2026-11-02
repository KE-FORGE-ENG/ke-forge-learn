import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/UserAvatar";
import { resizeAvatar } from "@/lib/profile";
import { Camera, Eye, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — KE-FORGE LEARN" },
      { name: "description", content: "Set your name, photo, country and school on KE-FORGE LEARN." },
      { property: "og:title", content: "Your profile — KE-FORGE LEARN" },
      { property: "og:description", content: "Set your name, photo, country and school on KE-FORGE LEARN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const COUNTRIES = [
  "🇳🇬 Nigeria", "🇬🇭 Ghana", "🇰🇪 Kenya", "🇿🇦 South Africa", "🇪🇬 Egypt", "🇺🇬 Uganda", "🇹🇿 Tanzania", "🇷🇼 Rwanda", "🇨🇲 Cameroon", "🇸🇳 Senegal",
  "🇺🇸 United States", "🇨🇦 Canada", "🇬🇧 United Kingdom", "🇮🇪 Ireland", "🇫🇷 France", "🇩🇪 Germany", "🇪🇸 Spain", "🇮🇹 Italy", "🇳🇱 Netherlands",
  "🇹🇷 Turkey", "🇯🇵 Japan", "🇨🇳 China", "🇮🇳 India", "🇵🇰 Pakistan", "🇦🇪 United Arab Emirates", "🇸🇦 Saudi Arabia", "🇧🇷 Brazil", "🇲🇽 Mexico", "🇦🇺 Australia", "🌍 Other",
];

function ProfilePage() {
  const { user, loading, username } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const [institution, setInstitution] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,avatar_url,country,institution").eq("id", user.id).maybeSingle().then(({ data }) => {
      setDisplayName(data?.display_name ?? "");
      setAvatar(data?.avatar_url ?? null);
      setCountry(data?.country ?? "");
      setInstitution(data?.institution ?? "");
      setReady(true);
    });
  }, [user]);

  const pick = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image");
    try { setAvatar(await resizeAvatar(f)); } catch (e: any) { toast.error(e.message); }
  };

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim().slice(0, 80) || null,
      avatar_url: avatar,
      country: country || null,
      institution: institution.trim().slice(0, 120) || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  if (!user) return null;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Account</div>
        <h1 className="text-3xl font-semibold mt-1">Your profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Tell us a little about yourself.</p>

        {!ready ? <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div> : (
          <>
            <Card className="p-6 mt-6">
              <div className="flex items-center gap-2 text-xs font-medium text-primary"><Eye className="w-3.5 h-3.5" /> Visible to the community</div>
              <div className="flex flex-col sm:flex-row gap-6 mt-4 items-start">
                <button type="button" onClick={() => fileRef.current?.click()} className="relative group" aria-label="Change profile picture">
                  <UserAvatar name={displayName || username} src={avatar} size={96} />
                  <span className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground p-1.5 border-2 border-card"><Camera className="w-3.5 h-3.5" /></span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                <div className="flex-1 w-full space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="dn">Display name</Label>
                    <Input id="dn" value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Adaeze Okafor" />
                  </div>
                  <div className="text-xs text-muted-foreground">Username: @{username ?? "you"}</div>
                  {avatar && <Button variant="ghost" size="sm" onClick={() => setAvatar(null)}>Remove photo</Button>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Your name and photo appear on plans you publish and on study group leaderboards.</p>
            </Card>

            <Card className="p-6 mt-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Lock className="w-3.5 h-3.5" /> Private — only you can see this</div>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="ct">Country</Label>
                  <select id="ct" value={country} onChange={(e) => setCountry(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select your country</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="in">University, college or school</Label>
                  <Input id="in" value={institution} maxLength={120} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. University of Lagos" />
                </div>
              </div>
            </Card>

            <Button className="mt-5 w-full sm:w-auto" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save profile"}</Button>
          </>
        )}
      </div>
    </AppShell>
  );
}
