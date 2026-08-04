import { Check, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LF_STATUS_ORDER,
  isPickup,
  lfPathLifecycle,
  type LFStatus,
} from "@/lib/lost-found/statuses";

// Enterprise workflow stepper. Reads canonical LF_STATUSES from
// src/lib/lost-found/statuses.ts. Completed = check, current = filled,
// future = disabled. `onSelect` optional; when omitted the stepper is
// display-only.
export function LfStatusStepper({
  current,
  method,
  onSelect,
  className,
}: {
  current: LFStatus;
  /** Delivery method — selects the Home Delivery or Airport Pickup lifecycle. */
  method?: string;
  onSelect?: (s: LFStatus) => void;
  className?: string;
}) {
  // Home Delivery: the stepper renders L&F-owned statuses up to "Ready for
  // Delivery"; everything after that belongs to Delivery Management and is
  // displayed there. Airport Pickup: L&F owns the whole path, so the stepper
  // runs all the way to "Passenger Picked Up".
  const steps = lfPathLifecycle(method);
  const stepIndex = steps.findIndex((s) => s === current);
  const globalCurrent = LF_STATUS_ORDER[current];
  const readyIdx =
    LF_STATUS_ORDER[isPickup(method) ? "Ready for Airport Pickup" : "Ready for Delivery"];
  // Once past Ready for Delivery, force the last step to render as complete.
  const currentIndex = stepIndex >= 0 ? stepIndex : globalCurrent > readyIdx ? steps.length : 0;
  return (
    <div className={cn("flex flex-wrap items-stretch gap-y-2 gap-x-0 text-xs", className)}>
      {steps.map((s, i) => {
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
                isCurrent &&
                  "bg-primary text-primary-foreground border-primary font-semibold shadow-sm",
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
                {done ? (
                  <Check className="h-3 w-3" />
                ) : isCurrent ? (
                  <Circle className="h-2.5 w-2.5 fill-current" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="whitespace-nowrap">{s}</span>
            </button>
            {i < steps.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 mx-0.5 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
