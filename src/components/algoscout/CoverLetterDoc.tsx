import * as React from "react";

/**
 * Renders a cover letter as a styled "Word document" — letterhead-style
 * page with serif typography on a paper background. Replaces the PDF iframe.
 */
export const CoverLetterDoc = ({
  body,
  applicantName = "Your Name",
  company,
  role,
  date,
}: {
  body: string;
  applicantName?: string;
  company: string;
  role: string;
  date: string;
}) => {
  // Split body into paragraphs (handle both blank-line and single-newline formats)
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const finalParagraphs = paragraphs.length > 1 ? paragraphs : body.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  const formattedDate = (() => {
    try {
      return new Date(date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return date;
    }
  })();

  return (
    <div className="bg-background p-3">
      <div
        className="mx-auto w-full max-w-[680px] rounded-md shadow-[0_2px_18px_-6px_hsl(var(--foreground)/0.18)] ring-1 ring-border"
        style={{
          background: "hsl(0 0% 99%)",
          color: "hsl(0 0% 12%)",
        }}
      >
        <div className="px-12 py-14" style={{ fontFamily: "'Georgia', 'Cambria', 'Times New Roman', serif" }}>
          {/* Letterhead */}
          <div className="mb-10 border-b border-neutral-300 pb-4">
            <div className="font-semibold tracking-wide" style={{ fontSize: "20px" }}>
              {applicantName}
            </div>
            <div className="mt-1 text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              Application · {role}
            </div>
          </div>

          {/* Date + recipient */}
          <div className="mb-6 text-[14px] leading-relaxed text-neutral-700">
            <div>{formattedDate}</div>
            <div className="mt-4">
              <div className="font-semibold text-neutral-900">Hiring Team</div>
              <div>{company}</div>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-4 text-[15px] leading-[1.75] text-neutral-900">
            {finalParagraphs.map((p, i) => (
              <p key={i} className="text-justify">
                {p}
              </p>
            ))}
          </div>

          {/* Sign-off */}
          <div className="mt-10 text-[15px] leading-relaxed text-neutral-900">
            <div>Sincerely,</div>
            <div className="mt-6 font-semibold" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: "22px" }}>
              {applicantName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
