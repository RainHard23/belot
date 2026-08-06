import type { BidAction, MatchAnimEvent, PlayerView, Seat } from "@shared/game";
import type { EmoteKind, EmotePayload } from "@shared/net/protocol";
import type { MatchDisplay } from "@/ui/motion/playMatchAnimScript";
import { create } from "zustand";
import { errText } from "@/ui/i18n/ru";
import { matchAnimQueue } from "@/ui/motion/animationQueue";
import {
  emptyDisplay,

  playMatchAnimScript,
} from "@/ui/motion/playMatchAnimScript";
import { getSocket } from "../net/socket";

/** How long a table reaction stays visible before fading out. */
const REACTION_TTL_MS = 2_400;

export interface SeatReaction {
  kind: EmoteKind;
  ts: number;
}

interface MatchState {
  matchId: string | null;
  committed: PlayerView | null;
  display: MatchDisplay;
  players: { seat: Seat; name: string }[];
  error: string | null;
  endedReason: string | null;
  /** Last emote per seat — network-driven, both players see both sides. */
  reactions: Partial<Record<Seat, SeatReaction>>;
  join: (matchId: string) => void;
  bid: (action: BidAction) => void;
  play: (cardId: string) => void;
  nextHand: () => void;
  sendEmote: (kind: EmoteKind) => void;
  clear: () => void;
  clearError: () => void;
}

const reactionTimers = new Map<Seat, ReturnType<typeof setTimeout>>();

/** Bound match socket handlers — removed by identity so lobby's match:ended stays. */
let onMatchState: ((payload: {
  matchId: string;
  view: PlayerView;
  players: { seat: Seat; name: string }[];
  anim?: MatchAnimEvent[];
  snap?: boolean;
}) => void) | null = null;
let onMatchEnded: ((payload: { matchId: string; reason?: string }) => void) | null = null;
let onMatchEmote: ((payload: EmotePayload) => void) | null = null;

function unbindMatchSocket() {
  const s = getSocket();
  if (onMatchState)
    s.off("match:state", onMatchState);
  if (onMatchEnded)
    s.off("match:ended", onMatchEnded);
  if (onMatchEmote)
    s.off("match:emote", onMatchEmote);
  onMatchState = null;
  onMatchEnded = null;
  onMatchEmote = null;
}

function clearReactionTimer(seat: Seat) {
  const t = reactionTimers.get(seat);
  if (t)
    clearTimeout(t);
  reactionTimers.delete(seat);
}

function clearAllReactionTimers() {
  for (const t of reactionTimers.values())
    clearTimeout(t);
  reactionTimers.clear();
}

function scheduleReactionClear(
  seat: Seat,
  ts: number,
  set: (fn: (s: MatchState) => Partial<MatchState>) => void,
) {
  clearReactionTimer(seat);
  reactionTimers.set(
    seat,
    setTimeout(() => {
      reactionTimers.delete(seat);
      set((state) => {
        const cur = state.reactions[seat];
        if (!cur || cur.ts !== ts)
          return {};
        const next = { ...state.reactions };
        delete next[seat];
        return { reactions: next };
      });
    }, REACTION_TTL_MS),
  );
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matchId: null,
  committed: null,
  display: emptyDisplay(),
  players: [],
  error: null,
  endedReason: null,
  reactions: {},
  join: (matchId) => {
    const s = getSocket();
    matchAnimQueue.reset();
    clearAllReactionTimers();
    unbindMatchSocket();
    set({
      matchId,
      committed: null,
      display: emptyDisplay(),
      players: [],
      error: null,
      endedReason: null,
      reactions: {},
    });
    s.emit("match:join", { matchId }, (res: { error?: string }) => {
      if (res?.error) {
        try {
          if (res.error === "no_match" || res.error === "not_seated")
            sessionStorage.removeItem("bilot_active_match");
        }
        catch { /* ignore */ }
        set({
          error: errText(res.error),
          endedReason: res.error === "no_match" || res.error === "not_seated"
            ? "ended"
            : get().endedReason,
        });
      }
    });
    onMatchEmote = (payload: EmotePayload) => {
      if (payload.matchId !== get().matchId)
        return;
      set(state => ({
        reactions: { ...state.reactions, [payload.seat]: { kind: payload.kind, ts: payload.ts } },
      }));
      scheduleReactionClear(payload.seat, payload.ts, set);
    };
    onMatchState = (payload) => {
      if (payload.matchId !== get().matchId)
        return;

      set({ players: payload.players, committed: payload.view, error: null });

      playMatchAnimScript({
        anim: payload.anim ?? [],
        nextView: payload.view,
        snap: payload.snap === true,
        setDisplay: (patch) => {
          set((state) => {
            const nextPatch
              = typeof patch === "function" ? patch(state.display) : patch;
            return {
              display: { ...state.display, ...nextPatch },
            };
          });
        },
      });
    };
    onMatchEnded = (payload) => {
      if (payload.matchId !== get().matchId)
        return;
      set({
        endedReason: payload.reason === "opponent_left"
          ? "opponent_left"
          : "ended",
      });
    };
    s.on("match:emote", onMatchEmote);
    s.on("match:state", onMatchState);
    s.on("match:ended", onMatchEnded);
  },
  bid: (action) => {
    const matchId = get().matchId;
    if (!matchId || get().display.animBusy)
      return;
    getSocket().emit("match:bid", { matchId, action }, (res: { error?: string }) => {
      if (res?.error)
        set({ error: errText(res.error) });
    });
  },
  play: (cardId) => {
    const matchId = get().matchId;
    if (!matchId || get().display.animBusy)
      return;
    getSocket().emit("match:play", { matchId, cardId }, (res: { error?: string }) => {
      if (res?.error)
        set({ error: errText(res.error) });
    });
  },
  nextHand: () => {
    const matchId = get().matchId;
    if (!matchId || get().display.animBusy)
      return;
    getSocket().emit("match:nextHand", { matchId }, (res: { error?: string }) => {
      // Both clients may race auto-next — ignore expected phase errors.
      if (res?.error && res.error !== "wrong_phase" && res.error !== "match_over")
        set({ error: errText(res.error) });
    });
  },
  sendEmote: (kind) => {
    const matchId = get().matchId;
    if (!matchId)
      return;
    getSocket().emit("match:emote", { matchId, kind }, (res: { error?: string }) => {
      if (res?.error && res.error !== "rate_limited")
        set({ error: errText(res.error) });
    });
  },
  clear: () => {
    matchAnimQueue.reset();
    clearAllReactionTimers();
    unbindMatchSocket();
    set({
      matchId: null,
      committed: null,
      display: emptyDisplay(),
      players: [],
      error: null,
      endedReason: null,
      reactions: {},
    });
  },
  clearError: () => set({ error: null }),
}));
