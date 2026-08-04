import type { Suit } from "@shared/game";
import { legalMoves, SUITS } from "@shared/game";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useMatchStore } from "@/store/matchStore";
import { ru } from "@/ui/i18n/ru";
import { HandEndPanel } from "./HandEndPanel";
import { KittyStack } from "./KittyStack";
import { PlayingCard } from "./PlayingCard";
import { SeatPod } from "./SeatPod";
import { TableSurface } from "./TableSurface";
import { TrickPile } from "./TrickPile";

const TABLE_THEMES = [
  { id: "emerald", label: "Изумруд", swatch: "#1f6b4f" },
  { id: "sapphire", label: "Сапфир", swatch: "#205e82" },
  { id: "burgundy", label: "Бордо", swatch: "#7c2338" },
] as const;

function useTableTheme() {
  const [theme, setTheme] = useState<string>(
    () => localStorage.getItem("bilot_table_theme") ?? "emerald",
  );
  useEffect(() => {
    localStorage.setItem("bilot_table_theme", theme);
  }, [theme]);
  return [theme, setTheme] as const;
}

export function MatchScreen({
  matchId,
  onLeave,
}: {
  matchId: string;
  onLeave: () => void;
}) {
  const {
    join,
    display,
    players,
    bid,
    play,
    nextHand,
    clear,
    error,
    clearError,
    endedReason,
  } = useMatchStore();
  const view = display.view;
  const [theme, setTheme] = useTableTheme();

  useEffect(() => {
    join(matchId);
    return () => clear();
  }, [join, matchId, clear]);

  useEffect(() => {
    if (endedReason === "opponent_left")
      onLeave();
  }, [endedReason, onLeave]);

  const legalIds = useMemo(() => {
    if (!view || view.phase !== "playing" || !view.trump)
      return new Set<string>();
    if (view.turn !== view.you)
      return new Set<string>();
    return new Set(
      legalMoves(view.hand, view.trick, view.trump).map(c => c.id),
    );
  }, [view]);

  if (!view) {
    return (
      <div
        data-table-theme={theme}
        className="relative flex min-h-screen flex-col items-center justify-center gap-3 overflow-hidden bg-[#0e0e11] text-white"
      >
        <RoomBackdrop />
        <div className="relative z-10 text-lg font-semibold">{ru.loadingTable}</div>
        {error && <div className="relative z-10 text-sm text-rose-300">{error}</div>}
        <button type="button" className="relative z-10 text-sm text-[#fb9e1d]" onClick={onLeave}>
          {ru.backLobby}
        </button>
      </div>
    );
  }

  const opp = players.find(p => p.seat !== view.you);
  const you = players.find(p => p.seat === view.you);
  const myTurn = view.turn === view.you && !display.animBusy && !view.matchOver;
  const bidding
    = display.bidVisible
      && (view.phase === "bidding1" || view.phase === "bidding2");
  const oppSeat = view.you === "p0" ? "p1" : "p0";
  const tableTrick = display.heldTrick?.length
    ? display.heldTrick
    : view.trick;

  const oppDecls = view.declarations
    .filter(d => d.seat === oppSeat)
    .map(d => `${ru.decls[d.kind] ?? d.kind} +${d.gameBonus}`);
  const yourDecls = view.declarations
    .filter(d => d.seat === view.you)
    .map(d => `${ru.decls[d.kind] ?? d.kind} +${d.gameBonus}`);

  return (
    <div
      data-table-theme={theme}
      className="relative grid h-dvh min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-[#0e0e11] font-[Nunito,sans-serif] text-white"
    >
      <RoomBackdrop />

      {/* Top HUD */}
      <header className="relative z-40 flex h-14 shrink-0 items-center justify-between gap-3 px-4 md:px-6">
        <button
          type="button"
          onClick={onLeave}
          className="h-10 rounded-[12px] border border-white/[0.08] bg-black/40 px-4 text-sm font-semibold backdrop-blur-md transition hover:bg-white/[0.06]"
        >
          ←
          {" "}
          {ru.backLobby}
        </button>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <HudPill>
            <span className="text-[#74747c]">{ru.score}</span>
            <span className="font-bold tabular-nums text-[var(--gold-2)]">
              {view.matchScore.p0}
              {" "}
              :
              {" "}
              {view.matchScore.p1}
            </span>
            <span className="text-[#74747c]">
              /
              {view.target}
            </span>
          </HudPill>
          <HudPill>
            <span className="text-[#74747c]">{ru.bolts}</span>
            <span className="font-semibold tabular-nums">
              {view.matchScore.bolts.p0}
              /
              {view.matchScore.bolts.p1}
            </span>
          </HudPill>
          <HudPill>
            {view.trump
              ? (
                  <>
                    <span className="text-[#74747c]">{ru.trump}</span>
                    <span className="font-bold text-[var(--gold-2)]">
                      {ru.suitSym[view.trump]}
                      {" "}
                      {ru.suits[view.trump]}
                    </span>
                  </>
                )
              : <span className="font-semibold text-[var(--gold-2)]">{ru.bidding}</span>}
          </HudPill>
        </div>

        <ThemeSwitch theme={theme} onChange={setTheme} />
      </header>

      {error && (
        <button
          type="button"
          onClick={clearError}
          className="absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-[12px] border border-rose-500/30 bg-rose-950/90 px-4 py-2 text-sm text-rose-200 shadow-xl backdrop-blur"
        >
          {error}
          {" · скрыть"}
        </button>
      )}

      {/* Stage: table plane, sized to fill the remaining grid row */}
      <div className="relative z-10 flex min-h-0 flex-col overflow-hidden">
        <div className="relative z-30 flex justify-center pt-1">
          <SeatPod
            key={`opp-${display.seatEpoch}-${opp?.name}`}
            name={opp?.name ?? "Соперник"}
            active={view.turn === oppSeat}
            tricks={view.tricksTaken[oppSeat]}
            isDealer={view.dealer === oppSeat}
            isTaker={view.taker === oppSeat}
            declarations={oppDecls}
            position="top"
          />
        </div>

        <div className="relative mx-auto min-h-0 w-full max-w-[1200px] flex-1">
          <TableSurface trumpSuit={view.trump} />

          {view.phase === "playing" && (
            <>
              <TrickPile
                count={view.tricksTaken[oppSeat]}
                side="left"
                pulse={display.collectTo === "top"}
              />
              <TrickPile
                count={view.tricksTaken[view.you]}
                side="right"
                pulse={display.collectTo === "bottom"}
              />
              <KittyStack count={view.kittyCount} />
            </>
          )}

          {/* Opponent backs — near top felt */}
          <div className="absolute left-1/2 top-[14%] z-20 flex -translate-x-1/2">
            {Array.from({ length: display.oppShown }).map((_, i) => (
              <motion.div
                key={`opp-${display.dealEpoch}-${i}`}
                initial={{ y: -52, x: (i - 4) * 10, opacity: 0, scale: 0.8, rotate: (i - 4) * 5 }}
                animate={{ y: 0, x: 0, opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                style={{ marginLeft: i === 0 ? 0 : -42, zIndex: i }}
              >
                <PlayingCard faceDown size="sm" />
              </motion.div>
            ))}
          </div>

          {/* Center play / face-up */}
          <div
            className={cn(
              "absolute left-1/2 top-[48%] z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-6 transition-all duration-500 ease-out",
              display.collectTo === "top" && "-translate-x-[46%] -translate-y-[130%] rotate-[-14deg] scale-50 opacity-0",
              display.collectTo === "bottom" && "translate-x-[46%] translate-y-[90%] rotate-[14deg] scale-50 opacity-0",
            )}
          >
            {view.faceUp && (
              <motion.div
                className="flex flex-col items-center gap-2"
                initial={{ scale: 0.55, opacity: 0, rotateY: 90 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
              >
                <span className="rounded-full border border-[var(--gold-2)]/40 bg-black/55 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--gold-2)] backdrop-blur">
                  {ru.faceUp}
                </span>
                <PlayingCard
                  card={view.faceUp}
                  size="xl"
                  layoutId={`card-${view.faceUp.id}`}
                  glow="gold"
                />
              </motion.div>
            )}

            <AnimatePresence mode="popLayout">
              {tableTrick.map((p, idx) => (
                <motion.div
                  key={p.card.id}
                  layoutId={`trick-${p.card.id}`}
                  initial={{
                    scale: 0.65,
                    opacity: 0,
                    y: p.seat === view.you ? 70 : -70,
                    rotate: p.seat === view.you ? 6 : -6,
                  }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    y: 0,
                    rotate: idx === 0 ? -8 : 8,
                    x: idx === 0 ? -8 : 8,
                  }}
                  exit={{ opacity: 0, scale: 0.45 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <PlayingCard
                    card={p.card}
                    size="xl"
                    layoutId={`card-${p.card.id}`}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {!view.faceUp && tableTrick.length === 0 && !display.collectTo && view.phase === "playing" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-full border border-white/10 bg-black/50 px-5 py-2.5 text-sm font-medium text-white/55 backdrop-blur-md"
              >
                {display.animBusy
                  ? ru.animating
                  : myTurn
                    ? ru.yourTurn
                    : ru.waitOpp}
              </motion.div>
            )}
          </div>
        </div>

        {/* Bottom dock: bids / end / you / hand */}
        <div className="relative z-30 flex w-full flex-col items-center gap-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {bidding && myTurn && (
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex flex-wrap items-center justify-center gap-2 rounded-[18px] border border-white/[0.08] bg-[#1d1d22]/92 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            >
              {view.phase === "bidding1" && (
                <button
                  type="button"
                  onClick={() => bid({ type: "take" })}
                  className="h-11 rounded-[14px] bg-gradient-to-b from-[#ff5a4e] to-[#c62828] px-6 text-sm font-bold shadow-lg shadow-red-900/40"
                >
                  {ru.take}
                  {" "}
                  {view.faceUp ? ru.suitSym[view.faceUp.suit as Suit] : ""}
                </button>
              )}
              {view.phase === "bidding2"
                && SUITS.filter(s => s !== view.bidding?.faceUpSuit).map(suit => (
                  <button
                    key={suit}
                    type="button"
                    onClick={() => bid({ type: "choose", suit })}
                    className="h-11 rounded-[14px] border border-white/10 bg-[#25252b] px-4 text-sm font-semibold hover:border-[var(--gold-2)]"
                  >
                    {ru.suitSym[suit]}
                    {" "}
                    {ru.suits[suit]}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => bid({ type: "pass" })}
                className="h-11 rounded-[14px] border border-white/10 px-5 text-sm font-semibold text-[#74747c] hover:text-white"
              >
                {ru.pass}
              </button>
            </motion.div>
          )}

          {(view.phase === "handEnd" || view.matchOver) && !display.animBusy && (
            <HandEndPanel
              view={view}
              players={players}
              onNext={nextHand}
              onLeave={onLeave}
            />
          )}

          <SeatPod
            key={`you-${display.seatEpoch}`}
            name={you?.name ?? "Вы"}
            you
            active={myTurn}
            tricks={view.tricksTaken[view.you]}
            isDealer={view.dealer === view.you}
            isTaker={view.taker === view.you}
            declarations={yourDecls}
            position="bottom"
            compact
          />

          {/* Fan hand */}
          <div className="flex h-[170px] w-full max-w-5xl items-end justify-center overflow-visible pb-1">
            {view.hand.map((card, i) => {
              const n = view.hand.length;
              const mid = (n - 1) / 2;
              const rot = (i - mid) * 4.2;
              const lift = Math.abs(i - mid) * -2;
              const faceDown = display.faceDownIds.includes(card.id);
              const highlight = display.highlightIds.includes(card.id);
              const canPlay
                = myTurn
                  && view.phase === "playing"
                  && !display.animBusy
                  && legalIds.has(card.id);
              const dimIllegal
                = view.phase === "playing"
                  && myTurn
                  && !legalIds.has(card.id);
              return (
                <motion.div
                  key={`${display.dealEpoch}-${card.id}`}
                  initial={{
                    y: 210,
                    x: (mid - i) * 46,
                    opacity: 0,
                    rotate: (mid - i) * 10,
                    rotateY: 90,
                    scale: 0.72,
                  }}
                  animate={{
                    y: (canPlay ? -14 : 0) + lift,
                    x: 0,
                    opacity: dimIllegal ? 0.32 : 1,
                    rotate: rot,
                    rotateY: faceDown ? 90 : 0,
                    scale: 1,
                  }}
                  transition={{
                    delay: faceDown ? 0 : Math.min(i, 8) * 0.03,
                    type: "spring",
                    stiffness: 260,
                    damping: 22,
                  }}
                  style={{
                    marginLeft: i === 0
                      ? 0
                      : `calc(-1 * clamp(${n > 7 ? "24px, 3.7vw, 44px" : "20px, 3.1vw, 37px"}))`,
                    zIndex: i,
                    transformOrigin: "bottom center",
                  }}
                  className="origin-bottom"
                >
                  <PlayingCard
                    card={card}
                    faceDown={faceDown}
                    size="xl"
                    layoutId={`card-${card.id}`}
                    disabled={!canPlay}
                    onClick={canPlay ? () => play(card.id) : undefined}
                    glow={canPlay ? "legal" : highlight ? "gold" : false}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HudPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-[12px] border border-[var(--gold-2)]/[0.18] bg-black/45 px-3.5 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
      {children}
    </div>
  );
}

function ThemeSwitch({
  theme,
  onChange,
}: {
  theme: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-[12px] border border-white/[0.08] bg-black/40 px-2 py-1.5 backdrop-blur-md">
      {TABLE_THEMES.map(t => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          onClick={() => onChange(t.id)}
          className={cn(
            "size-5 rounded-full ring-2 ring-offset-1 ring-offset-black/40 transition",
            theme === t.id ? "ring-[var(--gold-2)]" : "ring-transparent",
          )}
          style={{ background: t.swatch }}
        />
      ))}
    </div>
  );
}

function RoomBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,_#2a2a34_0%,_#151518_45%,_#0a0a0c_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 to-transparent" />
    </>
  );
}
