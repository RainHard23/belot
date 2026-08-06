import { cn } from "@/lib/cn";
import { ru } from "@/ui/i18n/ru";

/** Belote-only wordmark — no poker leftover from the old SVG. */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const diamond = size === "lg" ? "text-[28px]" : size === "sm" ? "text-[16px]" : "text-[20px]";
  const text = size === "lg" ? "text-[36px]" : size === "sm" ? "text-[22px]" : "text-[28px]";

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="img"
      aria-label={ru.brand}
    >
      <span
        className={cn("leading-none text-[#e53935]", diamond)}
        aria-hidden
      >
        ♦
      </span>
      <span
        className={cn(
          "font-bold leading-none tracking-tight text-[#f3f3f3]",
          text,
        )}
      >
        {ru.brand}
      </span>
    </div>
  );
}
