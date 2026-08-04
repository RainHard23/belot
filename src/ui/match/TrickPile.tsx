import { motion } from "motion/react";
import { CardBack } from "@/ui/cards/CardBack";

/** Small stack of won tricks near a seat — grows as tricks are collected. */
export function TrickPile({
  count,
  side,
  pulse,
}: {
  count: number;
  side: "left" | "right";
  pulse?: boolean;
}) {
  if (count === 0)
    return null;

  const shown = Math.min(count, 5);

  return (
    <div className={`pointer-events-none absolute ${side === "left" ? "left-[3%]" : "right-[3%]"} top-1/2 -translate-y-1/2`}>
      <motion.div
        className="relative"
        style={{ width: 34, height: 48 }}
        animate={pulse ? { scale: [1, 1.14, 1] } : undefined}
        transition={{ duration: 0.45 }}
      >
        {Array.from({ length: shown }).map((_, i) => (
          <div
            key={i}
            className="absolute overflow-hidden rounded-[5px] shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            style={{
              width: 34,
              height: 48,
              top: -i * 1.6,
              left: i * 1.2,
              zIndex: i,
              filter: pulse && i === shown - 1 ? "drop-shadow(0 0 8px rgba(251,158,29,0.6))" : undefined,
            }}
          >
            <CardBack />
          </div>
        ))}
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold-2)]">
          {count}
        </span>
      </motion.div>
    </div>
  );
}
