import { ChatMessage } from "./algoscout-chat";

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

const CHAT_HISTORY_KEY = "algoscout:chat-history:v1";

export function loadChatSessions(): ChatSession[] {
  try {
    return JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveChatSessions(sessions: ChatSession[]) {
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sessions));
}

export function createSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function updateSessionMessages(sessionId: string, messages: ChatMessage[]) {
  const sessions = loadChatSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return;
  sessions[idx].messages = messages;
  sessions[idx].updatedAt = new Date().toISOString();
  // Auto-title from first user message
  if (sessions[idx].title === "New chat" && messages.length > 0) {
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      sessions[idx].title = firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? "…" : "");
    }
  }
  saveChatSessions(sessions);
}

export function deleteSession(sessionId: string) {
  const sessions = loadChatSessions().filter((s) => s.id !== sessionId);
  saveChatSessions(sessions);
}

// Interview history
export type InterviewSession = {
  id: string;
  mode: "text" | "live";
  messages: ChatMessage[];
  duration: number; // seconds used
  createdAt: string;
};

const INTERVIEW_HISTORY_KEY = "algoscout:interview-history:v1";

export function loadInterviewSessions(): InterviewSession[] {
  try {
    return JSON.parse(localStorage.getItem(INTERVIEW_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveInterviewSession(session: InterviewSession) {
  const sessions = loadInterviewSessions();
  sessions.unshift(session);
  // Keep last 20
  localStorage.setItem(INTERVIEW_HISTORY_KEY, JSON.stringify(sessions.slice(0, 20)));
}

export function deleteInterviewSession(sessionId: string) {
  const sessions = loadInterviewSessions().filter((s) => s.id !== sessionId);
  localStorage.setItem(INTERVIEW_HISTORY_KEY, JSON.stringify(sessions));
}
