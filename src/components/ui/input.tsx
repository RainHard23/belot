import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-[12px] border border-[#25252b] bg-[#1d1d22] px-3 py-2 text-sm text-[#f3f3f3] outline-none placeholder:text-[#74747c] focus:border-[#fb9e1d]/50",
        className,
      )}
      {...props}
    />
  );
}
