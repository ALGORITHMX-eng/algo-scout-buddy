export type TimelineStage = "Found" | "Approved" | "Applied" | "Responded" | "Rejected";

export type TimelineData = Partial<Record<TimelineStage, string>>; // ISO timestamps

const KEY = "algoscout:timeline:v1";

type AllTimelines = Record<string, TimelineData>;

const readAll = (): AllTimelines => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as AllTimelines;
  } catch {
    return {};
  }
};

const writeAll = (data: AllTimelines) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
};

export const loadTimeline = (jobId: string, dateFound?: string): TimelineData => {
  const all = readAll();
  const existing = all[jobId] || {};
  if (!existing.Found && dateFound) {
    existing.Found = new Date(dateFound).toISOString();
    all[jobId] = existing;
    writeAll(all);
  }
  return existing;
};

export const setStage = (jobId: string, stage: TimelineStage, when: string = new Date().toISOString()) => {
  const all = readAll();
  const existing = all[jobId] || {};
  existing[stage] = when;
  all[jobId] = existing;
  writeAll(all);
  return existing;
};

export const clearStage = (jobId: string, stage: TimelineStage) => {
  const all = readAll();
  const existing = all[jobId] || {};
  delete existing[stage];
  all[jobId] = existing;
  writeAll(all);
  return existing;
};

export const STAGE_ORDER: TimelineStage[] = ["Found", "Approved", "Applied", "Responded", "Rejected"];
