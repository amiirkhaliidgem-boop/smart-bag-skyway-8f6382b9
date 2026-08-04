import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type KpiTone = "default" | "primary" | "success" | "warning" | "danger" | "info" | "muted";

const TONE_RING: Record<KpiTone, string> = {
  default: "bg-muted text-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-[color-mix(in_oklab,var(--success)_15%,transparent)] text-[var(--success)]",
  warning: "bg-[color-mix(in_oklab,var(--warning)_18%,transparent)] text-[var(--warning)]",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-[color-mix(in_oklab,var(--info)_15%,transparent)] text-[var(--info)]",
  muted: "bg-muted text-muted-foreground",
};

/**
 * Declarative KPI descriptor. Dashboards render a list of these instead of
 * hand-written cards, so new workflow statuses only require a new descriptor.
 */
export interface KpiDescriptor<T = Record<string, unknown>> {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: KpiTone;
  /** Pull the raw value out of the backend payload. */
  value: (data: T) => number | string | null | undefined;
  /** Optional secondary line (e.g. "of 120 total"). */
  hint?: (data: T) => ReactNode;
  format?: "number" | "percent" | "duration" | "raw";
  /** Hide the card when the backend does not provide the field. */
  hideWhenMissing?: boolean;
}

export function formatKpi(
  value: number | string | null | undefined,
  format: KpiDescriptor["format"] = "number",
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  switch (format) {
    case "percent":
      return `${Math.round(value * 10) / 10}%`;
    case "duration":
      return value >= 24
        ? `${Math.round((value / 24) * 10) / 10}d`
        : `${Math.round(value * 10) / 10}h`;
    case "raw":
      return String(value);
    default:
      return new Intl.NumberFormat("en-US").format(value);
  }
}

export const KpiCard = memo(function KpiCard({
  label,
  value,
  icon,
  tone = "default",
  hint,
  loading,
  className,
  onClick,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  tone?: KpiTone;
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors",
        onClick && "hover:border-primary/40 hover:bg-muted/40",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg [&_svg]:h-4 [&_svg]:w-4",
              TONE_RING[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <span className="text-2xl font-semibold tabular-nums leading-none tracking-tight">
          {value}
        </span>
      )}
      {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
    </Comp>
  );
});

/** One shared responsive KPI ladder used by every dashboard surface. */
export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Render a descriptor list against a backend payload. */
export function KpiDescriptorGrid<T extends Record<string, unknown>>({
  descriptors,
  data,
  loading,
  className,
}: {
  descriptors: KpiDescriptor<T>[];
  data: T | null | undefined;
  loading?: boolean;
  className?: string;
}) {
  return (
    <KpiGrid className={className}>
      {descriptors.map((d) => {
        const raw = data ? d.value(data) : null;
        if (d.hideWhenMissing && (raw === null || raw === undefined)) return null;
        return (
          <KpiCard
            key={d.key}
            label={d.label}
            icon={d.icon}
            tone={d.tone}
            loading={loading || !data}
            value={formatKpi(raw, d.format)}
            hint={data && d.hint ? d.hint(data) : undefined}
          />
        );
      })}
    </KpiGrid>
  );
}
