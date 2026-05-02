import { useCallback, useEffect, useRef, useState } from "react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { ChatMessage, streamChat } from "@/lib/algoscout-chat";
import { Bot, Mic, MicOff, Send, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export default function InterviewPrepPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speech recognition setup
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognition();
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
      setInput(finalTranscript + interim);
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Voice input error");
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // Text-to-speech for AI responses
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Speech synthesis not supported");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_`]/g, ""));
    utterance.rate = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    if (isListening) stopListening();

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
        // Auto-speak the response
        if (assistantSoFar) speak(assistantSoFar);
      },
      onError: (err) => {
        toast.error(err);
        setIsLoading(false);
      },
    });
  }, [input, isLoading, messages, isListening, stopListening, speak]);

  const stop = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AlgoNavbar />
      <main className="flex flex-1 flex-col mx-auto w-full max-w-2xl px-4">
        <div className="flex-1 space-y-4 py-6 overflow-y-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
                <Mic className="h-7 w-7" />
              </span>
              <h2 className="font-display text-lg font-semibold">Interview Prep</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Practice interviews with AI. Type or use your voice — the AI will speak its responses back to you.
              </p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Try: <span className="text-emerald-600 dark:text-emerald-400">"Prepare me for a React frontend interview"</span></p>
                <p>Or: <span className="text-emerald-600 dark:text-emerald-400">"Ask me behavioral questions for a PM role"</span></p>
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
                  title={isSpeaking ? "Stop speaking" : "Read aloud"}
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
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
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
