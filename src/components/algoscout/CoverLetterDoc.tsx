import { useState } from "react";
import { Copy, Check } from "lucide-react";

export const CoverLetterDoc = ({
  body,
  company,
}: {
  body: string;
  company: string;
  // kept for backwards compat but no longer used to wrap
  applicantName?: string;
  role?: string;
  date?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Cover Letter</span>
          <span className="text-[10px] text-muted-foreground">— click to select all, or copy</span>
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
        >
          {copied
            ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!</>
            : <><Copy className="h-3.5 w-3.5" /> Copy all</>
          }
        </button>
      </div>
      <textarea
        readOnly
        value={body}
        rows={Math.max(14, body.split("\n").length + 2)}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        className="w-full resize-none bg-background px-5 py-4 text-sm text-foreground leading-relaxed font-mono focus:outline-none"
      />
    </div>
  );
};