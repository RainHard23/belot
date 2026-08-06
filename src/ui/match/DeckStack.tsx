import type { Card } from "@shared/game";
import { AnimatePresence, motion } from "motion/react";
import { CardBack } from "@/ui/cards/CardBack";
import { PlayingCard } from "./PlayingCard";
import { ru } from "@/ui/i18n/ru";

/** Match PlayingCard `md` — deck must read as a real card stack. */
const DECK_W = "clamp(58px, 8vw, 78px)";
const DECK_ASPECT = "240 / 336";

/**
 * Real table stock: thick PlayingCard-sized packet. During bidding the
 * proposed trump stays UNDER the packet (rotated), only half peeking out —
 * classic Belote. It leaves the deck only when someone takes.
 */
export function DeckStack({
  count,
  label,
  faceUp,
}: {
  count: number;
  label?: string;
  /** Proposed trump resting under the stock during deal/bidding. */
  faceUp?: Card | null;
}) {
  const layers = Math.min(12, Math.max(count > 0 ? 1 : 0, count));
  if (layers === 0 && !faceUp)
    return null;

  return (
    <div
      id="table-deck-anchor"
      className="pointer-events-none absolute left-[12%] top-[44%] z-20 flex -translate-y-1/2 flex-col items-center gap-1.5"
    >
      <div
        className="relative"
        style={{
          width: DECK_W,
          aspectRatio: DECK_ASPECT,
          marginRight: faceUp ? "3.8rem" : undefined,
        }}
      >
        <AnimatePresence>
          {faceUp && (
            <motion.div
              key={faceUp.id}
              className="absolute z-0 origin-center"
              initial={{ opacity: 0, scale: 0.85, rotate: 90, left: "20%", top: "50%", x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, rotate: 90, left: "78%", top: "50%", x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              style={{ width: DECK_W, aspectRatio: DECK_ASPECT }}
            >
              <PlayingCard
                card={faceUp}
                size="md"
                glow="gold"
                layoutId={`faceup-${faceUp.id}`}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {layers > 0 && (
          <div
            className="absolute inset-0 z-10 drop-shadow-[0_16px_32px_rgba(0,0,0,0.65)]"
            style={{ width: DECK_W, aspectRatio: DECK_ASPECT }}
          >
            {Array.from({ length: layers }, (_, i) => (
              <div
                key={i}
                className="absolute inset-0 overflow-hidden rounded-[10px] ring-1 ring-black/45"
                style={{
                  transform: `translate(${i * 3.2}px, ${-i * 3.6}px)`,
                  zIndex: i,
                  boxShadow: i === layers - 1
                    ? "0 10px 22px rgba(0,0,0,0.5)"
                    : "0 1px 0 rgba(0,0,0,0.4)",
                }}
              >
                <CardBack />
              </div>
            ))}
          </div>
        )}
      </div>

      {count > 0 && (
        <span className="rounded-full border border-[var(--accent)]/35 bg-black/75 px-2.5 py-1 text-[11px] font-bold tracking-wide text-[var(--accent)] backdrop-blur">
          {label ?? ru.deck}
          {" "}
          ·
          {" "}
          {count}
        </span>
      )}
      {faceUp && (
        <span className="rounded-full border border-[#fb9e1d]/45 bg-black/70 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#fb9e1d] backdrop-blur">
          {ru.faceUp}
          {" "}
          {ru.suitSym[faceUp.suit]}
        </span>
      )}
    </div>
  );
}
