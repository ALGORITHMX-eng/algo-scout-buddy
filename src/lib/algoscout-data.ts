export type JobStatus = "Pending" | "Approved" | "Rejected";

export type ScoreBreakdown = {
  skills: number; // 0-10
  salary: number;
  location: number;
  culture: number;
};

export type Job = {
  id: string;
  company: string;
  role: string;
  score: number; // 0-10
  status: JobStatus;
  dateFound: string; // ISO
  applyUrl: string;
  reason: string;
  description: string;
  resume: string;
  coverLetter: string;
  location: string;
  resumePdfUrl?: string;
  coverLetterPdfUrl?: string;
  breakdown?: ScoreBreakdown;
};

// Derive a deterministic breakdown from the overall score so existing seed data
// gets a sensible radar without manual authoring.
export const deriveBreakdown = (job: Job): ScoreBreakdown => {
  if (job.breakdown) return job.breakdown;
  const s = job.score;
  // simple deterministic spread around the score
  const seed = job.id.charCodeAt(job.id.length - 1);
  const j = (n: number) => Math.max(0, Math.min(10, +(s + n).toFixed(1)));
  return {
    skills: j(((seed % 7) - 3) * 0.15 + 0.4),
    salary: j(((seed % 5) - 2) * 0.25 - 0.2),
    location: j(((seed % 9) - 4) * 0.2),
    culture: j(((seed % 11) - 5) * 0.15 + 0.2),
  };
};

// Mock 7-day trend used by dashboard sparklines.
export const getWeeklyTrends = (jobs: Job[]) => {
  const days = 7;
  const today = new Date();
  const buckets: Record<string, { found: number; approved: number; rejected: number; pending: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = { found: 0, approved: 0, rejected: 0, pending: 0 };
  }
  // distribute jobs across days using id hash (stable, no real timestamps needed)
  const keys = Object.keys(buckets);
  jobs.forEach((j, idx) => {
    const k = keys[(j.id.charCodeAt(j.id.length - 1) + idx) % keys.length];
    buckets[k].found += 1;
    if (j.status === "Approved") buckets[k].approved += 1;
    else if (j.status === "Rejected") buckets[k].rejected += 1;
    else buckets[k].pending += 1;
  });
  return keys.map((k) => ({ day: k.slice(5), ...buckets[k] }));
};

export const DEFAULT_RESUME_PDF_URL =
  "https://hulitmnavjhsigknjwpu.supabase.co/storage/v1/object/public/algoscout-docs/sample-resume.pdf";
export const DEFAULT_COVER_LETTER_PDF_URL =
  "https://hulitmnavjhsigknjwpu.supabase.co/storage/v1/object/public/algoscout-docs/sample-cover-letter.pdf";

const seed: Job[] = [
  {
    id: "j-001",
    company: "Linear",
    role: "Senior Frontend Engineer",
    score: 9.4,
    status: "Pending",
    dateFound: "2026-04-26",
    applyUrl: "https://linear.app/careers",
    location: "Remote · EU",
    reason:
      "Strong overlap: React, TypeScript, design-systems experience. Compensation band and remote policy match preferences.",
    description:
      "Linear is hiring a senior frontend engineer to work on the core issue tracker. You will own product surfaces end-to-end, collaborate with design, and ship polished UI in TypeScript and React.",
    resume:
      "• Led migration of marketing site to Next.js, cutting LCP by 38%\n• Built design system used across 14 product surfaces\n• Mentored 4 junior engineers; ran weekly UI reviews\n• Stack: React, TypeScript, Tailwind, GraphQL",
    coverLetter:
      "Hi Linear team — I've followed the product since 2021 and the keyboard-first interaction model is exactly the kind of craft I want to contribute to. My work on design systems and performance would translate directly to your roadmap.",
  },
  {
    id: "j-002",
    company: "Vercel",
    role: "Product Engineer, Dashboard",
    score: 8.7,
    status: "Pending",
    dateFound: "2026-04-26",
    applyUrl: "https://vercel.com/careers",
    location: "Remote · Global",
    reason: "Dashboard / data-viz experience aligns. Slightly heavier on backend than profile.",
    description:
      "Build the dashboard surfaces millions of developers use every day. Strong Next.js, React, and product-thinking required.",
    resume:
      "• Shipped analytics dashboard handling 2M events/day\n• Designed table virtualization layer reused across 6 teams\n• Stack: Next.js, tRPC, PostgreSQL",
    coverLetter:
      "Vercel's DX bar is the reason I picked Next.js four years ago. I'd love to bring my dashboard and data-density experience to the team.",
  },
  {
    id: "j-003",
    company: "Notion",
    role: "Full-Stack Engineer",
    score: 8.1,
    status: "Approved",
    dateFound: "2026-04-25",
    applyUrl: "https://notion.so/careers",
    location: "New York · Hybrid",
    reason: "Good product fit. Hybrid in NYC may require relocation.",
    description: "Work across the Notion stack — collaborative editing, sync engine, and the React frontend.",
    resume: "• 5 years full-stack TypeScript\n• Built realtime collaboration prototype with Yjs",
    coverLetter: "I use Notion daily and would love to contribute to the sync layer.",
  },
  {
    id: "j-004",
    company: "Stripe",
    role: "Engineer, Payments UI",
    score: 7.0,
    status: "Pending",
    dateFound: "2026-04-24",
    applyUrl: "https://stripe.com/jobs",
    location: "Remote · US",
    reason: "Solid skill match but US-only timezone requirement is a concern.",
    description: "Own the checkout and dashboard payment flows used by millions of businesses.",
    resume: "• Frontend at fintech for 3 years\n• PCI-aware UI work",
    coverLetter: "Stripe's docs set the standard. Would love to contribute to the surfaces behind them.",
  },
  {
    id: "j-005",
    company: "Acme Outsourcing",
    role: "Junior Web Developer",
    score: 5.2,
    status: "Rejected",
    dateFound: "2026-04-23",
    applyUrl: "https://example.com/jobs/123",
    location: "Onsite · Remote-unfriendly",
    reason: "Below seniority level. Onsite-only and below-market comp.",
    description: "Maintain WordPress sites and Shopify themes for SMB clients.",
    resume: "—",
    coverLetter: "—",
  },
  {
    id: "j-006",
    company: "Figma",
    role: "Software Engineer, Editor",
    score: 9.1,
    status: "Pending",
    dateFound: "2026-04-22",
    applyUrl: "https://figma.com/careers",
    location: "Remote · Americas/EU",
    reason: "Canvas / WebGL experience is rare and matches profile. Strong comp band.",
    description: "Work on the rendering and interaction layer of the Figma editor.",
    resume: "• Built 2D canvas editor used by 40k weekly users\n• WebGL & WASM experience",
    coverLetter: "The Figma editor is the most impressive piece of web software I've used. I'd love to contribute.",
  },
  {
    id: "j-007",
    company: "Supabase",
    role: "Developer Experience Engineer",
    score: 8.4,
    status: "Approved",
    dateFound: "2026-04-21",
    applyUrl: "https://supabase.com/careers",
    location: "Remote · Global",
    reason: "Open source and DX background match well.",
    description: "Improve docs, examples, and onboarding for the Supabase platform.",
    resume: "• Maintainer of two OSS libraries (3k+ stars combined)",
    coverLetter: "I've shipped 4 production apps on Supabase and would love to make the path smoother for others.",
  },
  {
    id: "j-008",
    company: "Generic Agency",
    role: "Frontend Contractor",
    score: 6.4,
    status: "Rejected",
    dateFound: "2026-04-20",
    applyUrl: "https://example.com/contract",
    location: "Remote",
    reason: "Short-term contract, low rate, no growth path.",
    description: "Build marketing pages for various clients.",
    resume: "—",
    coverLetter: "—",
  },
];

const KEY = "algoscout:jobs:v1";
const READ_KEY = "algoscout:read-notifs:v1";

export const loadJobs = (): Job[] => {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as Job[];
  } catch {
    return seed;
  }
};

export const saveJobs = (jobs: Job[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs));
  } catch {}
};

export const updateJobStatus = (id: string, status: JobStatus): Job[] => {
  const jobs = loadJobs().map((j) => (j.id === id ? { ...j, status } : j));
  saveJobs(jobs);
  return jobs;
};

export const addJob = (job: Omit<Job, "id" | "dateFound" | "status"> & Partial<Pick<Job, "status">>): Job => {
  const jobs = loadJobs();
  const newJob: Job = {
    id: `j-${Date.now().toString(36)}`,
    dateFound: new Date().toISOString().slice(0, 10),
    status: job.status ?? "Pending",
    ...job,
  } as Job;
  saveJobs([newJob, ...jobs]);
  return newJob;
};

export const getReadNotifIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) || "[]");
  } catch {
    return [];
  }
};

export const markNotifsRead = (ids: string[]) => {
  try {
    const set = new Set([...getReadNotifIds(), ...ids]);
    localStorage.setItem(READ_KEY, JSON.stringify([...set]));
  } catch {}
};

export const scoreColor = (s: number): "green" | "yellow" | "red" => {
  if (s >= 8) return "green";
  if (s >= 7) return "yellow";
  return "red";
};
