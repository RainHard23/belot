import type { ReactNode } from "react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Minimal CSS-only-positioned tooltip (no portal, no extra dependency).
 * Shows on hover/focus so keyboard users get the same hint as mouse users.
 */
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-[8px]",
            "border border-white/10 bg-[#0a0b0e] px-2.5 py-1 text-[11px] font-semibold text-white shadow-xl",
            side === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
