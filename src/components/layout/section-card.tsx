import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard content card: consistent radius, border, padding and header
 * rhythm for every panel in the app.
 */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
  bodyClassName,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      {title || actions ? (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4 sm:flex sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{title}</h2>
              {description ? (
                <p className="truncate text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(padded && "p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
