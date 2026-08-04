import type { Card } from "./types";
import { RANKS, SUITS } from "./types";

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

export function dealInitial(deck: Card[]): {
  hands: { p0: Card[]; p1: Card[] };
  faceUp: Card;
  stock: Card[];
} {
  const d = [...deck];
  const p0 = d.splice(0, 6);
  const p1 = d.splice(0, 6);
  const faceUp = d.shift()!;
  return { hands: { p0, p1 }, faceUp, stock: d };
}
