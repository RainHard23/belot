import type { PlayerView, Seat } from "@shared/game";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ru } from "@/ui/i18n/ru";
import { ActionButton } from "@/ui/match/controls/ActionButton";

/** Hand-end auto-advances after this long unless the player clicks first. */
const AUTO_NEXT_MS = 8_000;

/**
 * Centered modal overlay (not part of the bottom dock's flow) so it reads as
 * a deliberate "round summary" beat rather than one more thing crammed into
 * the hand area. `MatchScreen` renders this inside a fixed, full-bleed
 * backdrop layer.
 */
export function HandEndPanel({
  view,
  players,
  onNext,
  onLeave,
}: {
  view: PlayerView;
  players: { seat: Seat; name: string }[];
  onNext: () => void;
  onLeave: () => void;
}) {
  const summary = view.lastHandSummary;
  const over = view.matchOver;
  const nameOf = (seat: Seat) =>
    players.find(p => p.seat === seat)?.name ?? seat;

  if (over) {
    const youWon = over.winner === view.you;
    return (
      <ModalShell>
        {youWon && <Confetti />}
        <div className="text-lg font-bold text-[var(--accent)]">{ru.matchOver}</div>
        <div className="text-2xl font-extrabold text-white">
          {youWon ? ru.youWin : ru.youLose}
        </div>
        <p className="text-sm text-[var(--muted)]">
          {over.reason === "bolts" ? "Победа по болтам (3)" : `До ${view.target} очков`}
          {" · "}
          {view.matchScore.p0}
          :
          {view.matchScore.p1}
        </p>
        <ActionButton variant="primary" size="lg" onClick={onLeave}>{ru.backLobby}</ActionButton>
      </ModalShell>
    );
  }

  const hand = summary?.hand;
  const bilot = summary?.bilotWin;
  const leaderScore = Math.max(view.matchScore.p0, view.matchScore.p1, 1);
  const progressPct = Math.min(100, (leaderScore / view.target) * 100);

  return (
    <ModalShell wide>
      <div className="text-center text-sm font-semibold text-[var(--accent)]">{ru.handOver}</div>
      {bilot && (
        <div className="rounded-[10px] bg-[var(--accent-soft)] px-3 py-2 text-center text-sm font-bold text-[var(--accent)]">
          Билот!
          {" "}
          {nameOf(bilot)}
        </div>
      )}
      {hand && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          {(["p0", "p1"] as Seat[]).map(seat => (
            <div
              key={seat}
              className="rounded-[12px] bg-[var(--surface)] px-3 py-2"
            >
              <div className="mb-1 font-bold text-white">{nameOf(seat)}</div>
              <div className="text-[var(--muted)]">
                Карты
                {" "}
                <span className="text-white">{hand[seat].cardPoints}</span>
              </div>
              <div className="text-[var(--muted)]">
                Объявы
                {" "}
                <span className="text-white">{hand[seat].declarationPoints}</span>
              </div>
              <div className="font-semibold text-[var(--accent)]">
                =
                {" "}
                {hand[seat].points}
                {" "}
                очк.
                {hand[seat].bolt ? " · болт" : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width]"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="text-center text-xs text-[var(--muted)]">
        Матч
        {" "}
        {view.matchScore.p0}
        :
        {view.matchScore.p1}
        {" · "}
        {ru.bolts}
        {" "}
        {view.matchScore.bolts.p0}
        /
        {view.matchScore.bolts.p1}
        {" · до "}
        {view.target}
      </div>

      <AutoNextButton key={`${view.matchScore.p0}-${view.matchScore.p1}-${view.tricksTaken.p0}`} onNext={onNext} />
    </ModalShell>
  );
}

function ModalShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={`panel relative flex ${wide ? "max-w-lg" : "max-w-sm"} flex-col items-center gap-3 px-6 py-5 text-center`}
    >
      {children}
    </motion.div>
  );
}

/** "Next hand" button that also self-advances with a visible countdown ring. */
function AutoNextButton({ onNext }: { onNext: () => void }) {
  const [remainingMs, setRemainingMs] = useState(AUTO_NEXT_MS);
  const fired = useRef(false);

  const go = () => {
    if (fired.current)
      return;
    fired.current = true;
    onNext();
  };

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const left = Math.max(0, AUTO_NEXT_MS - (Date.now() - start));
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(interval);
        go();
      }
    }, 100);
    return () => clearInterval(interval);
    // eslint-disable-next-line react/exhaustive-deps -- intentional: run once per mount (key changes per hand)
  }, []);

  const pct = (remainingMs / AUTO_NEXT_MS) * 100;

  return (
    <ActionButton variant="primary" size="lg" onClick={go} className="relative overflow-hidden">
      <span
        className="pointer-events-none absolute inset-y-0 left-0 bg-black/15"
        style={{ width: `${100 - pct}%`, transition: "width 100ms linear" }}
      />
      <span className="relative">{ru.nextHand}</span>
    </ActionButton>
  );
}

/** Lightweight CSS-driven confetti burst — no canvas, no dependency. */
function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => i);
  const colors = ["var(--accent)", "var(--accent-strong)", "#ffffff", "#ff6a5e"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((i) => {
        const left = (i * 37) % 100;
        const delay = (i % 8) * 0.12;
        const duration = 1.6 + (i % 5) * 0.18;
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className="absolute top-[-10%] size-2 rounded-[2px] opacity-90"
            style={{
              left: `${left}%`,
              background: color,
              animation: `confetti-fall ${duration}s ease-in ${delay}s forwards`,
            }}
          />
        );
      })}
    </div>
  );
}
