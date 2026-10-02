import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

/** A titled block inside a side panel. */
export function Section({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className={cn("border-b border-border px-4 py-3.5", className)}>
      <div className="mb-2.5 flex min-h-6 items-center justify-between gap-2">
        <h2 id={headingId} className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </h2>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Muted explanatory text for empty states inside panels. */
export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13px] leading-relaxed text-muted-foreground", className)}>{children}</p>;
}

/** Amber notice for recoverable problems (malformed rows, failed fits…). */
export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-md border border-warning-border bg-warning px-3 py-2 text-[13px] leading-relaxed text-warning-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
