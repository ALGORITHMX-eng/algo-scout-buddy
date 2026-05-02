import { useState, useEffect } from "react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ProfileQA, PendingQuestion, loadQAs, saveQA, deleteQA, loadPending, removePending } from "@/lib/algoscout-profile";
import { AlertTriangle, Check, Clock, Edit2, MessageCircleQuestion, Save, Search, Trash2, User, X } from "lucide-react";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function ProfilePage() {
  const [qas, setQas] = useState<ProfileQA[]>([]);
  const [pending, setPending] = useState<PendingQuestion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activePending, setActivePending] = useState<PendingQuestion | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredQas = qas.filter((qa) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return qa.question.toLowerCase().includes(q) || qa.answer.toLowerCase().includes(q);
  });

  useEffect(() => {
    setQas(loadQAs());
    setPending(loadPending());
  }, []);

  // ---- QA editing ----
  const startEdit = (qa: ProfileQA) => {
    setEditingId(qa.id);
    setEditText(qa.answer);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = (qa: ProfileQA) => {
    const updated = { ...qa, answer: editText };
    saveQA(updated);
    setQas(loadQAs());
    setEditingId(null);
    toast.success("Answer updated");
  };

  const handleDelete = (id: string) => {
    deleteQA(id);
    setQas(loadQAs());
    toast("Card removed");
  };

  // ---- Answer Now flow ----
  const openAnswerDrawer = (pq: PendingQuestion) => {
    setActivePending(pq);
    setAnswerText("");
    setDrawerOpen(true);
  };

  const handleSaveToProfile = () => {
    if (!activePending || !answerText.trim()) return;
    const newQA: ProfileQA = {
      id: `qa-${Date.now().toString(36)}`,
      question: activePending.question,
      answer: answerText.trim(),
      createdAt: new Date().toISOString(),
    };
    saveQA(newQA);
    removePending(activePending.id);
    setQas(loadQAs());
    setPending(loadPending());
    setDrawerOpen(false);
    setActivePending(null);
    toast.success("Saved to profile");
  };

  const handleSaveLater = (pq: PendingQuestion) => {
    toast("Saved for later", { description: "You can answer this anytime from the alerts below." });
  };

  const handleDismiss = (pq: PendingQuestion) => {
    removePending(pq.id);
    setPending(loadPending());
    toast("Alert dismissed");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-10">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            <User className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold">Form Memory</h1>
            <p className="text-xs text-muted-foreground">Saved answers auto-fill future applications</p>
          </div>
        </div>

        {/* ---- Search ---- */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved answers…"
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* ---- Pending alerts ---- */}
        {pending.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-500">
              <AlertTriangle className="h-4 w-4" /> Needs Your Help
              <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500 ring-1 ring-amber-500/30">
                {pending.length}
              </span>
            </h2>
            <div className="space-y-2">
              {pending.map((pq) => (
                <div
                  key={pq.id}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">Hey, I need your help!</p>
                      <p className="mt-1 text-sm text-foreground/80">{pq.question}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{pq.source}</p>
                    </div>
                    <button onClick={() => handleDismiss(pq)} className="shrink-0 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      onClick={() => openAnswerDrawer(pq)}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Answer Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-border"
                      onClick={() => handleSaveLater(pq)}
                    >
                      <Clock className="mr-1 h-3.5 w-3.5" /> Save for Later
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- Saved Q&A cards ---- */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Saved Answers</h2>
          {qas.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No saved answers yet. Answer an alert above to get started.
            </div>
          )}
          <div className="space-y-2">
            {qas.map((qa) => (
              <div key={qa.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{qa.question}</p>
                {editingId === qa.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="bg-background text-sm"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={() => handleSaveEdit(qa)}>
                        <Save className="mr-1 h-3.5 w-3.5" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground/90">{qa.answer}</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => startEdit(qa)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
                      >
                        <Edit2 className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(qa.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500/70 hover:text-rose-500 transition"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ---- Answer Now Drawer ---- */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="border-border bg-background">
          <DrawerHeader>
            <DrawerTitle className="font-display text-base">Answer Question</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Question</p>
              <p className="text-sm text-foreground">{activePending?.question}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{activePending?.source}</p>
            </div>
            <Textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Type your answer…"
              className="bg-background text-sm"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSaveToProfile}
                disabled={!answerText.trim()}
              >
                <Save className="mr-1.5 h-4 w-4" /> Save to Profile
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="border-border">Cancel</Button>
              </DrawerClose>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
