import type { Seat, Suit } from "./types";
import { OTHER_SEAT } from "./types";

export type BidAction
  = | { type: "pass" }
    | { type: "take" } // round 1: take face-up suit
    | { type: "choose"; suit: Suit }; // round 2: other suit

export interface BiddingState {
  round: 1 | 2;
  faceUpSuit: Suit;
  turn: Seat;
  passes: number;
  taker: Seat | null;
  trump: Suit | null;
}

export function createBidding(
  faceUpSuit: Suit,
  firstSpeaker: Seat,
): BiddingState {
  return {
    round: 1,
    faceUpSuit,
    turn: firstSpeaker,
    passes: 0,
    taker: null,
    trump: null,
  };
}

export function applyBid(
  state: BiddingState,
  seat: Seat,
  action: BidAction,
): BiddingState | { redeal: true } | { error: string } {
  if (seat !== state.turn)
    return { error: "not_your_turn" };
  if (state.taker)
    return { error: "already_taken" };

  if (state.round === 1) {
    if (action.type === "take") {
      return {
        ...state,
        taker: seat,
        trump: state.faceUpSuit,
      };
    }
    if (action.type === "pass") {
      const passes = state.passes + 1;
      if (passes >= 2) {
        return {
          ...state,
          round: 2,
          passes: 0,
          turn: OTHER_SEAT[seat] === state.turn
            ? OTHER_SEAT[seat]
            : OTHER_SEAT[seat],
          // After both pass round1, first speaker of round2 is same as first of round1
          // We need to track firstSpeaker - simplify: next turn is OTHER of current, after 2 passes reset turn to original first
        };
      }
      // Actually after first pass, turn goes to other; after second pass go to round 2 with first speaker again
      return {
        ...state,
        passes,
        turn: OTHER_SEAT[seat],
      };
    }
    return { error: "invalid_round1_action" };
  }

  // round 2
  if (action.type === "pass") {
    const passes = state.passes + 1;
    if (passes >= 2)
      return { redeal: true };
    return { ...state, passes, turn: OTHER_SEAT[seat] };
  }
  if (action.type === "choose") {
    if (action.suit === state.faceUpSuit) {
      return { error: "must_be_other_suit" };
    }
    return {
      ...state,
      taker: seat,
      trump: action.suit,
    };
  }
  return { error: "invalid_round2_action" };
}

/** Fix round1→round2 transition: after 2 passes, round 2 starts with original first speaker */
export function applyBidFixed(
  state: BiddingState,
  seat: Seat,
  action: BidAction,
  firstSpeaker: Seat,
): BiddingState | { redeal: true } | { error: string } {
  if (seat !== state.turn)
    return { error: "not_your_turn" };
  if (state.taker)
    return { error: "already_taken" };

  if (state.round === 1) {
    if (action.type === "take") {
      return { ...state, taker: seat, trump: state.faceUpSuit };
    }
    if (action.type === "pass") {
      const passes = state.passes + 1;
      if (passes >= 2) {
        return {
          ...state,
          round: 2,
          passes: 0,
          turn: firstSpeaker,
        };
      }
      return { ...state, passes, turn: OTHER_SEAT[seat] };
    }
    return { error: "invalid_round1_action" };
  }

  if (action.type === "pass") {
    const passes = state.passes + 1;
    if (passes >= 2)
      return { redeal: true };
    return { ...state, passes, turn: OTHER_SEAT[seat] };
  }
  if (action.type === "choose") {
    if (action.suit === state.faceUpSuit)
      return { error: "must_be_other_suit" };
    return { ...state, taker: seat, trump: action.suit };
  }
  return { error: "invalid_round2_action" };
}
