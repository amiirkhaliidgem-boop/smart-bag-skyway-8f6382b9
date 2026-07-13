import { Check, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LF_STATUSES, LF_STATUS_ORDER, type LFStatus } from "@/lib/lost-found/statuses";

// Enterprise workflow stepper. Reads canonical LF_STATUSES from
// src/lib/lost-found/statuses.ts. Completed = check, current = filled,
// future = disabled. `onSelect` optional; when omitted the stepper is
// display-only.
export function LfStatusStepper({
  current,
  onSelect,
  className,
}: {
  current: LFStatus;
  onSelect?: (s: LFStatus) => void;
  className?: string;
}) {
  const currentIndex = LF_STATUS_ORDER[current];
  return (
    <div
      className={cn(
        "flex flex-wrap items-stretch gap-y-2 gap-x-0 text-xs",
        className,
      )}
    >
      {LF_STATUSES.map((s, i) => {
        const done = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;
        const clickable = !!onSelect && (isFuture || done);
        return (
          <div key={s} className="flex items-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect?.(s)}
              className={cn(
                "group flex items-center gap-1.5 rounded-md px-2 py-1.5 border transition-colors",
                isCurrent && "bg-primary text-primary-foreground border-primary font-semibold shadow-sm",
                done && "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
                isFuture && "bg-muted/40 text-muted-foreground border-transparent",
                clickable && "cursor-pointer",
                !clickable && "cursor-default",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold",
                  done && "bg-emerald-600 text-white",
                  isCurrent && "bg-primary-foreground text-primary",
                  isFuture && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : isCurrent ? <Circle className="h-2.5 w-2.5 fill-current" /> : i + 1}
              </span>
              <span className="whitespace-nowrap">{s}</span>
            </button>
            {i < LF_STATUSES.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 mx-0.5 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}