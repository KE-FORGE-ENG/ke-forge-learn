import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ensurePermission, getPref, setPref, sendTestNotification } from "@/lib/reminders";
import { toast } from "sonner";

export function ReminderBell() {
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("18:00");
  const [permGranted, setPermGranted] = useState(false);

  useEffect(() => {
    const p = getPref();
    setEnabled(p.enabled);
    setTime(p.time);
    if (typeof Notification !== "undefined") {
      setPermGranted(Notification.permission === "granted");
    }
  }, []);

  const save = async (next: { enabled: boolean; time: string }) => {
    if (next.enabled) {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        toast.error("Notifications are blocked. Tap the lock icon in the address bar → Notifications → Allow, then reload.", { duration: 8000 });
        return;
      }
      const ok = await ensurePermission();
      if (!ok) {
        toast.error("Notification permission was not granted.");
        return;
      }
    }
    setPref(next);
    setEnabled(next.enabled);
    setTime(next.time);
    toast.success(next.enabled ? `Daily reminder set for ${next.time}` : "Reminders off");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Reminders">
          {enabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-sm">Daily study reminder</p>
            <p className="text-xs text-muted-foreground mt-1">We'll send a browser notification at your chosen time.</p>
          </div>
          {permGranted ? (
            <div className="text-xs rounded-md border border-primary/30 bg-primary/10 text-primary px-3 py-2">
              ✅ Browser notifications are allowed for this site.
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={async () => {
                if (typeof Notification === "undefined") {
                  toast.error("This browser doesn't support notifications.");
                  return;
                }
                if (Notification.permission === "denied") {
                  toast.error("Notifications are blocked. Enable them in your browser site settings.");
                  return;
                }
                const ok = await ensurePermission();
                if (ok) {
                  setPermGranted(true);
                  new Notification("KE-FORGE LEARN", { body: "Notifications enabled ✅", icon: "/favicon.ico" });
                  toast.success("Browser notifications enabled");
                } else {
                  toast.error("Permission not granted.");
                }
              }}
            >
              Enable browser notifications
            </Button>
          )}
          <div className="flex items-center justify-between">
            <Label htmlFor="rem-on">Enabled</Label>
            <Switch id="rem-on" checked={enabled} onCheckedChange={(v) => save({ enabled: v, time })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rem-t">Time</Label>
            <Input id="rem-t" type="time" value={time} onChange={(e) => save({ enabled, time: e.target.value })} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
