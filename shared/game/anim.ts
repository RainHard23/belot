import type { MatchState } from "./match";
import type { Card, Phase, Seat, TrickPlay } from "./types";
import { trickWinner } from "./trick";
import { OTHER_SEAT } from "./types";

/** Visual timeline events derived from MatchState transitions (per seat). */
export type MatchAnimEvent
  = | { type: "clear_table" }
    | {
      type: "deal";
      cards: Card[];
      kind: "initial" | "rest";
      /** Packet index within the classic 3-3-3-3 deal (0..3), for stock ticks. */
      packet?: number;
    }
    | {
      type: "opp_deal";
      from: number;
      to: number;
      kind: "initial" | "rest";
      packet?: number;
    }
    | { type: "face_up_show"; card: Card }
    | { type: "face_up_hide"; cardId: string; takenBy: Seat }
    | { type: "bid_ui"; phase: "bidding1" | "bidding2" }
    | { type: "play"; seat: Seat; card: Card }
    | { type: "trick_collect"; winner: Seat; trick: TrickPlay[] }
    | { type: "hand_end" }
    | { type: "sync"; phase: Phase };

function cardIds(cards: Card[]) {
  return new Set(cards.map(c => c.id));
}

function newCards(prev: Card[], next: Card[]): Card[] {
  const had = cardIds(prev);
  return next.filter(c => !had.has(c.id));
}

function findRemovedPlay(prev: MatchState, next: MatchState): TrickPlay | null {
  for (const seat of ["p0", "p1"] as Seat[]) {
    const nextIds = cardIds(next.hands[seat]);
    for (const card of prev.hands[seat]) {
      if (!nextIds.has(card.id))
        return { seat, card };
    }
  }
  return null;
}

function isNewHand(prev: MatchState | null, next: MatchState): boolean {
  if (!prev)
    return next.phase !== "waiting";
  if (prev.phase === "waiting")
    return true;
  if (prev.phase === "handEnd" && (next.phase === "bidding1" || next.phase === "bidding2"))
    return true;
  // Redeal during bidding — face-up / hands replaced
  if (
    (prev.phase === "bidding1" || prev.phase === "bidding2")
    && (next.phase === "bidding1" || next.phase === "bidding2")
    && prev.faceUp?.id !== next.faceUp?.id
  ) {
    return true;
  }
  return false;
}

/**
 * Pure: turn a state transition into an ordered animation script for one seat.
 * Client runs these serially before committing the final PlayerView.
 */
export function deriveAnimEvents(
  prev: MatchState | null,
  next: MatchState,
  seat: Seat,
): MatchAnimEvent[] {
  const events: MatchAnimEvent[] = [];
  const opp = OTHER_SEAT[seat];

  if (next.phase === "waiting")
    return events;

  if (isNewHand(prev, next)) {
    events.push({ type: "clear_table" });
    // Classic 3-3-3-3 from the non-dealer, then the dealer, twice.
    const first = next.firstSpeaker;
    const order: Seat[] = [first, OTHER_SEAT[first], first, OTHER_SEAT[first]];
    let yourIdx = 0;
    let oppCount = 0;
    for (let packet = 0; packet < 4; packet++) {
      const to = order[packet]!;
      if (to === seat) {
        const cards = next.hands[seat].slice(yourIdx, yourIdx + 3);
        yourIdx += 3;
        events.push({ type: "deal", cards, kind: "initial", packet });
      }
      else {
        events.push({
          type: "opp_deal",
          from: oppCount,
          to: oppCount + 3,
          kind: "initial",
          packet,
        });
        oppCount += 3;
      }
    }
    if (next.faceUp) {
      events.push({ type: "face_up_show", card: next.faceUp });
    }
    if (next.phase === "bidding1" || next.phase === "bidding2") {
      events.push({ type: "bid_ui", phase: next.phase });
    }
    return events;
  }

  if (!prev)
    return [{ type: "sync", phase: next.phase }];

  // Bidding phase change (e.g. round1 → round2)
  if (
    (prev.phase === "bidding1" || prev.phase === "bidding2")
    && (next.phase === "bidding1" || next.phase === "bidding2")
    && prev.phase !== next.phase
  ) {
    events.push({ type: "bid_ui", phase: next.phase });
  }

  // Bidding resolved → trump + rest of deal
  if (
    prev.faceUp
    && !next.faceUp
    && next.trump
    && (prev.phase === "bidding1" || prev.phase === "bidding2")
    && next.phase === "playing"
  ) {
    const takenBy = next.taker ?? seat;
    events.push({
      type: "face_up_hide",
      cardId: prev.faceUp.id,
      takenBy,
    });
    const added = newCards(prev.hands[seat], next.hands[seat]);
    if (added.length) {
      events.push({ type: "deal", cards: added, kind: "rest" });
    }
    const oppFrom = prev.hands[opp].length;
    const oppTo = next.hands[opp].length;
    if (oppTo > oppFrom) {
      events.push({
        type: "opp_deal",
        from: oppFrom,
        to: oppTo,
        kind: "rest",
      });
    }
    events.push({ type: "sync", phase: "playing" });
    return events;
  }

  // First card of trick (server keeps length-1 trick)
  if (next.trick.length === prev.trick.length + 1 && next.trick.length >= 1) {
    const played = next.trick[next.trick.length - 1]!;
    events.push({
      type: "play",
      seat: played.seat,
      card: played.card,
    });
  }

  // Second card completes trick in one server step (trick cleared immediately)
  if (
    prev.trick.length === 1
    && next.trick.length === 0
    && prev.trump
    && (next.phase === "playing" || next.phase === "handEnd")
  ) {
    const played = findRemovedPlay(prev, next);
    if (played) {
      events.push({
        type: "play",
        seat: played.seat,
        card: played.card,
      });
      const fullTrick = [...prev.trick, played];
      const winner = trickWinner(fullTrick, prev.trump);
      events.push({
        type: "trick_collect",
        winner,
        trick: fullTrick,
      });
    }
  }

  // Safety: both cards present then cleared (if server ever keeps len=2)
  if (prev.trick.length === 2 && next.trick.length === 0 && prev.trump) {
    const winner = trickWinner(prev.trick, prev.trump);
    events.push({
      type: "trick_collect",
      winner,
      trick: [...prev.trick],
    });
  }

  if (prev.phase !== "handEnd" && next.phase === "handEnd") {
    events.push({ type: "hand_end" });
  }

  return events;
}
