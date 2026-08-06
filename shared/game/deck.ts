import type { Card, Seat } from "./types";
import { OTHER_SEAT, RANKS, SUITS } from "./types";

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${rank}_${suit}`, suit, rank });
    }
  }
  return cards;
}

/** Fisher–Yates */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Classic Belote deal for 1×1 (24-card deck):
 * 3 → non-dealer, 3 → dealer, 3 → non-dealer, 3 → dealer,
 * then flip the next card (proposed trump), rest stays as stock.
 *
 * Hand arrays are in deal order (first 3 = first packet, next 3 = second),
 * which the animation layer uses to replay packets.
 */
export function dealInitial(deck: Card[], dealer: Seat): {
  hands: { p0: Card[]; p1: Card[] };
  faceUp: Card;
  stock: Card[];
} {
  const d = [...deck];
  const first = OTHER_SEAT[dealer];
  const hands: Record<Seat, Card[]> = { p0: [], p1: [] };

  hands[first].push(...d.splice(0, 3));
  hands[dealer].push(...d.splice(0, 3));
  hands[first].push(...d.splice(0, 3));
  hands[dealer].push(...d.splice(0, 3));

  const faceUp = d.shift()!;
  return { hands: { p0: hands.p0, p1: hands.p1 }, faceUp, stock: d };
}
