import type { Suit } from "@shared/game";
import type { RoomQuality, RoomStyle, TableThemeId } from "@/store/settingsStore";
import { legalMoves, SUITS } from "@shared/game";
import { ArrowLeft, HelpCircle, Menu, Settings, Volume2, VolumeX, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useLobbyStore } from "@/store/lobbyStore";
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
import { DeckStack } from "./DeckStack";
import { EmotePanel } from "./EmotePanel";
import { HandEndPanel } from "./HandEndPanel";
import { PlayingCard } from "./PlayingCard";
import { LegacyBackdrop } from "./room/LegacyBackdrop";
import { RoomStage } from "./room/RoomStage";
import { SceneBackdrop } from "./room/SceneBackdrop";
import { ScorePanel } from "./ScorePanel";
import { SeatPod } from "./SeatPod";
import { gridTemplateRows, useStageRows } from "./stageLayout";
import { getDeckAnchor, getOtboyAnchor, offsetFromAnchor } from "./tableAnchors";
import { TableSurface } from "./TableSurface";
import { TrickPile } from "./TrickPile";
import { TrumpBadge } from "./TrumpBadge";

const TABLE_THEMES = [
  { id: "neon", label: "Неон", swatch: "linear-gradient(135deg,#16244f,#3b6bff)" },
  { id: "sapphire", label: "Сапфир", swatch: "#205e82" },
  { id: "emerald", label: "Изумруд", swatch: "#1f6b4f" },
  { id: "burgundy", label: "Бордо", swatch: "#7c2338" },
] as const;

/** Full painted scenes — third settings row (`roomStyle: "scene"`). */
const SCENE_THEMES = [
  { id: "tavern", label: "Таверна", swatch: "linear-gradient(135deg,#6b3d28,#d4b896)" },
] as const;

interface ThemeSwatch { id: string; label: string; swatch: string }

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
  themes: readonly ThemeSwatch[];
  theme: string;
  activeStyle: RoomStyle;
  rowStyle: RoomStyle;
  onPick: (t: string) => void;
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
            title={
              rowStyle === "legacy"
                ? `${t.label} — старый фон`
                : rowStyle === "scene"
                  ? `${t.label} — сцена 1:1`
                  : t.label
            }
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

/** Full-bleed layer behind the stage grid (must span every track). */
const STAGE_BG_STYLE = { gridColumn: "1 / -1", gridRow: "1 / -1" } as const;

function MatchRoom({
  theme,
  roomStyle,
  roomQuality,
}: {
  theme: TableThemeId;
  roomStyle: RoomStyle;
  roomQuality: Exclude<RoomQuality, "auto">;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={STAGE_BG_STYLE}
    >
      {roomStyle === "scene"
        ? <SceneBackdrop theme={theme} />
        : roomStyle === "legacy"
          ? <LegacyBackdrop theme={theme} />
          : <RoomStage theme={theme} quality={roomQuality} />}
    </div>
  );
}

export function MatchScreen({
  matchId,
  onLeave,
}: {
  matchId: string;
  onLeave: (opts?: { soft?: boolean }) => void;
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
  const leftHanded = useSettingsStore(s => s.leftHanded);
  const cardSize = useSettingsStore(s => s.cardSize);
  const hintsOn = useSettingsStore(s => s.hintsOn);
  const setHintsOn = useSettingsStore(s => s.setHintsOn);
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
  const handDockRef = useRef<HTMLDivElement>(null);
  const oppRowRef = useRef<HTMLDivElement>(null);
  const trickCenterRef = useRef<HTMLDivElement>(null);
  /** Fly-from-deck offsets measured against live #table-deck-anchor. */
  const [deckToHand, setDeckToHand] = useState({ x: -280, y: -140 });
  const [deckToOpp, setDeckToOpp] = useState({ x: -280, y: 160 });
  const [otboyTop, setOtboyTop] = useState({ x: -280, y: -160 });
  const [otboyBottom, setOtboyBottom] = useState({ x: 280, y: 140 });

  // Lock document scroll for the whole match — log/panel scrolls must not
  // drag the stage (scrollIntoView / overscroll chaining).
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  // Deal / collect flights use real deck & otboy geometry.
  useEffect(() => {
    function measure() {
      const deck = getDeckAnchor();
      const toHand = offsetFromAnchor(handDockRef.current, deck);
      if (toHand)
        setDeckToHand(toHand);
      const toOpp = offsetFromAnchor(oppRowRef.current, deck);
      if (toOpp)
        setDeckToOpp(toOpp);
      const toTop = offsetFromAnchor(trickCenterRef.current, getOtboyAnchor("top"));
      if (toTop)
        setOtboyTop(toTop);
      const toBottom = offsetFromAnchor(trickCenterRef.current, getOtboyAnchor("bottom"));
      if (toBottom)
        setOtboyBottom(toBottom);
    }
    measure();
    // Remeasure after layout settles (deck/otboy mount mid-hand).
    const t = window.setTimeout(measure, 50);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [display.dealEpoch, display.oppShown, view?.phase, view?.stockCount, view?.kittyCount, view?.faceUp, view?.tricksTaken]);
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

  // Stale match id (server gone / not seated) — leave lobby seat if any.
  // Keep the match-over panel if we already have a result (peer left after win).
  useEffect(() => {
    if (endedReason !== "ended")
      return;
    if (view?.matchOver)
      return;
    onLeave({ soft: !useLobbyStore.getState().seatedTableId });
  }, [endedReason, onLeave, view?.matchOver]);

  useEffect(() => {
    if (endedReason === "opponent_left")
      window.dispatchEvent(new Event("belote:balance"));
  }, [endedReason]);

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
          if (!(view.phase === "bidding2" && view.you === view.dealer))
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
        <MatchRoom theme={theme} roomStyle={roomStyle} roomQuality={roomQuality} />
        <div className="pointer-events-none absolute inset-0 z-[1]">
          <AmbientOverlay />
        </div>
        {endedReason === "opponent_left"
          ? (
              <div className="relative z-10 flex max-w-sm flex-col items-center gap-3 rounded-[18px] border border-white/10 bg-black/70 px-6 py-5 text-center backdrop-blur">
                <div className="text-lg font-bold text-white">{ru.opponentLeft}</div>
                <p className="text-sm text-white/65">{ru.opponentLeftWin}</p>
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--accent)]"
                  onClick={() => onLeave({ soft: true })}
                >
                  {ru.backLobby}
                </button>
              </div>
            )
          : (
              <>
                <div className="relative z-10 text-lg font-semibold">{ru.loadingTable}</div>
                {error && <div className="relative z-10 text-sm text-rose-300">{error}</div>}
                <button type="button" className="relative z-10 text-sm text-[var(--accent)]" onClick={() => onLeave()}>
                  {ru.backLobby}
                </button>
              </>
            )}
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
      <ScorePanel view={view} players={players} />
      <EmotePanel onSend={sendEmote} />
    </>
  );

  /** Overlaid just above the hand fan during bidding. */
  const mustChoose = view.phase === "bidding2" && myTurn && view.you === view.dealer;
  const bidBar = bidding && myTurn && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
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
      {!mustChoose && (
        <ActionButton variant="pass" size="md" onClick={() => bid({ type: "pass" })}>
          {ru.pass}
        </ActionButton>
      )}
      {mustChoose && (
        <span className="px-2 text-[12px] font-semibold text-[var(--accent)]">{ru.mustChoose}</span>
      )}
    </motion.div>
  );

  return (
    <div
      data-table-theme={theme}
      className="relative grid h-dvh max-h-dvh overflow-hidden overscroll-none bg-[#02060f] font-[Nunito,sans-serif] text-white"
      style={{ gridTemplateRows: gridTemplateRows(stageRows.hud, stageRows.hand) }}
    >
      <MatchRoom theme={theme} roomStyle={roomStyle} roomQuality={roomQuality} />
      <div className="pointer-events-none absolute inset-0 z-[1]" style={STAGE_BG_STYLE}>
        <AmbientOverlay />
      </div>

      {/* aria-live phase announcer — screen readers hear phase/turn changes
        * without us needing a second visible element for it. */}
      <div className="sr-only" aria-live="polite">
        {phaseAnnouncement(view.phase, myTurn, view.trump)}
      </div>

      {/* Row 1: HUD */}
      <header className="relative z-40 flex shrink-0 items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <ActionButton
            variant="ghost"
            size="md"
            onClick={() => onLeave()}
            aria-label={ru.backLobby}
            className="gap-2 border-white/20 bg-black/65 px-4 text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] hover:border-[var(--accent)]/55 hover:bg-black/80 hover:text-[var(--accent)]"
          >
            <ArrowLeft size={16} strokeWidth={2.4} />
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

        {/* Compact score only — trump lives on the table, bolts in the side panel. */}
        <div className="flex min-w-0 flex-nowrap items-center justify-center gap-1.5 overflow-hidden">
          <Pill>
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
          {(view.phase === "bidding1" || view.phase === "bidding2") && (
            <Pill>
              <span className="font-semibold text-[var(--accent)]">{ru.bidding}</span>
            </Pill>
          )}
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

        {/* Felt — seats for opponent only; your seat sits under the hand. */}
      <div className="relative z-10 min-h-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-1 z-30 flex justify-center">
          <div className="pointer-events-auto">
            <SeatPod
              key={`opp-${opp?.name ?? "opp"}`}
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
        </div>

        <aside
          className={cn(
            "pointer-events-none absolute inset-y-2 z-30 hidden w-[220px] min-[1100px]:block",
            leftHanded ? "left-3" : "right-3",
          )}
        >
          <div className="pointer-events-auto flex h-full min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain">
            <ScorePanel view={view} players={players} />
            <EmotePanel onSend={sendEmote} />
          </div>
        </aside>

        <div className="absolute inset-0 z-0 mx-auto max-w-[1800px]">
          {/* Scene plates already paint the table — don't stack another one. */}
          {roomStyle !== "scene" && (
            <TableSurface
              theme={theme}
              trumpSuit={view.trump}
              reflection={showReflection}
            />
          )}

          {/* Stock / kitty + face-up trump on the deck during deal/bidding. */}
          <DeckStack
            count={
              view.phase === "playing" || view.phase === "handEnd"
                ? view.kittyCount
                : (display.stockShown || view.stockCount)
            }
            label={
              view.phase === "playing" || view.phase === "handEnd"
                ? ru.kitty
                : ru.deck
            }
            faceUp={view.faceUp}
          />

          {view.trump && <TrumpBadge suit={view.trump} />}

          {/* Two otboy piles — one per player, as in real Belote. */}
          {(view.phase === "playing" || view.phase === "handEnd") && (
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
            </>
          )}

          {/* Opponent backs — below seat pod so “Бот” never covers them. */}
          <div
            ref={oppRowRef}
            className="absolute left-1/2 top-[22%] z-20 flex -translate-x-1/2"
          >
            {Array.from({ length: display.oppShown }).map((_, i) => (
              <motion.div
                key={`opp-${display.dealEpoch}-${i}`}
                initial={{
                  y: deckToOpp.y,
                  x: deckToOpp.x,
                  opacity: 0,
                  scale: 0.65,
                  rotate: -18,
                }}
                animate={{ y: 0, x: 0, opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                style={{ marginLeft: i === 0 ? 0 : -42, zIndex: i }}
              >
                <PlayingCard faceDown size="sm" />
              </motion.div>
            ))}
          </div>

          {/* Center: live trick only (face-up lives on the deck). */}
          <div
            ref={trickCenterRef}
            className="absolute left-1/2 top-[48%] z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-6"
          >
            <AnimatePresence mode="popLayout">
              {tableTrick.map((p, idx) => {
                const collecting = display.collectTo != null;
                const collectTarget = display.collectTo === "top"
                  ? otboyTop
                  : display.collectTo === "bottom"
                    ? otboyBottom
                    : { x: 0, y: 0 };
                return (
                  <motion.div
                    key={p.card.id}
                    initial={{
                      scale: 0.65,
                      opacity: 0,
                      y: p.seat === view.you ? 70 : -70,
                      rotate: p.seat === view.you ? 6 : -6,
                    }}
                    animate={{
                      scale: collecting ? 0.4 : 1,
                      opacity: collecting ? 0 : 1,
                      y: collecting ? collectTarget.y : 0,
                      x: collecting
                        ? collectTarget.x
                        : (idx === 0 ? -8 : 8),
                      rotate: collecting
                        ? (display.collectTo === "top" ? -18 : 14)
                        : (idx === 0 ? -8 : 8),
                    }}
                    exit={{ opacity: 0, scale: 0.4 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22 }}
                  >
                    <PlayingCard
                      card={p.card}
                      size="lg"
                      layoutId={`trick-${p.card.id}`}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {tableTrick.length === 0 && !display.collectTo && view.phase === "playing" && (
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

      {/* Hand dock — cards overlap the table rail; avatar under cards. */}
      <div className="relative z-50 flex w-full flex-col items-center justify-end overflow-visible px-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {bidBar && (
          <div className="pointer-events-none absolute bottom-full left-0 right-0 z-[60] mb-1 flex justify-center">
            <div className="pointer-events-auto">{bidBar}</div>
          </div>
        )}
        <div ref={handDockRef} className="relative z-50 -mt-8 flex w-full items-end justify-center">
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
                  y: deckToHand.y,
                  x: deckToHand.x,
                  opacity: 0,
                  rotate: rot * 0.4 - 14,
                  scale: 0.55,
                }}
                animate={{
                  x: 0,
                  y: (canPlay ? -10 : 0) + lift + (selected ? -16 : 0),
                  opacity: dimIllegal ? 0.32 : 1,
                  rotate: rot,
                  scale: selected ? 1.05 : 1,
                }}
                transition={{
                  delay: faceDown ? 0 : Math.min(i, 8) * 0.025,
                  type: "spring",
                  stiffness: 320,
                  damping: 26,
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
                  layoutId={display.animBusy ? undefined : `card-${card.id}`}
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
                  glow={canPlay && hintsOn ? "legal" : highlight ? "gold" : selected ? "gold" : false}
                />
              </motion.div>
            );
          })}
        </div>

        <div className="relative z-40 mt-0.5 shrink-0">
          <SeatPod
            key={`you-${you?.name ?? "you"}`}
            name={you?.name ?? "Вы"}
            you
            active={view.turn === view.you && !view.matchOver}
            tricks={view.tricksTaken[view.you]}
            isDealer={view.dealer === view.you}
            isTaker={view.taker === view.you}
            declarations={yourDecls}
            position="bottom"
            reaction={reactions[view.you] ?? null}
            turnDeadlineAt={view.turnDeadlineAt}
          />
        </div>
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
            <HandEndPanel view={view} players={players} onNext={nextHand} onLeave={() => onLeave()} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {endedReason === "opponent_left" && !view.matchOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-[18px] border border-white/10 bg-[#12131a] px-6 py-5 text-center shadow-2xl">
              <div className="text-lg font-bold text-white">{ru.opponentLeft}</div>
              <p className="text-sm text-white/65">{ru.opponentLeftWin}</p>
              <ActionButton variant="primary" size="lg" onClick={() => onLeave({ soft: true })}>
                {ru.backLobby}
              </ActionButton>
            </div>
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
                <span className="text-sm font-bold text-white">{ru.scoreTitle}</span>
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
  onTheme: (t: TableThemeId) => void;
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
      side="bottom"
      align="end"
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
            onPick={id => onTheme(id as TableThemeId)}
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
            onPick={id => onTheme(id as TableThemeId)}
            onStyle={onRoomStyle}
          />
          <div className="mb-1.5 mt-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            Сцена 1:1
          </div>
          <ThemeRow
            themes={SCENE_THEMES}
            theme={theme}
            activeStyle={roomStyle}
            rowStyle="scene"
            onPick={id => onTheme(id as TableThemeId)}
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
          <span>Подсветка ходов</span>
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
