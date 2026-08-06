import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared chrome for every HUD/side-panel surface at the table (score, log,
 * hints, emotes, settings popover…). Reads the `.panel` CSS class (index.css)
 * which itself reads `--panel-*` custom properties — those flip per
 * [data-table-theme], so every panel restyles with the active skin instead
 * of each component hardcoding its own `bg-black/55` value.
 */
export function Panel({
  title,
  children,
  className,
  as: As = "div",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  as?: "div" | "aside" | "section";
}) {
  return (
    <As className={cn("panel flex w-full flex-col gap-2 p-3", className)}>
      {title && (
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          {title}
        </h2>
      )}
      {children}
    </As>
  );
}
