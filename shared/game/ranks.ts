import type { Card, Rank, Suit } from "./types";

/** Non-trump order low→high: 9, J, Q, K, 10, A */
const NON_TRUMP_ORDER: Rank[] = ["9", "J", "Q", "K", "10", "A"];
/** Trump order low→high: 9, 10, Q, K, A, J  — wait classic belote trump is: J, 9, A, 10, K, Q */

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
  return NON_TRUMP_ORDER.indexOf(rank);
}
