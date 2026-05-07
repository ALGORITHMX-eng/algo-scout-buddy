import { useCallback, useEffect, useRef, useState } from "react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ChatMessage, streamChat } from "@/lib/algoscout-chat";
import { saveInterviewSession } from "@/lib/algoscout-chat-history";
import { InterviewFeedback, InterviewFeedbackData } from "@/components/algoscout/InterviewFeedback";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Mic, MicOff, Send, Square, Volume2, MessageSquareText, Radio, Clock, X, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type InterviewMode = "select" | "text" | "live" | "feedback";
type TimerDuration = 5 | 10 | 15 | 20 | 30 | 45 | 60;
const TIMER_OPTIONS: TimerDuration[] = [5, 10, 15, 20, 30, 45, 60];

export default function InterviewPrepPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<InterviewMode>("select");
  const [timerMinutes, setTimerMinutes] = useState<TimerDuration>(15);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [liveTranscript, setLiveTranscript] = useState("");

  const [feedbackData, setFeedbackData] = useState<InterviewFeedbackData | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [jobId] = useState<string | undefined>(undefined);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const startTimer = useCallback(() => {
    setTimerSeconds(timerMinutes * 60);
    setTimerRunning(true);
  }, [timerMinutes]);

  useEffect(() => {
    if (!timerRunning) return;
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) { setTimerRunning(false); toast.info("⏰ Interview time is up!"); if (mode === "live") { stopListening(); window.speechSynthesis.cancel(); } return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, mode]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported"); return; }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let finalTranscript = "";
    recognition.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      if (mode === "live") setLiveTranscript(finalTranscript + interim);
      else setInput(finalTranscript + interim);
    };
    recognition.onerror = () => { setIsListening(false); toast.error("Voice input error"); };
    recognition.onend = () => {
      setIsListening(false);
      if (mode === "live" && finalTranscript.trim()) { sendMessage(finalTranscript.trim()); setLiveTranscript(""); }
    };
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [mode]);

  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setIsListening(false); }, []);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) { toast.error("Speech synthesis not supported"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_`]/g, ""));
    utterance.rate = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => { setIsSpeaking(false); if (mode === "live" && timerRunning) startListening(); };
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [mode, timerRunning, startListening]);

  const stopSpeaking = useCallback(() => { window.speechSynthesis.cancel(); setIsSpeaking(false); }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text || isLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let assistantSoFar = "";
    const allMessages = [...messages, userMsg];

    await streamChat({
      messages: allMessages,
      mode: "interview",
      userId: user?.id,
      jobId,
      interviewType: "hr",
      signal: controller.signal,
      onDelta: (chunk) => {
        assistantSoFar += chunk;
        const snap = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snap } : m));
          return [...prev, { role: "assistant", content: snap }];
        });
      },
      onDone: () => { setIsLoading(false); if (assistantSoFar && mode === "live") speak(assistantSoFar); },
      onError: (err) => { toast.error(err); setIsLoading(false); },
    });
  }, [isLoading, messages, mode, speak, user, jobId]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (isListening) stopListening();
    sendMessage(text);
  }, [input, isListening, stopListening, sendMessage]);

  const stop = () => { abortRef.current?.abort(); setIsLoading(false); };
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const startSession = (selectedMode: "text" | "live") => {
    setMode(selectedMode);
    setMessages([]);
    setFeedbackData(null);
    startTimer();
    if (selectedMode === "live") setTimeout(() => startListening(), 500);
  };

  const endSession = async () => {
    const currentMode = mode as "text" | "live";
    const elapsed = timerMinutes * 60 - timerSeconds;

    if (messages.length > 0) {
      saveInterviewSession({ id: crypto.randomUUID(), mode: currentMode, messages, duration: elapsed, createdAt: new Date().toISOString() });
    }
    setTimerRunning(false); setIsListening(false); setIsSpeaking(false);
    recognitionRef.current?.stop(); window.speechSynthesis.cancel();

    // Call interview edge function for feedback
    if (messages.length > 1) {
      setFeedbackLoading(true);
      setMode("feedback");
      try {
        const { data, error } = await supabase.functions.invoke("interview", {
          body: {
            user_id: user?.id,
            job_id: jobId,
            interview_type: "hr",
            messages,
            get_feedback: true,
          },
        });
        if (error) throw error;
        if (data?.feedback) {
          setFeedbackData(data.feedback);
        } else if (data?.overall_score !== undefined) {
          setFeedbackData(data as InterviewFeedbackData);
        } else {
          toast.info("No feedback available for this session");
          setMode("select");
        }
      } catch (err: any) {
        console.error("Feedback error:", err);
        toast.error("Could not get interview feedback");
        setMode("select");
      } finally {
        setFeedbackLoading(false);
      }
    } else {
      setMode("select");
    }
    setMessages([]); setLiveTranscript(""); setInput("");
  };

  // Feedback view
  if (mode === "feedback") {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <AlgoNavbar />
        {feedbackLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <p className="text-sm font-medium text-foreground">Analyzing your interview performance…</p>
          </div>
        ) : feedbackData ? (
          <InterviewFeedback feedback={feedbackData} onClose={() => { setFeedbackData(null); setMode("select"); }} />
        ) : null}
      </div>
    );
  }

  if (mode === "select") {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <AlgoNavbar />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 mb-5"><Mic className="h-8 w-8 text-emerald-500" /></div>
          <h1 className="font-display text-2xl font-semibold mb-2">Interview Prep</h1>
          <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">Practice with AI. Choose your mode and set your timer.</p>
          <div className="mb-8 w-full max-w-xs">
            <div className="flex items-center gap-2 mb-3 justify-center"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Session Duration</span></div>
            <div className="flex flex-wrap justify-center gap-2">
              {TIMER_OPTIONS.map((t) => (
                <button key={t} onClick={() => setTimerMinutes(t)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${timerMinutes === t ? "bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40" : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"}`}>{t} min</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
            <button onClick={() => startSession("live")} className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 group-hover:ring-emerald-500/50 transition"><Radio className="h-6 w-6 text-emerald-500" /></div>
              <span className="font-display text-base font-semibold">Live Voice</span>
              <span className="text-xs text-muted-foreground text-center">Speak naturally — AI listens and responds with voice</span>
            </button>
            <button onClick={() => startSession("text")} className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:shadow-lg">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 group-hover:ring-emerald-500/50 transition"><MessageSquareText className="h-6 w-6 text-emerald-500" /></div>
              <span className="font-display text-base font-semibold">Text Chat</span>
              <span className="text-xs text-muted-foreground text-center">Type your answers — classic chat interview</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (mode === "live") {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 py-3">
          <div className="flex items-center gap-3"><div className={`h-2.5 w-2.5 rounded-full ${timerRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} /><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live Interview</span></div>
          <div className="flex items-center gap-3">
            <span className={`font-mono text-sm font-semibold ${timerSeconds <= 60 ? "text-rose-500" : "text-foreground"}`}>{formatTime(timerSeconds)}</span>
            <button onClick={endSession} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/30 hover:bg-rose-500/25 transition"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <main className="flex flex-1 flex-col items-center justify-center px-4 relative">
          <div className="relative mb-8">
            <div className={`h-40 w-40 rounded-full transition-all duration-700 ${isSpeaking ? "bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 shadow-[0_0_80px_30px_rgba(16,185,129,0.15)] scale-110" : isListening ? "bg-gradient-to-br from-emerald-500/20 to-emerald-400/5 shadow-[0_0_60px_20px_rgba(16,185,129,0.1)] scale-100" : "bg-gradient-to-br from-muted/40 to-muted/10 scale-95"}`}>
              <div className={`absolute inset-0 rounded-full transition-all duration-500 ${isSpeaking ? "animate-ping opacity-20 bg-emerald-500" : isListening ? "animate-pulse opacity-10 bg-emerald-400" : ""}`} />
              <div className="absolute inset-0 flex items-center justify-center">
                {isSpeaking ? <Volume2 className="h-12 w-12 text-emerald-500 animate-pulse" /> : isListening ? <Mic className="h-12 w-12 text-emerald-500" /> : <Mic className="h-12 w-12 text-muted-foreground" />}
              </div>
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-2">{isSpeaking ? "AI is speaking…" : isListening ? "Listening…" : isLoading ? "Thinking…" : "Tap the mic to speak"}</p>
          {liveTranscript && <div className="max-w-sm rounded-xl bg-card border border-border px-4 py-3 text-sm text-foreground/80 mb-4 text-center">{liveTranscript}</div>}
          {messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
            <div className="max-w-sm rounded-xl bg-card border border-border px-4 py-3 text-sm text-muted-foreground max-h-32 overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1"><ReactMarkdown>{messages[messages.length - 1].content}</ReactMarkdown></div>
            </div>
          )}
          <div className="absolute bottom-8 flex items-center gap-4">
            <button onClick={isListening ? stopListening : startListening} disabled={isSpeaking || isLoading} className={`flex h-16 w-16 items-center justify-center rounded-full transition-all ${isListening ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-110" : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"} disabled:opacity-40`}>
              {isListening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </button>
            {isSpeaking && <button onClick={stopSpeaking} className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition"><Square className="h-5 w-5" /></button>}
            <button onClick={() => setMode("text")} className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition" title="Switch to text mode"><MessageSquareText className="h-5 w-5" /></button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("live")} className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 transition"><Radio className="h-3 w-3" /> Switch to Live</button>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-sm font-semibold ${timerSeconds <= 60 ? "text-rose-500" : "text-foreground"}`}>{formatTime(timerSeconds)}</span>
          <button onClick={endSession} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/30 hover:bg-rose-500/25 transition"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <main className="flex flex-1 flex-col mx-auto w-full max-w-2xl px-3 sm:px-4">
        <div className="flex-1 space-y-4 py-6 overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30"><MessageSquareText className="h-7 w-7" /></span>
              <h2 className="font-display text-lg font-semibold">Text Interview</h2>
              <p className="max-w-sm text-sm text-muted-foreground">Type your answers. The AI interviewer will respond in real time.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-emerald-600 text-white rounded-br-md" : "bg-card border border-border rounded-bl-md"}`}>
                {m.role === "assistant" ? <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"><ReactMarkdown>{m.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3"><div className="flex gap-1"><span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:0ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms]" /></div></div></div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="sticky bottom-0 border-t border-border bg-background pb-4 pt-3">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Type your answer…" className="min-h-[44px] max-h-32 resize-none bg-card border-border text-sm pr-10" rows={1} />
              <button onClick={isListening ? stopListening : startListening} className={`absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-full transition ${isListening ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
            </div>
            {isLoading ? <Button size="icon" variant="outline" onClick={stop} className="shrink-0 border-border"><Square className="h-4 w-4" /></Button> : <Button size="icon" onClick={send} disabled={!input.trim()} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"><Send className="h-4 w-4" /></Button>}
          </div>
        </div>
      </main>
    </div>
  );
}
