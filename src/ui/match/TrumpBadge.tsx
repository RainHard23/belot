import type { Suit } from "@shared/game";
import { motion } from "motion/react";
import { ru } from "@/ui/i18n/ru";

const SUIT_COLOR: Record<Suit, string> = {
  hearts: "#e11d48",
  diamonds: "#e11d48",
  spades: "#f8fafc",
  clubs: "#f8fafc",
};

/**
 * Large always-visible trump marker on the felt — suit in a framed panel.
 */
export function TrumpBadge({ suit }: { suit: Suit }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      className="pointer-events-none absolute right-[14%] top-[42%] z-20 flex -translate-y-1/2 flex-col items-center gap-1"
    >
      <div
        className="flex size-[min(7.5rem,18vw)] flex-col items-center justify-center rounded-[22px] border border-white/15 bg-black/55 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
      >
        <span
          className="text-[clamp(2.8rem,8vw,4.5rem)] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          style={{ color: SUIT_COLOR[suit] }}
        >
          {ru.suitSym[suit]}
        </span>
      </div>
      <span className="rounded-full border border-[var(--accent)]/40 bg-black/75 px-3 py-1 text-[11px] font-bold tracking-wide text-[var(--accent)] backdrop-blur">
        {ru.trump}
        {" · "}
        {ru.suits[suit]}
      </span>
    </motion.div>
  );
}
