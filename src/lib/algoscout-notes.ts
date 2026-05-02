export type JobNote = {
  id: string;
  jobId: string;
  text: string;
  createdAt: string;
};

const KEY = "algoscout:notes:v1";

export const loadNotes = (jobId: string): JobNote[] => {
  try {
    const all: JobNote[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    return all.filter((n) => n.jobId === jobId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
};

export const addNote = (jobId: string, text: string): JobNote => {
  const all: JobNote[] = JSON.parse(localStorage.getItem(KEY) || "[]");
  const note: JobNote = {
    id: `note-${Date.now().toString(36)}`,
    jobId,
    text,
    createdAt: new Date().toISOString(),
  };
  all.unshift(note);
  localStorage.setItem(KEY, JSON.stringify(all));
  return note;
};

export const deleteNote = (id: string) => {
  const all: JobNote[] = JSON.parse(localStorage.getItem(KEY) || "[]");
  localStorage.setItem(KEY, JSON.stringify(all.filter((n) => n.id !== id)));
};
