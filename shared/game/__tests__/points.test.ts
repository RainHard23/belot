import { createDeck } from "../deck";
import {
  cardPoints,
  DECK_CARD_POINTS,
  DECK_TOTAL_POINTS,
  LAST_TRICK_BONUS,
  toPoints,
} from "../points";
import { SUITS } from "../types";

describe("points", () => {
  it("deck card points total 152; + last trick = 162", () => {
    const deck = createDeck();
    for (const trump of SUITS) {
      const sum = deck.reduce((s, c) => s + cardPoints(c, trump), 0);
      expect(sum).toBe(DECK_CARD_POINTS);
      expect(sum + LAST_TRICK_BONUS).toBe(DECK_TOTAL_POINTS);
    }
  });

  it("rounds to points on 6", () => {
    expect(toPoints(56)).toBe(6);
    expect(toPoints(55)).toBe(5);
    expect(toPoints(162)).toBe(16);
    expect(toPoints(0)).toBe(0);
  });
});
