export type ProfileQA = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
};

export type PendingQuestion = {
  id: string;
  question: string;
  source: string; // e.g. "LinkedIn Application"
  createdAt: string;
};

const QA_KEY = "algoscout:profile-qa:v1";
const PENDING_KEY = "algoscout:profile-pending:v1";

// ---- QA persistence ----
export const loadQAs = (): ProfileQA[] => {
  try {
    return JSON.parse(localStorage.getItem(QA_KEY) || "[]");
  } catch {
    return [];
  }
};

export const saveQA = (qa: ProfileQA) => {
  const all = loadQAs();
  const idx = all.findIndex((q) => q.id === qa.id);
  if (idx >= 0) all[idx] = qa;
  else all.unshift(qa);
  localStorage.setItem(QA_KEY, JSON.stringify(all));
};

export const deleteQA = (id: string) => {
  localStorage.setItem(QA_KEY, JSON.stringify(loadQAs().filter((q) => q.id !== id)));
};

// ---- Pending questions (simulated Skyvern alerts) ----
export const loadPending = (): PendingQuestion[] => {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) {
      // seed a couple of demo alerts
      const demo: PendingQuestion[] = [
        {
          id: "pq-1",
          question: "Are you authorized to work in the United States?",
          source: "LinkedIn · Stripe Application",
          createdAt: new Date().toISOString(),
        },
        {
          id: "pq-2",
          question: "What is your expected salary range?",
          source: "Greenhouse · Figma Application",
          createdAt: new Date().toISOString(),
        },
        {
          id: "pq-3",
          question: "Do you have experience with WebGL or Canvas APIs?",
          source: "Lever · Notion Application",
          createdAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(PENDING_KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const removePending = (id: string) => {
  localStorage.setItem(PENDING_KEY, JSON.stringify(loadPending().filter((q) => q.id !== id)));
};

export const saveLater = (id: string) => {
  // no-op — it stays in the list, we just dismiss the alert visually
};
