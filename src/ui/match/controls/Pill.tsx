import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** HUD chip — score, bolts, trump, phase. Themed border/shadow via --accent. */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[12px] border px-3.5 py-2 text-sm backdrop-blur-md",
        "border-[var(--accent)]/[0.18] bg-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
