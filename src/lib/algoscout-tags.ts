const TAG_KEY = "algoscout:tags:v1";

export const loadJobTags = (): Record<string, string[]> => {
  try {
    return JSON.parse(localStorage.getItem(TAG_KEY) || "{}");
  } catch {
    return {};
  }
};

export const getTagsForJob = (jobId: string): string[] => {
  return loadJobTags()[jobId] || [];
};

export const setTagsForJob = (jobId: string, tags: string[]) => {
  const all = loadJobTags();
  all[jobId] = tags;
  localStorage.setItem(TAG_KEY, JSON.stringify(all));
};

export const getAllUniqueTags = (): string[] => {
  const all = loadJobTags();
  const set = new Set<string>();
  Object.values(all).forEach((tags) => tags.forEach((t) => set.add(t)));
  return [...set].sort();
};

export const SUGGESTED_TAGS = [
  "Frontend", "Backend", "Full-Stack", "Remote", "Hybrid", "Onsite",
  "React", "TypeScript", "Python", "AI/ML", "Startup", "Enterprise",
  "Fintech", "DevTools", "High Priority", "Dream Job",
];
