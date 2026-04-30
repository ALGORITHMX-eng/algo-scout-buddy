import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Image as ImageIcon, Loader2, Sparkles, X, ArrowLeft } from "lucide-react";
import { AlgoNavbar } from "@/components/algoscout/Navbar";
import { addJob } from "@/lib/algoscout-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function AddJob() {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFile = async (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Image is larger than 5MB.");
      return;
    }
    const url = await fileToDataUrl(f);
    setFile(f);
    setPreview(url);
  };

  const clearImage = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) {
      toast.error("Company and Role are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("algoscout-extract-job", {
        body: {
          company: company.trim(),
          role: role.trim(),
          imageDataUrl: preview ?? undefined,
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const ex = (data as any).extracted;
      const newJob = addJob({
        company: company.trim(),
        role: role.trim(),
        score: Math.max(0, Math.min(10, Number(ex.score) || 7)),
        applyUrl: ex.applyUrl || "",
        location: ex.location || "Unknown",
        reason: ex.reason || "Manually added by user.",
        description: ex.description || "",
        resume: ex.resume || "",
        coverLetter: ex.coverLetter || "",
        breakdown: ex.breakdown,
      });

      toast.success("Job added. Opening details…");
      navigate(`/algoscout/job/${newJob.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Could not extract job. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AlgoNavbar />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link
          to="/algoscout"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>

        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Add Job Manually</h1>
          <p className="text-sm text-muted-foreground">
            Drop a screenshot of the posting — AI will extract the rest.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Company name <span className="text-rose-500">*</span>
            </label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              placeholder="e.g. Linear"
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Job title / role <span className="text-rose-500">*</span>
            </label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none ring-offset-background transition focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Screenshot of posting
            </label>

            {!preview ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
                  dragOver
                    ? "border-emerald-500/60 bg-emerald-500/5"
                    : "border-border bg-muted/30 hover:border-foreground/30 hover:bg-muted/50"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
                  <Upload className="h-4 w-4" />
                </span>
                <div className="text-sm font-medium text-foreground">Drop screenshot or tap to upload</div>
                <div className="text-[11px] text-muted-foreground">PNG, JPG · up to 5MB</div>
              </button>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30">
                <img src={preview} alt="Job posting screenshot" className="max-h-80 w-full object-contain" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground ring-1 ring-border backdrop-blur transition hover:bg-background"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span className="truncate">{file?.name}</span>
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Optional, but strongly recommended — AI uses it to extract description, requirements & location.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_-8px_hsl(160_84%_39%/0.7)] transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Extracting with AI…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Add job & extract details
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
