import { useCallback, useEffect, useRef, useState } from "react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ChatMessage, streamChat } from "@/lib/algoscout-chat";
import { saveInterviewSession } from "@/lib/algoscout-chat-history";
import { Bot, Mic, MicOff, Send, Square, Volume2, MessageSquareText, Radio, Clock, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type InterviewMode = "select" | "text" | "live";
type TimerDuration = 5 | 10 | 15 | 20 | 30 | 45 | 60;
const TIMER_OPTIONS: TimerDuration[] = [5, 10, 15, 20, 30, 45, 60];

export default function InterviewPrepPage() {
  const [mode, setMode] = useState<InterviewMode>("select");
  const [timerMinutes, setTimerMinutes] = useState<TimerDuration>(15);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [liveTranscript, setLiveTranscript] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Timer logic
  const startTimer = useCallback(() => {
    setTimerSeconds(timerMinutes * 60);
    setTimerRunning(true);
  }, [timerMinutes]);

  useEffect(() => {
    if (!timerRunning) return;
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          toast.info("⏰ Interview time is up!");
          if (mode === "live") {
            stopListening();
            window.speechSynthesis.cancel();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, mode]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Speech recognition
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
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript + " ";
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      if (mode === "live") {
        setLiveTranscript(finalTranscript + interim);
      } else {
        setInput(finalTranscript + interim);
      }
    };
    recognition.onerror = () => { setIsListening(false); toast.error("Voice input error"); };
    recognition.onend = () => {
      setIsListening(false);
      if (mode === "live" && finalTranscript.trim()) {
        sendMessage(finalTranscript.trim());
        setLiveTranscript("");
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [mode]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // TTS
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) { toast.error("Speech synthesis not supported"); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_`]/g, ""));
    utterance.rate = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // In live mode, auto-resume listening after AI speaks
      if (mode === "live" && timerRunning) {
        startListening();
      }
    };
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [mode, timerRunning, startListening]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Send message (shared between text & live)
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
        if (assistantSoFar && mode === "live") speak(assistantSoFar);
      },
      onError: (err) => { toast.error(err); setIsLoading(false); },
    });
  }, [isLoading, messages, mode, speak]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (isListening) stopListening();
    sendMessage(text);
  }, [input, isListening, stopListening, sendMessage]);

  const stop = () => { abortRef.current?.abort(); setIsLoading(false); };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const startSession = (selectedMode: "text" | "live") => {
    setMode(selectedMode);
    setMessages([]);
    startTimer();
    if (selectedMode === "live") {
      setTimeout(() => startListening(), 500);
    }
  };

  const endSession = () => {
    setTimerRunning(false);
    setIsListening(false);
    setIsSpeaking(false);
    recognitionRef.current?.stop();
    window.speechSynthesis.cancel();
    setMode("select");
    setMessages([]);
    setLiveTranscript("");
    setInput("");
  };

  // ─── MODE SELECT SCREEN ───
  if (mode === "select") {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <AlgoNavbar />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 mb-5">
            <Mic className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="font-display text-2xl font-semibold mb-2">Interview Prep</h1>
          <p className="text-sm text-muted-foreground mb-8 text-center max-w-sm">
            Practice with AI. Choose your mode and set your timer.
          </p>

          {/* Timer selector */}
          <div className="mb-8 w-full max-w-xs">
            <div className="flex items-center gap-2 mb-3 justify-center">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Session Duration</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {TIMER_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTimerMinutes(t)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    timerMinutes === t
                      ? "bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {t} min
                </button>
              ))}
            </div>
          </div>

          {/* Mode cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
            <button
              onClick={() => startSession("live")}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:shadow-lg"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 group-hover:ring-emerald-500/50 transition">
                <Radio className="h-6 w-6 text-emerald-500" />
              </div>
              <span className="font-display text-base font-semibold">Live Voice</span>
              <span className="text-xs text-muted-foreground text-center">
                Speak naturally — AI listens and responds with voice
              </span>
            </button>

            <button
              onClick={() => startSession("text")}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:shadow-lg"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30 group-hover:ring-emerald-500/50 transition">
                <MessageSquareText className="h-6 w-6 text-emerald-500" />
              </div>
              <span className="font-display text-base font-semibold">Text Chat</span>
              <span className="text-xs text-muted-foreground text-center">
                Type your answers — classic chat interview
              </span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── LIVE VOICE MODE ───
  if (mode === "live") {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {/* Minimal top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${timerRunning ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live Interview</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-mono text-sm font-semibold ${timerSeconds <= 60 ? "text-rose-500" : "text-foreground"}`}>
              {formatTime(timerSeconds)}
            </span>
            <button
              onClick={endSession}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/30 hover:bg-rose-500/25 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Immersive voice UI */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 relative">
          {/* Animated orb */}
          <div className="relative mb-8">
            <div className={`h-40 w-40 rounded-full transition-all duration-700 ${
              isSpeaking
                ? "bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 shadow-[0_0_80px_30px_rgba(16,185,129,0.15)] scale-110"
                : isListening
                  ? "bg-gradient-to-br from-emerald-500/20 to-emerald-400/5 shadow-[0_0_60px_20px_rgba(16,185,129,0.1)] scale-100"
                  : "bg-gradient-to-br from-muted/40 to-muted/10 scale-95"
            }`}>
              <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
                isSpeaking ? "animate-ping opacity-20 bg-emerald-500" : isListening ? "animate-pulse opacity-10 bg-emerald-400" : ""
              }`} />
              <div className="absolute inset-0 flex items-center justify-center">
                {isSpeaking ? (
                  <Volume2 className="h-12 w-12 text-emerald-500 animate-pulse" />
                ) : isListening ? (
                  <Mic className="h-12 w-12 text-emerald-500" />
                ) : (
                  <Mic className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>

          {/* Status text */}
          <p className="text-sm font-medium text-muted-foreground mb-2">
            {isSpeaking ? "AI is speaking…" : isListening ? "Listening…" : isLoading ? "Thinking…" : "Tap the mic to speak"}
          </p>

          {/* Live transcript */}
          {liveTranscript && (
            <div className="max-w-sm rounded-xl bg-card border border-border px-4 py-3 text-sm text-foreground/80 mb-4 text-center">
              {liveTranscript}
            </div>
          )}

          {/* Last AI response preview */}
          {messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
            <div className="max-w-sm rounded-xl bg-card border border-border px-4 py-3 text-sm text-muted-foreground max-h-32 overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                <ReactMarkdown>{messages[messages.length - 1].content}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div className="absolute bottom-8 flex items-center gap-4">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isSpeaking || isLoading}
              className={`flex h-16 w-16 items-center justify-center rounded-full transition-all ${
                isListening
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-110"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              } disabled:opacity-40`}
            >
              {isListening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </button>
            {isSpeaking && (
              <button
                onClick={stopSpeaking}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition"
              >
                <Square className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => { setMode("text"); }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground transition"
              title="Switch to text mode"
            >
              <MessageSquareText className="h-5 w-5" />
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── TEXT CHAT MODE ───
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar with timer */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode("live")}
            className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 transition"
          >
            <Radio className="h-3 w-3" /> Switch to Live
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-mono text-sm font-semibold ${timerSeconds <= 60 ? "text-rose-500" : "text-foreground"}`}>
            {formatTime(timerSeconds)}
          </span>
          <button
            onClick={endSession}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/30 hover:bg-rose-500/25 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <main className="flex flex-1 flex-col mx-auto w-full max-w-2xl px-3 sm:px-4">
        <div className="flex-1 space-y-4 py-6 overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30">
                <MessageSquareText className="h-7 w-7" />
              </span>
              <h2 className="font-display text-lg font-semibold">Text Interview</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Type your answers. Ask the AI to start with a specific role or topic.
              </p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Try: <span className="text-emerald-500">"Start a React frontend interview"</span></p>
                <p>Or: <span className="text-emerald-500">"Ask me behavioral questions for a PM role"</span></p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white rounded-br-md"
                    : "bg-card border border-border rounded-bl-md"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
              {m.role === "assistant" && !isLoading && (
                <button
                  onClick={() => (isSpeaking ? stopSpeaking() : speak(m.content))}
                  className="mt-1 shrink-0 text-muted-foreground hover:text-emerald-500 transition"
                >
                  <Volume2 className={`h-4 w-4 ${isSpeaking ? "text-emerald-500 animate-pulse" : ""}`} />
                </button>
              )}
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

        {/* Input */}
        <div className="sticky bottom-0 border-t border-border bg-background pb-4 pt-3">
          {isListening && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Listening… speak now
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={isListening ? stopListening : startListening}
              className={`shrink-0 border-border ${isListening ? "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/30" : ""}`}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type or tap the mic to speak…"
              className="min-h-[44px] max-h-32 resize-none bg-card border-border text-sm"
              rows={1}
            />
            {isLoading ? (
              <Button size="icon" variant="outline" onClick={stop} className="shrink-0 border-border">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={send}
                disabled={!input.trim()}
                className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
