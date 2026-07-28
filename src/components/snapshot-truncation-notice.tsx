import { AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";

/**
 * The operational snapshot reads a bounded number of rows per table so a
 * PostgREST row cap can never silently hide records. When a collection hits
 * its cap the operator must know the list is a recent window, not the whole
 * archive.
 */
export function SnapshotTruncationNotice({
  collection,
  noun,
}: {
  collection: "cases" | "deliveries" | "audit" | "notifications";
  noun: string;
}) {
  const truncated = useStore((s) => s.truncated);
  if (!truncated[collection]) return null;
  const limit = truncated.limits[collection];
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
      <span>
        Showing the {limit} most recent {noun}. Older records exist but are outside this view —
        narrow your filters or use Export to reach them.
      </span>
    </div>
  );
}