import type { BidAction, BiddingState } from "./bidding";
import type {
  Card,
  Declaration,
  MatchScore,
  Phase,
  Seat,
  Suit,
  TrickPlay,
} from "./types";
import { applyBidFixed, createBidding } from "./bidding";
import { createDeck, dealInitial, shuffle } from "./deck";
import { resolveDeclarations } from "./declarations";
import { LAST_TRICK_BONUS, sumCardPoints } from "./points";
import { createMatchScore, scoreHand } from "./scoring";
import { legalMoves, trickWinner } from "./trick";
import { OTHER_SEAT, SUITS } from "./types";

export interface MatchState {
  phase: Phase;
  dealer: Seat;
  hands: Record<Seat, Card[]>;
  faceUp: Card | null;
  stock: Card[];
  kitty: Card[];
  bidding: BiddingState | null;
  firstSpeaker: Seat;
  taker: Seat | null;
  trump: Suit | null;
  declarations: Declaration[];
  trick: TrickPlay[];
  trickLeader: Seat;
  wonCards: Record<Seat, Card[]>;
  tricksTaken: Record<Seat, number>;
  turn: Seat | null;
  matchScore: MatchScore;
  lastHandSummary: ReturnType<typeof scoreHand> | null;
}

export function createEmptyMatch(dealer: Seat = "p0"): MatchState {
  return {
    phase: "waiting",
    dealer,
    hands: { p0: [], p1: [] },
    faceUp: null,
    stock: [],
    kitty: [],
    bidding: null,
    firstSpeaker: OTHER_SEAT[dealer],
    taker: null,
    trump: null,
    declarations: [],
    trick: [],
    trickLeader: OTHER_SEAT[dealer],
    wonCards: { p0: [], p1: [] },
    tricksTaken: { p0: 0, p1: 0 },
    turn: null,
    matchScore: createMatchScore(),
    lastHandSummary: null,
  };
}

export function startHand(state: MatchState, rng?: () => number): MatchState {
  const deck = shuffle(createDeck(), rng);
  const { hands, faceUp, stock } = dealInitial(deck);
  const firstSpeaker = OTHER_SEAT[state.dealer];
  return {
    ...state,
    phase: "bidding1",
    hands,
    faceUp,
    stock,
    kitty: [],
    bidding: createBidding(faceUp.suit, firstSpeaker),
    firstSpeaker,
    taker: null,
    trump: null,
    declarations: [],
    trick: [],
    trickLeader: firstSpeaker,
    wonCards: { p0: [], p1: [] },
    tricksTaken: { p0: 0, p1: 0 },
    turn: firstSpeaker,
    lastHandSummary: null,
  };
}

export function bid(
  state: MatchState,
  seat: Seat,
  action: BidAction,
): MatchState | { error: string } {
  if (!state.bidding || !state.faceUp)
    return { error: "no_bidding" };
  if (state.phase !== "bidding1" && state.phase !== "bidding2") {
    return { error: "wrong_phase" };
  }

  const result = applyBidFixed(
    state.bidding,
    seat,
    action,
    state.firstSpeaker,
  );
  if ("error" in result)
    return result;
  if ("redeal" in result) {
    const nextDealer = OTHER_SEAT[state.dealer];
    return startHand({ ...state, dealer: nextDealer });
  }

  const bidding = result;
  if (bidding.taker && bidding.trump) {
    return finishBidding({ ...state, bidding }, bidding.taker, bidding.trump);
  }

  return {
    ...state,
    bidding,
    phase: bidding.round === 1 ? "bidding1" : "bidding2",
    turn: bidding.turn,
  };
}

function finishBidding(
  state: MatchState,
  taker: Seat,
  trump: Suit,
): MatchState {
  const faceUp = state.faceUp!;
  const stock = [...state.stock];
  const hands: Record<Seat, Card[]> = {
    p0: [...state.hands.p0],
    p1: [...state.hands.p1],
  };
  // Face-up goes to taker
  hands[taker].push(faceUp);

  // Deal remaining: each should end with 9. Taker has 7, other has 6.
  // Deal 2 more to taker and 3 to other (or deal in classic order from stock)
  const opp = OTHER_SEAT[taker];
  // Stock has 11 cards after face-up removed from original leftover 12-1=11?
  // dealInitial: 24-12=12 stock after faceUp taken from stock... wait dealInitial:
  // p0 6, p1 6, faceUp 1, stock 11. Yes.
  // After giving faceUp to taker: need +2 taker, +3 opp = 5 from stock, kitty 6.
  const toTaker = stock.splice(0, 2);
  const toOpp = stock.splice(0, 3);
  hands[taker].push(...toTaker);
  hands[opp].push(...toOpp);
  const kitty = stock.splice(0, 6);

  const { accepted } = resolveDeclarations(hands, trump);

  return {
    ...state,
    phase: "playing",
    hands,
    stock: [],
    kitty,
    faceUp: null,
    taker,
    trump,
    bidding: null,
    declarations: accepted,
    turn: state.firstSpeaker,
    trickLeader: state.firstSpeaker,
    trick: [],
  };
}

export function playCard(
  state: MatchState,
  seat: Seat,
  cardId: string,
): MatchState | { error: string } {
  if (state.phase !== "playing")
    return { error: "wrong_phase" };
  if (state.turn !== seat)
    return { error: "not_your_turn" };
  if (!state.trump)
    return { error: "no_trump" };

  const hand = state.hands[seat];
  const card = hand.find(c => c.id === cardId);
  if (!card)
    return { error: "card_not_in_hand" };

  const legal = legalMoves(hand, state.trick, state.trump);
  if (!legal.some(c => c.id === cardId))
    return { error: "illegal_card" };

  const newHand = hand.filter(c => c.id !== cardId);
  const trick = [...state.trick, { seat, card }];
  const hands = { ...state.hands, [seat]: newHand };

  if (trick.length < 2) {
    return {
      ...state,
      hands,
      trick,
      turn: OTHER_SEAT[seat],
    };
  }

  const winner = trickWinner(trick, state.trump);
  const wonCards = {
    ...state.wonCards,
    [winner]: [...state.wonCards[winner], ...trick.map(p => p.card)],
  };
  const tricksTaken = {
    ...state.tricksTaken,
    [winner]: state.tricksTaken[winner] + 1,
  };

  const cardsLeft = hands.p0.length + hands.p1.length;
  if (cardsLeft === 0) {
    return endHand({
      ...state,
      hands,
      trick: [],
      wonCards,
      tricksTaken,
      turn: null,
      phase: "handEnd",
    }, winner);
  }

  return {
    ...state,
    hands,
    trick: [],
    wonCards,
    tricksTaken,
    trickLeader: winner,
    turn: winner,
    phase: "playing",
  };
}

function endHand(state: MatchState, lastTrickWinner: Seat): MatchState {
  const trump = state.trump!;
  const kittyPoints = sumCardPoints(state.kitty, trump);
  const cardPoints = {
    p0: sumCardPoints(state.wonCards.p0, trump),
    p1: sumCardPoints(state.wonCards.p1, trump),
  };
  cardPoints[lastTrickWinner] += LAST_TRICK_BONUS;

  const summary = scoreHand({
    taker: state.taker!,
    cardPoints,
    kittyPoints,
    kittyTo: lastTrickWinner,
    declarations: state.declarations,
    tricksTaken: state.tricksTaken,
    match: state.matchScore,
  });

  return {
    ...state,
    phase: "handEnd",
    matchScore: summary.match,
    lastHandSummary: summary,
    turn: null,
    dealer: OTHER_SEAT[state.dealer],
  };
}

export function publicSuits(): Suit[] {
  return SUITS;
}

/** View for one player — hides opponent cards */
export function perspective(state: MatchState, seat: Seat) {
  const opp = OTHER_SEAT[seat];
  return {
    phase: state.phase,
    dealer: state.dealer,
    you: seat,
    hand: state.hands[seat],
    opponentCount: state.hands[opp].length,
    faceUp: state.faceUp,
    trump: state.trump,
    taker: state.taker,
    declarations: state.declarations,
    trick: state.trick,
    turn: state.turn,
    bidding: state.bidding
      ? {
          round: state.bidding.round,
          faceUpSuit: state.bidding.faceUpSuit,
          turn: state.bidding.turn,
        }
      : null,
    matchScore: state.matchScore,
    tricksTaken: state.tricksTaken,
    lastHandSummary: state.lastHandSummary,
    kittyCount: state.kitty.length,
    target: 501 as number,
    matchOver: null as null | { winner: Seat; reason: "points" | "bolts" },
  };
}

export type PlayerView = ReturnType<typeof perspective>;
