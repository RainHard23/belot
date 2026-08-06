import type { Seat, Suit } from "@shared/game";

/** Visual/audio atmosphere cues derived from match events. */
export type AmbientCue
  = | "deal"
    | "bid"
    | "trump"
    | "play"
    | "trick"
    | "hand_end"
    | "idle"
    /** Local player's turn just started (bidding or playing). */
    | "turn_start"
    /** A meld/declaration became visible. */
    | "declaration"
    /** Match ended — local player won. */
    | "win"
    /** Match ended — local player lost. */
    | "lose"
    /** Local player's clock ran out (server may have already auto-acted). */
    | "timeout";

export interface AmbientPayload {
  seat?: Seat;
  suit?: Suit;
  /** Whose side won the trick, relative to the local player. */
  side?: "top" | "bottom";
}

export interface AmbientEvent {
  cue: AmbientCue;
  payload?: AmbientPayload;
  at: number;
}

type AmbientListener = (event: AmbientEvent) => void;

const listeners = new Set<AmbientListener>();

export function emitAmbient(cue: AmbientCue, payload?: AmbientPayload) {
  const event: AmbientEvent = { cue, payload, at: Date.now() };
  for (const listener of listeners) {
    try {
      listener(event);
    }
    catch (err) {
      console.warn("ambient listener failed", err);
    }
  }
}

export function subscribeAmbient(listener: AmbientListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
