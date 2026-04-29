import * as React from "react";
import { Check, X } from "lucide-react";

/**
 * Wraps a job table row and allows swipe-left (reject) / swipe-right (approve) on touch devices.
 * Falls back to a plain row on desktop (no transform).
 */
export const SwipeableRow = ({
  children,
  onApprove,
  onReject,
}: {
  children: React.ReactNode;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const [dx, setDx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const startX = React.useRef<number | null>(null);
  const THRESHOLD = 80;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const delta = e.touches[0].clientX - startX.current;
    setDx(Math.max(-160, Math.min(160, delta)));
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (dx > THRESHOLD) onApprove();
    else if (dx < -THRESHOLD) onReject();
    setDx(0);
    startX.current = null;
  };

  const showApprove = dx > 16;
  const showReject = dx < -16;

  return (
    <tr className="relative border-t border-border/70 transition-all duration-150 hover:bg-muted/40 hover:shadow-[inset_0_0_0_9999px_hsl(var(--muted)/0.25)]">
      <td colSpan={999} className="p-0">
        <div className="relative overflow-hidden">
          {/* Action backgrounds */}
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 flex items-center gap-2 bg-emerald-500/15 px-4 text-emerald-600 dark:text-emerald-400 transition-opacity ${
              showApprove ? "opacity-100" : "opacity-0"
            }`}
          >
            <Check className="h-4 w-4" /> Approve
          </div>
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 flex items-center gap-2 bg-rose-500/15 px-4 text-rose-600 dark:text-rose-400 transition-opacity ${
              showReject ? "opacity-100" : "opacity-0"
            }`}
          >
            Reject <X className="h-4 w-4" />
          </div>
          <div
            className="bg-card"
            style={{
              transform: `translateX(${dx}px)`,
              transition: dragging ? "none" : "transform 200ms ease",
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <table className="w-full text-sm">
              <tbody>
                <tr>{children}</tr>
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
};
