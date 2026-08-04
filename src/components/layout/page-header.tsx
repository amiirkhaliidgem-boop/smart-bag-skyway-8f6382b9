import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Design-system page header.
 * Title + optional eyebrow/description on the left, actions on the right.
 * Uses a two-column grid on mobile so long titles truncate instead of
 * pushing the action buttons off-screen.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  actions,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("mb-5 sm:mb-6", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
