import type { Card, Rank, Suit } from "./types";

/** Card point values; trump 9=14, trump J=20 */
export function cardPoints(card: Card, trump: Suit): number {
  if (card.suit === trump) {
    if (card.rank === "9")
      return 14;
    if (card.rank === "J")
      return 20;
  }
  const map: Record<Rank, number> = {
    9: 0,
    10: 10,
    J: 2,
    Q: 3,
    K: 4,
    A: 11,
  };
  return map[card.rank];
}

export function sumCardPoints(cards: Card[], trump: Suit): number {
  return cards.reduce((s, c) => s + cardPoints(c, trump), 0);
}

/**
 * Convert raw ochki to «пункты».
 * Rounding threshold on 6: 56 → 6 points (floor(n/10) with remainder>=6 rounding up... )
 * Spec: «переход осуществляется на 6-ти, иначе говоря 56=6 пунктов»
 * So: points = floor((raw + 4) / 10)? 56+4=60/10=6. 55+4=59/10=5. Or: round where .6+ goes up.
 * Standard: floor(raw / 10) + (raw % 10 >= 6 ? 1 : 0)
 */
export function toPoints(raw: number): number {
  const base = Math.floor(raw / 10);
  const rem = Math.abs(raw % 10);
  if (raw >= 0)
    return base + (rem >= 6 ? 1 : 0);
  // negative bolts handled separately
  return -(base + (rem >= 6 ? 1 : 0));
}

/** Full deck card points = 152; +10 last trick = 162 */
export const DECK_CARD_POINTS = 152;
export const LAST_TRICK_BONUS = 10;
export const DECK_TOTAL_POINTS = DECK_CARD_POINTS + LAST_TRICK_BONUS;
export const EMPTY_GAME_POINTS = 16;
