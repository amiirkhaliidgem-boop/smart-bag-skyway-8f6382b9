import { cn } from "@/lib/utils";
import type { CaseStatus, DeliveryStatus } from "@/lib/store";

const styles: Record<string, string> = {
  Missing: "bg-rose-100 text-rose-700 border-rose-200",
  Located: "bg-amber-100 text-amber-700 border-amber-200",
  Stored: "bg-blue-100 text-blue-700 border-blue-200",
  "Ready For Delivery": "bg-violet-100 text-violet-700 border-violet-200",
  "Picked Up": "bg-teal-100 text-teal-700 border-teal-200",
  "Out For Delivery": "bg-cyan-100 text-cyan-700 border-cyan-200",
  Delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Pending: "bg-slate-100 text-slate-700 border-slate-200",
  Assigned: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export function StatusBadge({
  status,
  className,
}: {
  status: CaseStatus | DeliveryStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap",
        styles[status] ?? "bg-slate-100 text-slate-700 border-slate-200",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current mr-1.5 opacity-70" />
      {status}
    </span>
  );
}