import type { Card, Rank, Suit } from "./types";

/**
 * Classic Belote sequence order (low→high): 9-10-J-Q-K-A.
 * Contiguous runs use this — NOT trick-taking strength (where 10 beats K).
 */
const SEQUENCE_ORDER: Rank[] = ["9", "10", "J", "Q", "K", "A"];

/** Classic belote trump strength high→low: J, 9, A, 10, K, Q */
const TRUMP_STRENGTH: Rank[] = ["J", "9", "A", "10", "K", "Q"];
/** Non-trump high→low: A, 10, K, Q, J, 9 */
const NON_TRUMP_STRENGTH: Rank[] = ["A", "10", "K", "Q", "J", "9"];

export function trumpStrength(rank: Rank): number {
  return TRUMP_STRENGTH.length - TRUMP_STRENGTH.indexOf(rank);
}

export function nonTrumpStrength(rank: Rank): number {
  return NON_TRUMP_STRENGTH.length - NON_TRUMP_STRENGTH.indexOf(rank);
}

export function cardBeats(
  a: Card,
  b: Card,
  ledSuit: Suit,
  trump: Suit,
): boolean {
  const aTrump = a.suit === trump;
  const bTrump = b.suit === trump;
  if (aTrump && !bTrump)
    return true;
  if (!aTrump && bTrump)
    return false;
  if (aTrump && bTrump)
    return trumpStrength(a.rank) > trumpStrength(b.rank);
  if (a.suit === ledSuit && b.suit !== ledSuit)
    return true;
  if (a.suit !== ledSuit && b.suit === ledSuit)
    return false;
  if (a.suit === ledSuit && b.suit === ledSuit) {
    return nonTrumpStrength(a.rank) > nonTrumpStrength(b.rank);
  }
  return false;
}

export function sequenceOrder(rank: Rank): number {
  return SEQUENCE_ORDER.indexOf(rank);
}
