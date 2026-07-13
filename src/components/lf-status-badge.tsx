import { cn } from "@/lib/utils";
import { LF_STATUS_COLOR, type LFStatus } from "@/lib/lost-found/statuses";

export function LfStatusBadge({
  status,
  className,
}: {
  status: LFStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap",
        LF_STATUS_COLOR[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5 opacity-70" />
      {status}
    </span>
  );
}