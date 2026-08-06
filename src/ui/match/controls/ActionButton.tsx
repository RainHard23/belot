import type { VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Game-table button system — deliberately more "physical" than the lobby's
 * `components/ui/button.tsx`: inner top highlight + bottom shade so buttons
 * read as pressable felt-rail hardware, a 1px press-down on `:active`, and a
 * `focus-visible` ring that follows the active table theme's `--accent`.
 */
const actionButtonVariants = cva(
  [
    "relative inline-flex cursor-pointer select-none items-center justify-center gap-1.5",
    "whitespace-nowrap rounded-[14px] font-bold transition-[transform,box-shadow,opacity]",
    "active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Round-1 bidding "take" — urgent red, matches the play accent. */
        take: [
          "bg-gradient-to-b from-[#ff6a5e] to-[#c62828] text-white",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_rgba(198,40,40,0.4)]",
        ].join(" "),
        /** Round-2 suit choice. */
        suit: [
          "border border-white/10 bg-[var(--surface-2)] text-white",
          "hover:border-[var(--accent)]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        ].join(" "),
        /** Pass / decline — secondary but clearly pressable (not muted/disabled). */
        pass: [
          "border border-white/25 bg-gradient-to-b from-[#3a3a44] to-[#25252e] text-white",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_rgba(0,0,0,0.35)]",
          "hover:border-white/40 hover:from-[#454552] hover:to-[#2c2c36]",
        ].join(" "),
        /** Primary call to action (next hand, confirm). */
        primary: [
          "text-[#241606]",
          "bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_10px_24px_var(--accent-soft)]",
        ].join(" "),
        /** Low-emphasis chrome action (leave table, back). */
        ghost: [
          "border border-white/[0.08] bg-black/40 text-white/85 backdrop-blur-md",
          "hover:bg-white/[0.06]",
        ].join(" "),
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-6 text-base",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface ActionButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof actionButtonVariants> {}

export function ActionButton({
  className,
  variant,
  size,
  ...props
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(actionButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

/** Square icon-only button — settings gear, hints toggle, sound mute… */
export function IconButton({
  className,
  active,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 cursor-pointer items-center justify-center rounded-[12px] border transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-[var(--accent)]/60 bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "border-white/[0.08] bg-black/40 text-white/70 hover:bg-white/[0.06] hover:text-white",
        className,
      )}
      {...props}
    />
  );
}
