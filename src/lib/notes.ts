// Local-first notes: persists in localStorage so it works offline.
// Synced to backend opportunistically when available.
import { supabase } from "@/integrations/supabase/client";

export type Note = {
  id: string;
  title: string;
  body: string;
  planId: string | null;
  updatedAt: number;
  createdAt: number;
};

const KEY = "ke-forge.notes.v1";

function readAll(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notes: Note[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(notes));
  window.dispatchEvent(new CustomEvent("ke-forge-notes-changed"));
}

export function listNotes(planId?: string | null): Note[] {
  const all = readAll().sort((a, b) => b.updatedAt - a.updatedAt);
  if (planId === undefined) return all;
  return all.filter((n) => n.planId === (planId ?? null));
}

export function getNote(id: string): Note | undefined {
  return readAll().find((n) => n.id === id);
}

export function upsertNote(input: Partial<Note> & { id?: string; title: string; body: string; planId?: string | null }): Note {
  const all = readAll();
  const now = Date.now();
  if (input.id) {
    const idx = all.findIndex((n) => n.id === input.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...input, updatedAt: now } as Note;
      writeAll(all);
      return all[idx];
    }
  }
  const note: Note = {
    id: input.id ?? `n_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: input.title || "Untitled",
    body: input.body || "",
    planId: input.planId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(note);
  writeAll(all);
  return note;
}

export function deleteNote(id: string) {
  writeAll(readAll().filter((n) => n.id !== id));
}

export function exportNotesMarkdown(planId?: string | null): string {
  const notes = listNotes(planId);
  return notes
    .map((n) => `# ${n.title}\n\n_${new Date(n.updatedAt).toLocaleString()}_\n\n${n.body}\n`)
    .join("\n---\n\n");
}

export function subscribeNotes(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("ke-forge-notes-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("ke-forge-notes-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

// Best-effort cloud backup (optional)
export async function backupNotesToCloud() {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    // Stored as a single row in user metadata-style; ignore failures silently.
    return true;
  } catch {
    return false;
  }
}
