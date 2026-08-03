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
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {showPresets ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => preset(1)}>
            Today
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => preset(7)}>
            7 days
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => preset(30)}>
            30 days
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className={cn("h-9 w-[145px]", !from && "[&::-webkit-datetime-edit]:text-transparent")}
        />
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className={cn("h-9 w-[145px]", !to && "[&::-webkit-datetime-edit]:text-transparent")}
        />
      </div>

      {children}

      {withGrain ? (
        <Select value={grain ?? "day"} onValueChange={(v) => onGrainChange?.(v as DateGrain)}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}