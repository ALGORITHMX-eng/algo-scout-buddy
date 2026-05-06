export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function streamChat({
  messages,
  mode = "chat",
  userId,
  jobId,
  interviewType,
  onDelta,
  onDone,
  onError,
  signal,
}: {
  messages: ChatMessage[];
  mode?: "chat" | "interview";
  userId?: string;
  jobId?: string;
  interviewType?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  signal?: AbortSignal;
}) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = mode === "interview"
    ? `${baseUrl}/functions/v1/interview`
    : `${baseUrl}/functions/v1/coach`;

  const body = mode === "interview"
    ? { user_id: userId, job_id: jobId, interview_type: interviewType || "hr", messages }
    : { user_id: userId, messages };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!resp.ok) {
      const b = await resp.json().catch(() => ({}));
      onError(b.error || `Error ${resp.status}`);
      return;
    }

    if (!resp.body) {
      onError("No response body");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
    onDone();
  } catch (e: any) {
    if (e?.name === "AbortError") return;
    onError(e?.message || "Network error");
  }
}
