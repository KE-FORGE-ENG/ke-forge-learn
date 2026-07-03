// Browser-based daily reminder using Notification API + localStorage
const KEY = "etech.reminder";

export type ReminderPref = { enabled: boolean; time: string }; // "HH:MM"

export function getPref(): ReminderPref {
  if (typeof window === "undefined") return { enabled: false, time: "18:00" };
  try {
    return JSON.parse(localStorage.getItem(KEY) || "") || { enabled: false, time: "18:00" };
  } catch {
    return { enabled: false, time: "18:00" };
  }
}

export function setPref(p: ReminderPref) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export async function ensurePermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const r = await Notification.requestPermission();
  return r === "granted";
}

export function startReminderLoop() {
  if (typeof window === "undefined") return;
  const tick = () => {
    const pref = getPref();
    if (!pref.enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = new Date();
    const [h, m] = pref.time.split(":").map(Number);
    const scheduled = new Date(now);
    scheduled.setHours(h, m, 0, 0);
    if (now < scheduled) return;
    const lastKey = "etech.reminder.last";
    const today = now.toISOString().slice(0, 10);
    if (localStorage.getItem(lastKey) === today) return;
    localStorage.setItem(lastKey, today);
    try {
      new Notification("KE-FORGE LEARN", {
        body: "Time to study! Your next lesson is ready 🚀",
        icon: "/favicon.ico",
      });
    } catch {}
  };
  tick();
  const id = setInterval(tick, 30_000);
  window.addEventListener("focus", tick);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  return id;
}

export function sendTestNotification(): { ok: boolean; reason?: string } {
  if (typeof Notification === "undefined") return { ok: false, reason: "This browser doesn't support notifications." };
  if (Notification.permission !== "granted") return { ok: false, reason: "Notifications aren't allowed yet." };
  try {
    new Notification("KE-FORGE LEARN", { body: "✅ Test notification — reminders will work like this.", icon: "/favicon.ico" });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "Failed to send." };
  }
}
