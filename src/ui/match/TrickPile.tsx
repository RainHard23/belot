import { motion } from "motion/react";
import { CardBack } from "@/ui/cards/CardBack";
import { ru } from "@/ui/i18n/ru";

/** Match PlayingCard `md` / deck so отбой reads as won cards. */
const PILE_W = "clamp(58px, 8vw, 78px)";
const PILE_ASPECT = "240 / 336";

/**
 * Won-trick discard (отбой) for one seat — two piles, as in real Belote.
 * Empty piles stay invisible (no dashed outline); labels show once cards land.
 */
export function TrickPile({
  count,
  side,
  pulse,
}: {
  count: number;
  side: "left" | "right";
  pulse?: boolean;
}) {
  const shown = Math.min(Math.max(count, 0), 8);
  if (count <= 0) {
    return (
      <div
        data-otboy={side === "left" ? "opp" : "you"}
        className={`pointer-events-none absolute z-20 -translate-y-1/2 ${
          side === "left"
            ? "left-[12%] top-[20%]"
            : "right-[12%] top-[74%]"
        }`}
        style={{ width: PILE_W, aspectRatio: PILE_ASPECT }}
      />
    );
  }

  return (
    <div
      data-otboy={side === "left" ? "opp" : "you"}
      className={`pointer-events-none absolute z-20 flex -translate-y-1/2 flex-col items-center gap-1.5 ${
        side === "left"
          ? "left-[12%] top-[20%]"
          : "right-[12%] top-[74%]"
      }`}
    >
      <motion.div
        className="relative drop-shadow-[0_12px_22px_rgba(0,0,0,0.5)]"
        style={{ width: PILE_W, aspectRatio: PILE_ASPECT }}
        animate={pulse ? { scale: [1, 1.12, 1] } : undefined}
        transition={{ duration: 0.45 }}
      >
        {Array.from({ length: Math.max(shown, 1) }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-0 overflow-hidden rounded-[10px] ring-1 ring-black/40"
            style={{
              transform: `translate(${i * 3}px, ${-i * 3.2}px)`,
              zIndex: i,
              filter: pulse && i === shown - 1
                ? "drop-shadow(0 0 10px rgba(251,158,29,0.65))"
                : undefined,
            }}
          >
            <CardBack />
          </div>
        ))}
      </motion.div>
      <span className="rounded-full border border-white/10 bg-black/75 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white/80 backdrop-blur">
        {ru.discard}
        {" "}
        ·
        {" "}
        {count}
      </span>
    </div>
  );
}
