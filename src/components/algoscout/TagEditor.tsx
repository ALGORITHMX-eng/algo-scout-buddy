import { useState } from "react";
import { Tag, X } from "lucide-react";
import { getTagsForJob, setTagsForJob, SUGGESTED_TAGS } from "@/lib/algoscout-tags";

export function TagEditor({ jobId }: { jobId: string }) {
  const [tags, setTags] = useState<string[]>(() => getTagsForJob(jobId));
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    if (tags.includes(tag)) return;
    const next = [...tags, tag];
    setTags(next);
    setTagsForJob(jobId, next);
  };

  const removeTag = (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    setTagsForJob(jobId, next);
  };

  const available = SUGGESTED_TAGS.filter((t) => !tags.includes(t));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30">
            {t}
            <button onClick={() => removeTag(t)} className="hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition"
        >
          + Add tag
        </button>
      </div>

      {showSuggestions && available.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-background p-2">
          {available.map((t) => (
            <button
              key={t}
              onClick={() => addTag(t)}
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
