import { ASSETS } from "@/ui/assets";
import { cn } from "@/lib/cn";
import { ru } from "@/ui/i18n/ru";

export function BrandMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const logo = size === "lg" ? "h-11" : size === "sm" ? "h-7" : "h-9";
  const text = size === "lg" ? "text-[36px]" : size === "sm" ? "text-[22px]" : "text-[28px]";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <img src={ASSETS.logo} alt="" className={cn(logo, "w-auto")} />
      <div className={cn("flex items-baseline font-bold leading-none tracking-tight text-[#f3f3f3]", text)}>
        <span>no</span>
        <span className="mx-0.5 text-[#e53935]">♦</span>
        <span className="font-serif italic font-semibold">{ru.brand}</span>
      </div>
    </div>
  );
}
