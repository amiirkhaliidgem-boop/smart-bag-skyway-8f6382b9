import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";

// System-wide shared Bulk Actions toolbar.
// Design standard extracted from Delivery Management — every module
// (Lost & Found, Delivery, Warehouse, …) must consume this component so
// the bulk UX stays consistent across the app.

export interface BulkAction {
  key: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  onClick: () => void;
  disabled?: boolean;
}

export interface BulkToolbarProps {
  count: number;
  /** Singular noun for the selection, e.g. "Delivery" or "Case". */
  noun: string;
  /** Optional plural override; defaults to noun + "s". */
  pluralNoun?: string;
  actions: BulkAction[];
  onCancel: () => void;
  cancelLabel?: string;
}

export function BulkToolbar({
  count,
  noun,
  pluralNoun,
  actions,
  onCancel,
  cancelLabel = "Cancel Selection",
}: BulkToolbarProps) {
  const label = count === 1 ? noun : pluralNoun ?? `${noun}s`;
  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 shadow-sm">
      <div className="text-sm">
        <span className="text-muted-foreground">Selected:</span>{" "}
        <span className="font-semibold">
          {count} {label}
        </span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Button
              key={a.key}
              size="sm"
              variant={a.variant ?? (a.key === actions[0]?.key ? "default" : "outline")}
              onClick={a.onClick}
              disabled={a.disabled}
              className="gap-1.5"
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              {a.label}
            </Button>
          );
        })}
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}