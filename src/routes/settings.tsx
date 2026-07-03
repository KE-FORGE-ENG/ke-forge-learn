import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { loadA11y, saveA11y, defaultA11y, type A11ySettings } from "@/lib/accessibility";
import { exportUserBackup } from "@/lib/backup";
import { ensurePermission, sendTestNotification } from "@/lib/reminders";
import { Accessibility, Download, RotateCcw, Loader2, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [s, setS] = useState<A11ySettings>(defaultA11y);
  const [busy, setBusy] = useState(false);
  const [notifState, setNotifState] = useState<"default" | "granted" | "denied" | "unsupported">("default");

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);
  useEffect(() => {
    setS(loadA11y());
    if (typeof Notification === "undefined") { setNotifState("unsupported"); return; }
    setNotifState(Notification.permission as any);
    // One-time auto prompt when landing on settings, only if never asked before
    const askedKey = "etech.notif.asked";
    if (Notification.permission === "default" && !localStorage.getItem(askedKey)) {
      localStorage.setItem(askedKey, "1");
      ensurePermission().then((ok) => {
        setNotifState(Notification.permission as any);
        if (ok) toast.success("Notifications enabled");
      });
    }
  }, []);

  const requestNotif = async () => {
    if (typeof Notification === "undefined") { toast.error("This browser doesn't support notifications."); return; }
    if (Notification.permission === "denied") {
      toast.error("Blocked. Open your browser's site settings for this page and allow notifications, then reload.", { duration: 8000 });
      return;
    }
    const ok = await ensurePermission();
    setNotifState(Notification.permission as any);
    if (ok) {
      sendTestNotification();
      toast.success("Notifications enabled");
    } else {
      toast.error("Permission not granted.");
    }
  };

  const update = (patch: Partial<A11ySettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveA11y(next);
  };

  const reset = () => { setS(defaultA11y); saveA11y(defaultA11y); toast.success("Reset to defaults"); };

  const backup = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await exportUserBackup(user.id);
      toast.success("Backup downloaded");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  if (!user) return null;

  return (
    <AppShell>
      <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>

      <Card className="p-5 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Accessibility className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Accessibility</h2>
        </div>
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Text size</Label>
              <span className="text-xs text-muted-foreground">{Math.round(s.fontScale * 100)}%</span>
            </div>
            <Slider min={0.85} max={1.5} step={0.05} value={[s.fontScale]} onValueChange={(v) => update({ fontScale: v[0] })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Dyslexia-friendly font</Label>
              <p className="text-xs text-muted-foreground">Wider letter spacing, easier reading.</p>
            </div>
            <Switch checked={s.dyslexiaFont} onCheckedChange={(v) => update({ dyslexiaFont: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>High contrast</Label>
              <p className="text-xs text-muted-foreground">Bolder borders and stronger text.</p>
            </div>
            <Switch checked={s.highContrast} onCheckedChange={(v) => update({ highContrast: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Reduce motion</Label>
              <p className="text-xs text-muted-foreground">Disable animations.</p>
            </div>
            <Switch checked={s.reduceMotion} onCheckedChange={(v) => update({ reduceMotion: v })} />
          </div>
          <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="w-4 h-4 mr-1" /> Reset</Button>
        </div>
      </Card>

      <Card className="p-5 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Download className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Backup your data</h2>
        </div>
        <p className="text-sm text-muted-foreground">Download a JSON file with every document, plan, flashcard, and progress entry. Store it safely.</p>
        <Button className="mt-3" onClick={backup} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />} Download backup
        </Button>
      </Card>
    </AppShell>
  );
}
