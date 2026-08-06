import type { VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fb9e1d] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "border-2 border-white/15 text-white shadow-[0_0_17px_rgba(255,179,32,0.27)]",
        /** Figma Play — crimson → orange; selected row uses gold via `playSelected`. */
        play:
          "bg-[linear-gradient(180deg,#d6471a_0%,#9a2c39_100%)] text-white shadow-[0_4px_12px_rgba(154,44,57,0.35)]",
        playSelected:
          "border-2 border-white/15 text-white shadow-[0_0_17px_rgba(255,179,32,0.27)]",
        /** Figma Watch — flat dark chip. */
        watch:
          "bg-[#1d1d22] text-[#74747c] hover:bg-[#25252b] hover:text-[#cfcfd4]",
        secondary:
          "border border-[#25252b] bg-[#1d1d22] text-[#f3f3f3] hover:bg-[#25252b]",
        ghost: "text-[#f3f3f3] hover:bg-white/5",
        outline:
          "border border-[#25252b] bg-transparent text-[#f3f3f3] hover:bg-white/5",
        waiting:
          "bg-gradient-to-r from-[#f38300] to-[#fab854] text-white",
      },
      size: {
        default: "h-10 rounded-[14px] px-4 text-sm",
        sm: "h-8 rounded-[10px] px-3 text-[13px]",
        /** Figma table-row CTA — 42×120-ish. */
        row: "h-[42px] min-w-[110px] rounded-[14px] px-5 text-[15px]",
        lg: "h-12 rounded-[14px] px-6 text-base",
        icon: "size-[42px] rounded-[14px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  style,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const goldFill
    = variant === "default" || variant === undefined || variant === "playSelected"
      ? {
          background:
            "radial-gradient(circle at 90% 100%, #f38300 0%, #fea929 66%, #fab854 100%)",
          ...style,
        }
      : style;
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      style={
        variant === "default" || !variant || variant === "playSelected"
          ? goldFill
          : style
      }
      {...props}
    />
  );
}
