import { useState } from "react";
import { Plus, StickyNote, Trash2, X } from "lucide-react";
import { JobNote, loadNotes, addNote, deleteNote } from "@/lib/algoscout-notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NotesPanel({ jobId }: { jobId: string }) {
  const [notes, setNotes] = useState<JobNote[]>(() => loadNotes(jobId));
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (!text.trim()) return;
    addNote(jobId, text.trim());
    setNotes(loadNotes(jobId));
    setText("");
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteNote(id);
    setNotes(loadNotes(jobId));
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <StickyNote className="h-3.5 w-3.5" /> Notes & Activity
        </h2>
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add note
        </button>
      </div>

      {open && (
        <div className="mb-3 space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Recruiter said 2-week timeline…"
            className="bg-background text-sm"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={handleAdd} disabled={!text.trim()}>
              Save note
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setOpen(false); setText(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 && !open && (
        <p className="text-sm text-muted-foreground">No notes yet. Tap "Add note" to start tracking.</p>
      )}

      <div className="space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="group flex items-start gap-2 rounded-lg border border-border/50 bg-background p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{n.text}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.createdAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
            <button
              onClick={() => handleDelete(n.id)}
              className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-rose-500 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
