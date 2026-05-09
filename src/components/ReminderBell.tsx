import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ensurePermission, getPref, setPref } from "@/lib/reminders";
import { toast } from "sonner";

export function ReminderBell() {
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("18:00");

  useEffect(() => {
    const p = getPref();
    setEnabled(p.enabled);
    setTime(p.time);
  }, []);

  const save = async (next: { enabled: boolean; time: string }) => {
    if (next.enabled) {
      const ok = await ensurePermission();
      if (!ok) {
        toast.error("Enable notifications in your browser settings to receive reminders.");
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
