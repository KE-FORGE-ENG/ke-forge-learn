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
  // Check every minute whether we should fire
  const tick = () => {
    const pref = getPref();
    if (!pref.enabled) return;
    const now = new Date();
    const [h, m] = pref.time.split(":").map(Number);
    if (now.getHours() !== h || now.getMinutes() !== m) return;
    const lastKey = "etech.reminder.last";
    const today = now.toISOString().slice(0, 10);
    if (localStorage.getItem(lastKey) === today) return;
    localStorage.setItem(lastKey, today);
    if (Notification.permission === "granted") {
      new Notification("KE-FORGE LEARN", {
        body: "Time to study! Your next lesson is ready 🚀",
        icon: "/favicon.ico",
      });
    }
  };
  tick();
  return setInterval(tick, 60_000);
}
