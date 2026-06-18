import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Download, Search, StickyNote } from "lucide-react";
import { listNotes, upsertNote, deleteNote, subscribeNotes, exportNotesMarkdown, type Note } from "@/lib/notes";
import { toast } from "sonner";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Notes — KE-FORGE LEARN" }, { name: "description", content: "Your private study notes. Works offline." }] }),
  component: NotesPage,
});

function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const refresh = () => setNotes(listNotes());
    refresh();
    return subscribeNotes(refresh);
  }, []);

  useEffect(() => {
    if (!activeId && notes[0]) setActiveId(notes[0].id);
  }, [notes, activeId]);

  const active = useMemo(() => notes.find((n) => n.id === activeId) ?? null, [notes, activeId]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(s) || n.body.toLowerCase().includes(s));
  }, [notes, q]);

  const create = () => {
    const n = upsertNote({ title: "Untitled note", body: "" });
    setActiveId(n.id);
  };

  const onChangeTitle = (v: string) => {
    if (!active) return;
    upsertNote({ ...active, title: v });
  };
  const onChangeBody = (v: string) => {
    if (!active) return;
    upsertNote({ ...active, body: v });
  };

  const onDelete = () => {
    if (!active) return;
    deleteNote(active.id);
    setActiveId(null);
    toast.success("Note deleted");
  };

  const onExport = () => {
    const md = exportNotesMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ke-forge-notes-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><StickyNote className="w-5 h-5" /> Notes</h1>
          <p className="text-sm text-muted-foreground">Saved to this device. Works offline.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport} disabled={notes.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Button size="sm" onClick={create}><Plus className="w-4 h-4 mr-1" /> New</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <Card className="p-2 h-[70vh] flex flex-col">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="pl-8" />
          </div>
          <div className="overflow-auto flex-1 space-y-1">
            {filtered.length === 0 && <p className="text-xs text-muted-foreground p-2">No notes yet.</p>}
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => setActiveId(n.id)}
                className={`w-full text-left p-2 rounded-md hover:bg-accent ${activeId === n.id ? "bg-accent" : ""}`}
              >
                <div className="text-sm font-medium truncate">{n.title || "Untitled"}</div>
                <div className="text-xs text-muted-foreground truncate">{n.body.slice(0, 60) || "Empty"}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-3 h-[70vh] flex flex-col">
          {active ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Input value={active.title} onChange={(e) => onChangeTitle(e.target.value)} placeholder="Title" className="font-medium" />
                <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                value={active.body}
                onChange={(e) => onChangeBody(e.target.value)}
                placeholder="Start typing..."
                className="flex-1 resize-none"
              />
              <div className="text-xs text-muted-foreground mt-2">Auto-saved · {new Date(active.updatedAt).toLocaleString()}</div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
              Select a note or create a new one.
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
