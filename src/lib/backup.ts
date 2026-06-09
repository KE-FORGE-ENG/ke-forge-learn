import { supabase } from "@/integrations/supabase/client";

export async function exportUserBackup(userId: string) {
  const [docs, plans, sessions, flashcards, deep, bookmarks, profile] = await Promise.all([
    supabase.from("documents").select("*").eq("user_id", userId),
    supabase.from("learning_plans").select("*").eq("user_id", userId),
    supabase.from("daily_sessions").select("*").eq("user_id", userId),
    supabase.from("flashcards").select("*").eq("user_id", userId),
    supabase.from("deep_progress").select("*").eq("user_id", userId),
    supabase.from("bookmarks").select("*").eq("user_id", userId),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: profile.data ?? null,
    documents: docs.data ?? [],
    learning_plans: plans.data ?? [],
    daily_sessions: sessions.data ?? [],
    flashcards: flashcards.data ?? [],
    deep_progress: deep.data ?? [],
    bookmarks: bookmarks.data ?? [],
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ke-forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return payload;
}
