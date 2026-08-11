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
      <div className="flex flex-col items-stretch gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
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
            <h1 className="break-words text-lg font-semibold tracking-tight sm:truncate sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 [&>*]:flex-1 sm:justify-end sm:[&>*]:flex-none">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
