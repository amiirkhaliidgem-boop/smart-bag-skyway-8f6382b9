import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DateGrain = "day" | "week" | "month";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * The system-wide default range: the last 7 days (today - 6 → today).
 * Every module initialises its date state with this so the From / To inputs
 * never render an empty `dd/mm/yyyy` placeholder.
 */
export function defaultDateRange(days = 7): { from: string; to: string } {
  const end = new Date();
  return {
    from: iso(new Date(end.getTime() - (days - 1) * 86_400_000)),
    to: iso(end),
  };
}

const RANGE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function labelOf(v: string) {
  if (!v) return "";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : RANGE_FMT.format(d);
}

/** Human-readable rendering of the currently selected range. */
export function selectedRangeLabel(from: string, to: string) {
  const a = labelOf(from);
  const b = labelOf(to);
  if (a && b) return a === b ? a : `${a} – ${b}`;
  if (a) return `From ${a}`;
  if (b) return `Up to ${b}`;
  return "All dates";
}

/**
 * The single system-wide date range filter.
 *
 * Presets and the grain selector are configurable through props while the
 * layout, control heights and spacing stay identical in every module.
 */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  grain,
  onGrainChange,
  showPresets = true,
  showGrain,
  showSelectedRange = true,
  showClear = true,
  className,
  children,
}: {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  grain?: DateGrain;
  onGrainChange?: (v: DateGrain) => void;
  showPresets?: boolean;
  showGrain?: boolean;
  /** Show the selected-range summary next to the controls. */
  showSelectedRange?: boolean;
  /** Show the "All dates" reset that widens back to the full history. */
  showClear?: boolean;
  className?: string;
  /** Module-specific controls rendered with the same spacing. */
  children?: ReactNode;
}) {
  const withGrain = showGrain ?? (grain !== undefined && onGrainChange !== undefined);

  function preset(days: number) {
    const end = new Date();
    onToChange(iso(end));
    onFromChange(iso(new Date(end.getTime() - (days - 1) * 86_400_000)));
  }

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-wrap items-center gap-1.5 sm:gap-2",
        className,
      )}
    >
      {showPresets ? (
        <div className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:w-auto sm:items-center sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full px-1 text-xs sm:w-auto sm:px-3 sm:text-sm"
            onClick={() => preset(1)}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full px-1 text-xs sm:w-auto sm:px-3 sm:text-sm"
            onClick={() => preset(7)}
          >
            7 days
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full px-1 text-xs sm:w-auto sm:px-3 sm:text-sm"
            onClick={() => preset(30)}
          >
            30 days
          </Button>
          {showClear ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full px-1 text-xs sm:w-auto sm:px-3 sm:text-sm"
              onClick={() => {
                onFromChange("");
                onToChange("");
              }}
            >
              All dates
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 basis-full items-center gap-1 sm:gap-1.5 sm:flex-none sm:basis-auto">
        <Label className="shrink-0 text-[11px] text-muted-foreground sm:text-xs">From</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          aria-label="From date"
          className="h-9 min-w-0 flex-1 px-2 text-xs sm:w-[145px] sm:flex-none sm:px-3 sm:text-sm"
        />
        <Label className="shrink-0 text-[11px] text-muted-foreground sm:text-xs">To</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          aria-label="To date"
          className="h-9 min-w-0 flex-1 px-2 text-xs sm:w-[145px] sm:flex-none sm:px-3 sm:text-sm"
        />
      </div>

      {children}

      {withGrain ? (
        <Select value={grain ?? "day"} onValueChange={(v) => onGrainChange?.(v as DateGrain)}>
          <SelectTrigger className="h-9 w-full text-xs sm:w-[120px] sm:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {showSelectedRange ? (
        <span className="inline-flex h-8 shrink-0 items-center rounded-md border border-border bg-muted/60 px-2 text-[11px] font-medium text-muted-foreground sm:h-9 sm:px-2.5 sm:text-xs">
          {selectedRangeLabel(from, to)}
        </span>
      ) : null}
    </div>
  );
}
