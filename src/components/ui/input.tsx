import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-[14px] border border-[#25252b] bg-[#141418] px-3.5 py-2 text-sm text-[#f3f3f3] outline-none transition placeholder:text-[#74747c] focus:border-[#fb9e1d]/45 focus:bg-[#1a1a1f] focus:ring-2 focus:ring-[#fb9e1d]/15",
        className,
      )}
      {...props}
    />
  );
}
