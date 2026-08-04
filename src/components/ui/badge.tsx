import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { ASSETS } from "@/ui/assets";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BalancePill({
  amount = "$7.50",
  className,
}: {
  amount?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-[42px] min-w-[152px] items-center justify-center gap-2 rounded-[14px] border-[1.6px] border-[#25252b] bg-[#1d1d22] text-[14px] text-white",
        className,
      )}
    >
      <img src={ASSETS.chipGold} alt="" className="size-5" />
      {amount}
    </div>
  );
}

export function SeatChip({
  name,
  avatarSrc,
  empty,
  meta,
}: {
  name?: string;
  avatarSrc?: string;
  empty?: boolean;
  meta?: string;
}) {
  return (
    <motion.div
      layout
      initial={empty ? false : { opacity: 0, x: -12, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="flex items-center justify-between rounded-[12px] bg-[#19191d] px-3 py-2.5"
    >
      <div className="flex items-center gap-3">
        <motion.div
          key={empty ? "empty" : (name ?? "seat")}
          initial={empty ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
          className="size-9 overflow-hidden rounded-full border-2 border-[#fb9e1d]/80 bg-[#25252b]"
        >
          {empty || !avatarSrc
            ? (
                <div className="flex h-full w-full items-center justify-center text-xs text-[#74747c]">—</div>
              )
            : (
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              )}
        </motion.div>
        <span className="text-sm font-semibold text-[#f3f3f3]">
          {empty ? "Свободно" : name}
        </span>
      </div>
      {meta && <span className="text-sm text-[#74747c]">{meta}</span>}
    </motion.div>
  );
}
