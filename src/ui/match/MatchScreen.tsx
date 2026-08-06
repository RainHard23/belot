import type { Suit } from "@shared/game";
import type { RoomQuality, RoomStyle } from "@/store/settingsStore";
import { legalMoves, SUITS } from "@shared/game";
import { HelpCircle, Menu, Settings, Volume2, VolumeX, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useMatchStore } from "@/store/matchStore";
import { useResolvedRoomQuality, useSettingsStore } from "@/store/settingsStore";
import { attachSoundBus } from "@/ui/audio/soundBus";
import { ru } from "@/ui/i18n/ru";
import { emitAmbient } from "./ambientBus";
import { AmbientOverlay } from "./AmbientOverlay";
import { ActionButton, IconButton } from "./controls/ActionButton";
import { Panel } from "./controls/Panel";
import { Pill } from "./controls/Pill";
import { Popover } from "./controls/Popover";
import { EmotePanel } from "./EmotePanel";
import { HandEndPanel } from "./HandEndPanel";
import { HandLogPanel } from "./HandLogPanel";
import { HintsPanel } from "./HintsPanel";
import { KittyStack } from "./KittyStack";
import { PlayingCard } from "./PlayingCard";
import { LegacyBackdrop } from "./room/LegacyBackdrop";
import { RoomStage } from "./room/RoomStage";
import { ScorePanel } from "./ScorePanel";
import { SeatPod } from "./SeatPod";
import { gridTemplateRows, useStageRows } from "./stageLayout";
import { TableSurface } from "./TableSurface";
import { TrickPile } from "./TrickPile";

const TABLE_THEMES = [
  { id: "neon", label: "Неон", swatch: "linear-gradient(135deg,#16244f,#3b6bff)" },
  { id: "sapphire", label: "Сапфир", swatch: "#205e82" },
  { id: "emerald", label: "Изумруд", swatch: "#1f6b4f" },
  { id: "burgundy", label: "Бордо", swatch: "#7c2338" },
] as const;

const HAND_SIZE_MAP = { sm: "md", md: "lg", lg: "xl" } as const;

/**
 * One row of theme swatches, tied to a room style. Two of these let the new
 * 3D room and the old flat backdrop be compared on the same theme with one
 * click, and the ring shows which combination is live.
 */
function ThemeRow({
  themes,
  theme,
  activeStyle,
  rowStyle,
  onPick,
  onStyle,
}: {
  themes: typeof TABLE_THEMES;
  theme: string;
  activeStyle: RoomStyle;
  rowStyle: RoomStyle;
  onPick: (t: (typeof TABLE_THEMES)[number]["id"]) => void;
  onStyle: (v: RoomStyle) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {themes.map((t) => {
        const active = theme === t.id && activeStyle === rowStyle;
        return (
          <button
            key={t.id}
            type="button"
            title={rowStyle === "legacy" ? `${t.label} — старый фон` : t.label}
            onClick={() => {
              onPick(t.id);
              onStyle(rowStyle);
            }}
            className={cn(
              "size-6 rounded-full ring-2 ring-offset-1 ring-offset-black/40 transition",
              active ? "ring-[var(--accent)]" : "ring-transparent",
              // The legacy row reads as the muted "before" set.
              rowStyle === "legacy" && "opacity-55 saturate-50",
            )}
            style={{ background: t.swatch }}
          />
        );
      })}
    </div>
  );
}

/** `auto` picks a tier from the device; the rest are manual overrides. */
const ROOM_QUALITY_OPTIONS = [
  { id: "auto", label: "Авто" },
  { id: "high", label: "Высокое" },
  { id: "medium", label: "Среднее" },
  { id: "low", label: "Низкое" },
] as const satisfies readonly { id: RoomQuality; label: string }[];

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
    reactions,
    sendEmote,
  } = useMatchStore();
  const view = display.view;

  const theme = useSettingsStore(s => s.theme);
  const setTheme = useSettingsStore(s => s.setTheme);
  const soundOn = useSettingsStore(s => s.soundOn);
  const setSoundOn = useSettingsStore(s => s.setSoundOn);
  const soundVolume = useSettingsStore(s => s.soundVolume);
  const setSoundVolume = useSettingsStore(s => s.setSoundVolume);
  const hintsOn = useSettingsStore(s => s.hintsOn);
  const setHintsOn = useSettingsStore(s => s.setHintsOn);
  const leftHanded = useSettingsStore(s => s.leftHanded);
  const cardSize = useSettingsStore(s => s.cardSize);
  const roomQualitySetting = useSettingsStore(s => s.roomQuality);
  const setRoomQuality = useSettingsStore(s => s.setRoomQuality);
  const roomStyle = useSettingsStore(s => s.roomStyle);
  const setRoomStyle = useSettingsStore(s => s.setRoomStyle);
  const roomQuality = useResolvedRoomQuality();
  // The legacy backdrop has no floor to reflect in, so the table's reflection
  // would just be a smear floating on a photo.
  const showReflection = roomStyle === "room3d" && roomQuality !== "low";

  const stageRows = useStageRows();
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [showMobilePanels, setShowMobilePanels] = useState(false);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const matchOverAnnouncedRef = useRef(false);
  // Touch/coarse pointers (phones, tablets) get two-tap-to-play below instead
  // of the desktop single-click — `whileHover` lift means nothing without a
  // mouse, so a direct tap would otherwise play a card the instant it's
  // touched, which is exactly the "accidental move" this avoids.
  const [isCoarsePointer] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches === true,
  );

  useEffect(() => {
    join(matchId);
    return () => clear();
  }, [join, matchId, clear]);

  useEffect(() => {
    if (endedReason === "opponent_left")
      onLeave();
  }, [endedReason, onLeave]);

  // Mount the WebAudio layer once; it self-subscribes to ambientBus and
  // unlocks on first user gesture (autoplay policy).
  useEffect(() => attachSoundBus(), []);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- resetting the keyboard-nav cursor when a new hand is dealt is intentional
    setSelectedCardIdx(null);
  }, [display.dealEpoch]);

  useEffect(() => {
    if (view?.matchOver && !matchOverAnnouncedRef.current) {
      matchOverAnnouncedRef.current = true;
      emitAmbient(view.matchOver.winner === view.you ? "win" : "lose");
    }
    if (!view?.matchOver)
      matchOverAnnouncedRef.current = false;
  }, [view?.matchOver, view?.you]);

  const legalIds = useMemo(() => {
    if (!view || view.phase !== "playing" || !view.trump)
      return new Set<string>();
    if (view.turn !== view.you)
      return new Set<string>();
    return new Set(
      legalMoves(view.hand, view.trick, view.trump).map(c => c.id),
    );
  }, [view]);

  const myTurn = useMemo(
    () => !!view && view.turn === view.you && !display.animBusy && !view.matchOver,
    [view, display.animBusy],
  );
  const bidding = useMemo(
    () =>
      !!view
      && display.bidVisible
      && (view.phase === "bidding1" || view.phase === "bidding2"),
    [view, display.bidVisible],
  );

  // Keyboard shortcuts — bidding (Enter=take, Esc=pass, 1-4=suit), hand
  // navigation (arrows + Enter to play), "?" toggles the cheatsheet.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA")
        return;

      if (e.key === "?") {
        setShowHotkeys(v => !v);
        return;
      }
      if (!view)
        return;

      if (bidding && myTurn) {
        if (e.key === "Enter" && view.phase === "bidding1") {
          e.preventDefault();
          bid({ type: "take" });
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          bid({ type: "pass" });
          return;
        }
        if (view.phase === "bidding2" && /^[1-4]$/.test(e.key)) {
          const options = SUITS.filter(s => s !== view.bidding?.faceUpSuit);
          const idx = Number(e.key) - 1;
          if (options[idx]) {
            e.preventDefault();
            bid({ type: "choose", suit: options[idx] });
          }
          return;
        }
      }

      if (view.phase === "playing" && myTurn) {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const n = view.hand.length;
          if (n === 0)
            return;
          setSelectedCardIdx((idx) => {
            const cur = idx ?? Math.floor(n / 2);
            return e.key === "ArrowLeft" ? Math.max(0, cur - 1) : Math.min(n - 1, cur + 1);
          });
          return;
        }
        if (e.key === "Enter" && selectedCardIdx !== null) {
          const card = view.hand[selectedCardIdx];
          if (card && legalIds.has(card.id)) {
            e.preventDefault();
            play(card.id);
            setSelectedCardIdx(null);
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, bidding, myTurn, selectedCardIdx, bid, play, legalIds]);

  if (!view) {
    return (
      <div
        data-table-theme={theme}
        className="relative flex min-h-screen flex-col items-center justify-center gap-3 overflow-hidden bg-[#0e0e11] text-white"
      >
        {roomStyle === "legacy"
          ? <LegacyBackdrop theme={theme} />
          : <RoomStage theme={theme} quality={roomQuality} />}
        <AmbientOverlay />
        <div className="relative z-10 text-lg font-semibold">{ru.loadingTable}</div>
        {error && <div className="relative z-10 text-sm text-rose-300">{error}</div>}
        <button type="button" className="relative z-10 text-sm text-[var(--accent)]" onClick={onLeave}>
          {ru.backLobby}
        </button>
      </div>
    );
  }

  const opp = players.find(p => p.seat !== view.you);
  const you = players.find(p => p.seat === view.you);
  const oppSeat = view.you === "p0" ? "p1" : "p0";
  const tableTrick = display.heldTrick?.length
    ? display.heldTrick
    : view.trick;
  const showHandEnd = (view.phase === "handEnd" || view.matchOver) && !display.animBusy;
  const handCardSize = HAND_SIZE_MAP[cardSize];

  const oppDecls = view.declarations
    .filter(d => d.seat === oppSeat)
    .map(d => `${ru.decls[d.kind] ?? d.kind} +${d.gameBonus}`);
  const yourDecls = view.declarations
    .filter(d => d.seat === view.you)
    .map(d => `${ru.decls[d.kind] ?? d.kind} +${d.gameBonus}`);

  const sidePanels = (
    <>
      <HandLogPanel players={players} you={view.you} />
      <ScorePanel view={view} players={players} />
      {hintsOn && <HintsPanel view={view} />}
      <EmotePanel onSend={sendEmote} />
    </>
  );

  /** Rendered in the dock row normally, over the felt on compact stages. */
  const bidBar = bidding && myTurn && (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex flex-wrap items-center justify-center gap-2 rounded-[18px] border border-white/[0.08] bg-[#1d1d22]/92 p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    >
      {view.phase === "bidding1" && (
        <ActionButton variant="take" size="md" onClick={() => bid({ type: "take" })}>
          {ru.take}
          {" "}
          {view.faceUp ? ru.suitSym[view.faceUp.suit] : ""}
        </ActionButton>
      )}
      {view.phase === "bidding2"
        && SUITS.filter(s => s !== view.bidding?.faceUpSuit).map((suit, i) => (
          <ActionButton
            key={suit}
            variant="suit"
            size="md"
            onClick={() => bid({ type: "choose", suit })}
            title={`Клавиша ${i + 1}`}
          >
            {ru.suitSym[suit]}
            {" "}
            {ru.suits[suit]}
          </ActionButton>
        ))}
      <ActionButton variant="pass" size="md" onClick={() => bid({ type: "pass" })}>
        {ru.pass}
      </ActionButton>
    </motion.div>
  );

  return (
    <div
      data-table-theme={theme}
      className="relative grid h-dvh max-h-dvh overflow-hidden bg-[#02060f] font-[Nunito,sans-serif] text-white"
      style={{ gridTemplateRows: gridTemplateRows(stageRows.hud, stageRows.hand) }}
    >
      {roomStyle === "legacy"
        ? <LegacyBackdrop theme={theme} />
        : <RoomStage theme={theme} quality={roomQuality} />}
      <AmbientOverlay />

      {/* aria-live phase announcer — screen readers hear phase/turn changes
        * without us needing a second visible element for it. */}
      <div className="sr-only" aria-live="polite">
        {phaseAnnouncement(view.phase, myTurn, view.trump)}
      </div>

      {/* Row 1: HUD */}
      <header className="relative z-40 flex shrink-0 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <ActionButton variant="ghost" size="sm" onClick={onLeave}>
            ←
            {" "}
            {ru.backLobby}
          </ActionButton>
          <IconButton
            label={ru.chatTitle}
            className="min-[1100px]:hidden"
            active={showMobilePanels}
            onClick={() => setShowMobilePanels(v => !v)}
          >
            <Menu size={16} />
          </IconButton>
        </div>

        {/* Never wraps: a second row here would spill out of the fixed-height
          * HUD row and land on top of the opponent's seat pod (visible at
          * 390px). Bolts drop out instead — they're in the score panel too. */}
        <div className="flex min-w-0 flex-nowrap items-center justify-center gap-1.5 overflow-hidden">
          <Pill>
            <span className="text-[var(--muted)]">{ru.score}</span>
            <span className="font-bold tabular-nums text-[var(--accent)]">
              {view.matchScore.p0}
              {" "}
              :
              {" "}
              {view.matchScore.p1}
            </span>
            <span className="text-[var(--muted)]">
              /
              {view.target}
            </span>
          </Pill>
          <Pill className="hidden sm:flex">
            <span className="text-[var(--muted)]">{ru.bolts}</span>
            <span className="font-semibold tabular-nums">
              {view.matchScore.bolts.p0}
              /
              {view.matchScore.bolts.p1}
            </span>
          </Pill>
          <Pill>
            {view.trump
              ? (
                  <>
                    <span className="text-[var(--muted)]">{ru.trump}</span>
                    <span className="font-bold text-[var(--accent)]">
                      {ru.suitSym[view.trump]}
                      {" "}
                      {ru.suits[view.trump]}
                    </span>
                  </>
                )
              : <span className="font-semibold text-[var(--accent)]">{ru.bidding}</span>}
          </Pill>
        </div>

        <div className="flex items-center gap-1.5">
          <IconButton label="Горячие клавиши (?)" active={showHotkeys} onClick={() => setShowHotkeys(v => !v)}>
            <HelpCircle size={16} />
          </IconButton>
          <SettingsPopover
            theme={theme}
            onTheme={setTheme}
            soundOn={soundOn}
            onSoundOn={setSoundOn}
            soundVolume={soundVolume}
            onSoundVolume={setSoundVolume}
            hintsOn={hintsOn}
            onHintsOn={setHintsOn}
            roomQuality={roomQualitySetting}
            onRoomQuality={setRoomQuality}
            roomStyle={roomStyle}
            onRoomStyle={setRoomStyle}
          />
        </div>
      </header>

      {error && (
        <button
          type="button"
          onClick={clearError}
          className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-[12px] border border-rose-500/30 bg-rose-950/90 px-4 py-2 text-sm text-rose-200 shadow-xl backdrop-blur"
        >
          {error}
          {" · скрыть"}
        </button>
      )}

      {showHotkeys && (
        <div className="fixed right-4 top-14 z-50 w-72">
          <Panel title="Горячие клавиши">
            <ul className="space-y-1 text-[12px] text-white/75">
              <li>Enter — взять открытую (1 круг торга)</li>
              <li>Esc — пас</li>
              <li>1–4 — выбор козыря (2 круг торга)</li>
              <li>← / → — выбор карты в руке</li>
              <li>Enter — сыграть выбранную карту</li>
              <li>? — показать/скрыть эту подсказку</li>
            </ul>
            <ActionButton variant="ghost" size="sm" onClick={() => setShowHotkeys(false)}>Закрыть</ActionButton>
          </Panel>
        </div>
      )}

      {/* Row 2: opponent seat pod */}
      <div className="relative z-30 flex justify-center pt-1">
        <SeatPod
          compact={stageRows.compact}
          key={`opp-${display.seatEpoch}-${opp?.name}`}
          name={opp?.name ?? "Соперник"}
          active={view.turn === oppSeat}
          tricks={view.tricksTaken[oppSeat]}
          isDealer={view.dealer === oppSeat}
          isTaker={view.taker === oppSeat}
          declarations={oppDecls}
          position="top"
          reaction={reactions[oppSeat] ?? null}
          turnDeadlineAt={view.turnDeadlineAt}
        />
      </div>

      {/* Row 3: felt — the only flexible row, and the anchor origin for every
        * card position below (see stageLayout.ts doc comment). */}
      <div className="relative z-10 min-h-0 overflow-hidden">
        {/* `inset-y-2` rather than `top-2` on purpose: with an auto height the
          * panels' `max-h` percentage had nothing to resolve against, so the
          * stack overflowed the felt row, made it scrollable despite
          * `overflow-hidden`, and a single focus-driven scroll then dragged
          * the whole table up out of view (only visible under ~780px tall). */}
        <aside
          className={cn(
            "pointer-events-none absolute inset-y-2 z-30 hidden w-[220px] min-[1100px]:block",
            leftHanded ? "right-3" : "left-3",
          )}
        >
          <div className="pointer-events-auto max-h-full overflow-y-auto">
            <HandLogPanel players={players} you={view.you} />
          </div>
        </aside>
        <aside
          className={cn(
            "pointer-events-none absolute inset-y-2 z-30 hidden w-[220px] min-[1100px]:block",
            leftHanded ? "left-3" : "right-3",
          )}
        >
          <div className="pointer-events-auto flex max-h-full flex-col gap-2 overflow-y-auto">
            <ScorePanel view={view} players={players} />
            {hintsOn && <HintsPanel view={view} />}
            <EmotePanel onSend={sendEmote} />
          </div>
        </aside>

        {stageRows.compact && bidBar && (
          <div className="absolute bottom-1 left-1/2 z-40 -translate-x-1/2">{bidBar}</div>
        )}

        <div className="absolute inset-0 mx-auto max-w-[1800px]">
          <TableSurface trumpSuit={view.trump} reflection={showReflection} />

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
          <div className="absolute left-1/2 top-[10%] z-20 flex -translate-x-1/2">
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
                <span className="rounded-full border border-[var(--accent)]/40 bg-black/55 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)] backdrop-blur">
                  {ru.faceUp}
                </span>
                <PlayingCard
                  card={view.faceUp}
                  size="lg"
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
                    size="lg"
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
      </div>

      {/* Row 4: dock — bidding bar + your seat pod. Auto height, so it never
        * steals space from the felt except while actually shown. On compact
        * stages the bar moves inside the felt row (above), leaving only the
        * pod here. */}
      <div className="relative z-30 flex flex-col items-center gap-1.5 px-3">
        {!stageRows.compact && bidBar}

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
          reaction={reactions[view.you] ?? null}
          turnDeadlineAt={view.turnDeadlineAt}
        />
      </div>

      {/* Row 5: hand fan — fixed height, never grows/shrinks the felt. */}
      <div className="relative z-30 flex w-full items-end justify-center overflow-visible px-3 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        {view.hand.map((card, i) => {
          const n = view.hand.length;
          const mid = (n - 1) / 2;
          const rot = (i - mid) * 4.2;
          const lift = Math.abs(i - mid) * -2;
          const faceDown = display.faceDownIds.includes(card.id);
          const highlight = display.highlightIds.includes(card.id);
          const selected = selectedCardIdx === i;
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
                y: 120,
                x: (mid - i) * 46,
                opacity: 0,
                rotate: (mid - i) * 10,
                rotateY: 90,
                scale: 0.72,
              }}
              animate={{
                y: (canPlay ? -10 : 0) + lift + (selected ? -16 : 0),
                x: 0,
                opacity: dimIllegal ? 0.32 : 1,
                rotate: rot,
                rotateY: faceDown ? 90 : 0,
                scale: selected ? 1.05 : 1,
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
                  : `calc(-1 * clamp(${n > 7 ? "22px, 3.4vw, 40px" : "18px, 2.8vw, 34px"}))`,
                zIndex: selected ? 50 : i,
                transformOrigin: "bottom center",
              }}
              className="origin-bottom"
            >
              <PlayingCard
                card={card}
                faceDown={faceDown}
                size={handCardSize}
                layoutId={`card-${card.id}`}
                disabled={!canPlay}
                onClick={canPlay
                  ? () => {
                      if (isCoarsePointer && selectedCardIdx !== i) {
                        setSelectedCardIdx(i);
                        return;
                      }
                      play(card.id);
                      setSelectedCardIdx(null);
                    }
                  : undefined}
                glow={canPlay ? "legal" : highlight ? "gold" : selected ? "gold" : false}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Hand-end / match-over — fixed modal overlay, independent of the grid
        * rows above so it never fights their sizing. */}
      <AnimatePresence>
        {showHandEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <HandEndPanel view={view} players={players} onNext={nextHand} onLeave={onLeave} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet — same panels as the desktop side rails, stacked. */}
      <AnimatePresence>
        {showMobilePanels && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/55 min-[1100px]:hidden"
              onClick={() => setShowMobilePanels(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-[20px] border-t border-white/10 bg-[#0a0b0e] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] min-[1100px]:hidden"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-white">{ru.logTitle}</span>
                <IconButton label="Закрыть" onClick={() => setShowMobilePanels(false)}>
                  <X size={16} />
                </IconButton>
              </div>
              <div className="flex flex-col gap-2">{sidePanels}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function phaseAnnouncement(phase: string, myTurn: boolean, trump: Suit | null | undefined) {
  if (phase === "bidding1" || phase === "bidding2")
    return myTurn ? ru.bidding : ru.waitOpp;
  if (phase === "playing")
    return myTurn ? ru.yourTurn : ru.waitOpp;
  if (phase === "handEnd")
    return ru.handOver;
  if (trump)
    return `${ru.trump}: ${ru.suits[trump]}`;
  return "";
}

function SettingsPopover({
  theme,
  onTheme,
  soundOn,
  onSoundOn,
  soundVolume,
  onSoundVolume,
  hintsOn,
  onHintsOn,
  roomQuality,
  onRoomQuality,
  roomStyle,
  onRoomStyle,
}: {
  theme: string;
  onTheme: (t: (typeof TABLE_THEMES)[number]["id"]) => void;
  soundOn: boolean;
  onSoundOn: (v: boolean) => void;
  soundVolume: number;
  onSoundVolume: (v: number) => void;
  hintsOn: boolean;
  onHintsOn: (v: boolean) => void;
  roomQuality: RoomQuality;
  onRoomQuality: (v: RoomQuality) => void;
  roomStyle: RoomStyle;
  onRoomStyle: (v: RoomStyle) => void;
}) {
  return (
    <Popover
      trigger={({ open, toggle }) => (
        <IconButton label="Настройки" active={open} onClick={toggle}>
          <Settings size={16} />
        </IconButton>
      )}
    >
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Тема стола</div>
          <ThemeRow
            themes={TABLE_THEMES}
            theme={theme}
            activeStyle={roomStyle}
            rowStyle="room3d"
            onPick={onTheme}
            onStyle={onRoomStyle}
          />
          <div className="mb-1.5 mt-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            Старая комната (сравнить)
          </div>
          <ThemeRow
            themes={TABLE_THEMES}
            theme={theme}
            activeStyle={roomStyle}
            rowStyle="legacy"
            onPick={onTheme}
            onStyle={onRoomStyle}
          />
        </div>

        <label className="flex items-center justify-between text-[12px] text-white/80">
          <span className="flex items-center gap-1.5">
            {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            Звук
          </span>
          <input
            type="checkbox"
            checked={soundOn}
            onChange={e => onSoundOn(e.target.checked)}
            className="accent-[var(--accent)]"
          />
        </label>
        {soundOn && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={soundVolume}
            onChange={e => onSoundVolume(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        )}

        <label className="flex items-center justify-between text-[12px] text-white/80">
          <span>Подсказки</span>
          <input
            type="checkbox"
            checked={hintsOn}
            onChange={e => onHintsOn(e.target.checked)}
            className="accent-[var(--accent)]"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-[12px] text-white/80">
          <span>Качество комнаты</span>
          <select
            value={roomQuality}
            onChange={e => onRoomQuality(e.target.value as RoomQuality)}
            className="rounded-[8px] border border-white/10 bg-black/50 px-1.5 py-1 text-[12px]"
          >
            {ROOM_QUALITY_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
    </Popover>
  );
}
