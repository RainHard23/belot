import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ASSETS, avatarUrl } from "@/ui/assets";

const RING_R = 38;
const RING_C = 2 * Math.PI * RING_R;
/** Cosmetic-only "live table" cue — no server-enforced turn timeout. */
const TURN_RING_MS = 14_000;

export function SeatPod({
  name,
  you,
  active,
  tricks,
  isDealer,
  isTaker,
  declarations,
  position,
  compact,
}: {
  name: string;
  you?: boolean;
  active?: boolean;
  tricks: number;
  isDealer?: boolean;
  isTaker?: boolean;
  declarations?: string[];
  position: "top" | "bottom";
  compact?: boolean;
}) {
  const src = you ? ASSETS.avatarDefault : avatarUrl(name);
  const size = compact ? 56 : 72;
  const [turnKey, setTurnKey] = useState(0);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (active && !wasActiveRef.current)
      setTurnKey(k => k + 1);
    wasActiveRef.current = !!active;
  }, [active]);

  return (
    <motion.div
      initial={{ scale: 0.75, opacity: 0, y: position === "top" ? -20 : 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 18 }}
      className={cn(
        "relative z-30 flex flex-col items-center gap-2",
        position === "top" ? "flex-col" : "flex-col-reverse",
      )}
    >
      <AnimatePresence>
        {declarations && declarations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: position === "top" ? -8 : 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="flex flex-wrap justify-center gap-1"
          >
            {declarations.map(label => (
              <span
                key={label}
                className="rounded-full border border-[var(--gold-2)]/40 bg-black/60 px-2 py-0.5 text-[10px] font-bold text-[var(--gold-2)] backdrop-blur"
              >
                {label}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative" style={{ width: size, height: size }}>
        {/* Turn ring — cosmetic pulse, not a real countdown */}
        {active && (
          <svg
            key={turnKey}
            className="pointer-events-none absolute -inset-[7px]"
            viewBox="0 0 96 96"
            width={size + 14}
            height={size + 14}
          >
            <circle
              cx="48"
              cy="48"
              r={RING_R}
              fill="none"
              stroke="rgba(251,158,29,0.18)"
              strokeWidth="4"
            />
            <motion.circle
              cx="48"
              cy="48"
              r={RING_R}
              fill="none"
              stroke="var(--gold-2)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              transform="rotate(-90 48 48)"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: RING_C }}
              transition={{ duration: TURN_RING_MS / 1000, ease: "linear" }}
            />
          </svg>
        )}

        <div
          className={cn(
            "relative h-full w-full overflow-hidden rounded-full border-[3px] bg-[#1d1d22]",
            active
              ? "border-[var(--gold-2)] shadow-[0_0_28px_rgba(251,158,29,0.55)]"
              : "border-[#3a3a42] shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
          )}
        >
          <img src={src} alt="" className="h-full w-full object-cover" />
          {you && (
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-[var(--gold-2)]">
              вы
            </span>
          )}
        </div>

        {isDealer && (
          <div
            className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border-2 border-[#7a4e10] text-[11px] font-bold text-[#3a2410] shadow-md"
            style={{ background: "linear-gradient(180deg,#ffe1a0,#d9a13d)" }}
            title="Раздающий"
          >
            Р
          </div>
        )}
        {isTaker && (
          <div
            className="absolute -left-1 -top-1 flex size-6 items-center justify-center rounded-full border-2 border-[#7a4e10] shadow-md"
            style={{ background: "linear-gradient(180deg,#ffe1a0,#d9a13d)" }}
            title="Взял"
          >
            <svg viewBox="0 0 24 24" width={13} height={13} fill="#3a2410">
              <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8Zm2.2 13h13.6v2H5.2v-2Z" />
            </svg>
          </div>
        )}
      </div>

      <div className="min-w-[128px] rounded-[12px] border border-white/[0.06] bg-[#121316]/92 px-3.5 py-1.5 text-center shadow-lg backdrop-blur-md">
        <div className="truncate text-[14px] font-bold tracking-tight text-white">{name}</div>
        <div className="text-[11px] font-semibold text-[var(--gold-2)]">
          {tricks}
          {" "}
          взятки
        </div>
      </div>
    </motion.div>
  );
}
