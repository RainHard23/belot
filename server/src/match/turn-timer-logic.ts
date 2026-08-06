import type { BidAction, MatchState, Seat } from "../../../shared/game";
import { legalMoves, SUITS } from "../../../shared/game";

/**
 * Pure decision of what happens when a human's turn clock expires. Kept
 * framework-free (no Nest decorators, no socket.io) so it can be unit
 * tested directly without bootstrapping the app — `TurnTimerService` is a
 * thin setTimeout/Map wrapper around this.
 */
export type TimeoutDecision
  = | { kind: "bid"; action: BidAction }
    | { kind: "play"; cardId: string }
    | { kind: "none" };

export function decideTimeout(
  state: MatchState,
  seat: Seat,
  rng: () => number = Math.random,
): TimeoutDecision {
  if (state.phase === "bidding1" || state.phase === "bidding2") {
    // Round 2 + dealer: pass is illegal — pick a random legal suit instead.
    if (
      state.phase === "bidding2"
      && state.firstSpeaker
      && seat !== state.firstSpeaker
      && state.bidding
    ) {
      const options = SUITS.filter(s => s !== state.bidding!.faceUpSuit);
      const suit = options[Math.floor(rng() * options.length)]!;
      return { kind: "bid", action: { type: "choose", suit } };
    }
    return { kind: "bid", action: { type: "pass" } };
  }
  if (state.phase === "playing") {
    if (!state.trump)
      return { kind: "none" };
    const legal = legalMoves(state.hands[seat], state.trick, state.trump);
    if (legal.length === 0)
      return { kind: "none" };
    const card = legal[Math.floor(rng() * legal.length)];
    return { kind: "play", cardId: card.id };
  }
  return { kind: "none" };
}
