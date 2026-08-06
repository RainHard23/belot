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
      if (res?.error)
        set({ error: errText(res.error) });
    });
    s.off("match:state");
    s.off("match:ended");
    s.off("match:emote");
    s.on("match:emote", (payload: EmotePayload) => {
      if (payload.matchId !== get().matchId)
        return;
      set(state => ({
        reactions: { ...state.reactions, [payload.seat]: { kind: payload.kind, ts: payload.ts } },
      }));
    });
    s.on(
      "match:state",
      (payload: {
        matchId: string;
        view: PlayerView;
        players: { seat: Seat; name: string }[];
        anim?: MatchAnimEvent[];
        snap?: boolean;
      }) => {
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
      },
    );
    s.on("match:ended", (payload: { matchId: string; reason?: string }) => {
      if (payload.matchId !== get().matchId)
        return;
      set({
        endedReason: payload.reason === "opponent_left"
          ? "opponent_left"
          : "ended",
      });
    });
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
      if (res?.error)
        set({ error: errText(res.error) });
    });
  },
  sendEmote: (kind) => {
    const matchId = get().matchId;
    if (!matchId)
      return;
    getSocket().emit("match:emote", { matchId, kind }, (res: { error?: string }) => {
      if (res?.error)
        set({ error: errText(res.error) });
    });
  },
  clear: () => {
    matchAnimQueue.reset();
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
