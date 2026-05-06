import { useCallback, useEffect, useRef, useState } from "react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ChatMessage, streamChat } from "@/lib/algoscout-chat";
import {
  ChatSession, createSession, loadChatSessions, saveChatSessions,
  updateSessionMessages, deleteSession,
} from "@/lib/algoscout-chat-history";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Menu, Plus, Send, Square, Trash2, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function ChatPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loaded = loadChatSessions();
    if (loaded.length === 0) {
      const s = createSession();
      saveChatSessions([s]);
      setSessions([s]);
      setActiveId(s.id);
      setMessages([]);
    } else {
      setSessions(loaded);
      setActiveId(loaded[0].id);
      setMessages(loaded[0].messages);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const switchSession = (id: string) => {
    const s = sessions.find((s) => s.id === id);
    if (s) { setActiveId(id); setMessages(s.messages); setSidebarOpen(false); }
  };

  const startNewChat = () => {
    const s = createSession();
    const updated = [s, ...sessions];
    saveChatSessions(updated);
    setSessions(updated);
    setActiveId(s.id);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSession(id);
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeId === id) {
      if (remaining.length > 0) { setActiveId(remaining[0].id); setMessages(remaining[0].messages); }
      else startNewChat();
    }
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || !activeId || !user) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    updateSessionMessages(activeId, newMessages);
    setSessions(loadChatSessions());
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistantSoFar = "";

    await streamChat({
      messages: newMessages,
      mode: "chat",
      userId: user.id,
      signal: controller.signal,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        const snap = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snap } : m));
          }
          return [...prev, { role: "assistant", content: snap }];
        });
      },
      onDone: () => {
        setIsLoading(false);
        setMessages((prev) => {
          if (activeId) { updateSessionMessages(activeId, prev); setSessions(loadChatSessions()); }
          return prev;
        });
      },
      onError: (err) => { toast.error(err); setIsLoading(false); },
    });
  }, [input, isLoading, messages, activeId, user]);

  const stop = () => { abortRef.current?.abort(); setIsLoading(false); };
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return "Today";
    if (diff < 172800000) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AlgoNavbar />
      <div className="relative flex flex-1 overflow-hidden">
        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => setSidebarOpen(false)} />}
        <aside className={`fixed sm:relative z-50 top-0 left-0 h-full w-72 border-r border-border bg-card flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}`}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-display text-sm font-semibold">Chat History</span>
            <div className="flex items-center gap-1">
              <button onClick={startNewChat} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition" title="New chat"><Plus className="h-4 w-4" /></button>
              <button onClick={() => setSidebarOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition sm:hidden"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 && <div className="px-4 py-8 text-center text-xs text-muted-foreground">No chats yet</div>}
            {sessions.map((s) => (
              <button key={s.id} onClick={() => switchSession(s.id)} className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted ${activeId === s.id ? "bg-emerald-500/10" : ""}`}>
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-foreground">{s.title}</div>
                  <div className="text-[10px] text-muted-foreground">{formatDate(s.updatedAt)}</div>
                </div>
                <button onClick={(e) => handleDelete(s.id, e)} className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-rose-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex flex-1 flex-col w-full max-w-2xl mx-auto px-4">
          <div className="flex items-center gap-3 py-3 sm:hidden">
            <button onClick={() => setSidebarOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground/80 hover:bg-muted transition"><Menu className="h-5 w-5" /></button>
            <button onClick={startNewChat} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground/80 hover:bg-muted transition"><Plus className="h-3.5 w-3.5" /> New chat</button>
          </div>
          <div className="flex-1 space-y-4 py-6 overflow-y-auto">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"><Bot className="h-7 w-7" /></span>
                <h2 className="font-display text-lg font-semibold">AlgoScout AI</h2>
                <p className="max-w-sm text-sm text-muted-foreground">Ask about job search strategy, resume tips, salary negotiation, or anything career-related.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-emerald-600 text-white rounded-br-md" : "bg-card border border-border rounded-bl-md"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                  ) : <p className="whitespace-pre-wrap">{m.content}</p>}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="sticky bottom-0 border-t border-border bg-background pb-4 pt-3">
            <div className="flex items-end gap-2">
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask anything about your job search…" className="min-h-[44px] max-h-32 resize-none bg-card border-border text-sm" rows={1} />
              {isLoading ? (
                <Button size="icon" variant="outline" onClick={stop} className="shrink-0 border-border"><Square className="h-4 w-4" /></Button>
              ) : (
                <Button size="icon" onClick={send} disabled={!input.trim()} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"><Send className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
