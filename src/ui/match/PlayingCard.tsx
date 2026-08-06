import type { Card as CardType } from "@shared/game";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { CardBack } from "@/ui/cards/CardBack";
import { CardFace } from "@/ui/cards/CardFace";

/** Widths as clamp() so cards scale down on 768-1279px, and further on <768px. */
const SIZE = {
  xs: "clamp(30px, 4.2vw, 40px)",
  sm: "clamp(44px, 6.4vw, 62px)",
  md: "clamp(58px, 8vw, 78px)",
  lg: "clamp(74px, 10vw, 100px)",
  xl: "clamp(86px, 12.5vw, 140px)",
} as const;
const CARD_ASPECT = "240 / 336";

export function PlayingCard({
  card,
  faceDown = false,
  flipped = false,
  className,
  layoutId,
  onClick,
  disabled,
  size = "md",
  glow,
}: {
  card?: CardType;
  faceDown?: boolean;
  /** When true, starts pre-rotated (used for the initial deal reveal flip) */
  flipped?: boolean;
  className?: string;
  layoutId?: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: keyof typeof SIZE;
  /** Soft glow ring — face-up highlight / legal-move hint */
  glow?: "gold" | "legal" | false;
}) {
  const showBack = faceDown || !card;
  const targetDeg = showBack ? 180 : 0;
  const initialDeg = flipped ? 180 : targetDeg;
  const interactive = Boolean(onClick) && !disabled;

  const inner = (
    <motion.div
      className="absolute inset-0 [transform-style:preserve-3d]"
      initial={{ rotateY: initialDeg }}
      animate={{ rotateY: targetDeg }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={cn(
          "absolute inset-0 overflow-hidden rounded-[10px] ring-1 ring-black/50 [backface-visibility:hidden]",
          "shadow-[0_12px_28px_rgba(0,0,0,0.55),0_2px_6px_rgba(0,0,0,0.35)]",
          glow === "gold" && "ring-2 ring-[#fb9e1d] shadow-[0_0_28px_rgba(251,158,29,0.55),0_12px_28px_rgba(0,0,0,0.5)]",
          glow === "legal" && "ring-2 ring-emerald-400/80 shadow-[0_0_22px_rgba(52,211,153,0.45),0_12px_28px_rgba(0,0,0,0.5)]",
        )}
      >
        {card && <CardFace rank={card.rank} suit={card.suit} />}
      </div>
      <div
        className="absolute inset-0 overflow-hidden rounded-[10px] ring-1 ring-black/50 [backface-visibility:hidden] [transform:rotateY(180deg)] shadow-[0_12px_28px_rgba(0,0,0,0.55),0_2px_6px_rgba(0,0,0,0.35)]"
      >
        <CardBack />
      </div>
    </motion.div>
  );

  const boxStyle = { width: SIZE[size], aspectRatio: CARD_ASPECT } as const;

  if (!interactive) {
    return (
      <motion.div
        layoutId={layoutId}
        className={cn("relative shrink-0 [perspective:1200px]", className)}
        style={boxStyle}
        aria-hidden={!card}
      >
        {inner}
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      layoutId={layoutId}
      onClick={onClick}
      whileHover={{ y: -18, scale: 1.06 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative shrink-0 cursor-pointer [perspective:1200px]",
        className,
      )}
      style={boxStyle}
    >
      {inner}
    </motion.button>
  );
}
