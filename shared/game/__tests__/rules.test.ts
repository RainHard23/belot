import type { Card, Seat } from "../types";
import { describe, expect, it } from "vitest";
import { applyBidFixed, createBidding } from "../bidding";
import { createDeck, dealInitial, shuffle } from "../deck";
import { resolveDeclarations } from "../declarations";
import { bid, createEmptyMatch, playCard, startHand } from "../match";
import { toPoints } from "../points";
import { createMatchScore, scoreHand } from "../scoring";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}_${suit}`, rank, suit };
}

describe("bidding classic", () => {
  it("round1 take sets trump to face suit", () => {
    const b = createBidding("hearts", "p0");
    const r = applyBidFixed(b, "p0", { type: "take" }, "p0");
    expect("taker" in r && r.taker).toBe("p0");
    if ("trump" in r)
      expect(r.trump).toBe("hearts");
  });

  it("both pass round1 then round2; non-dealer may pass, dealer must choose", () => {
    let b = createBidding("spades", "p0");
    let r = applyBidFixed(b, "p0", { type: "pass" }, "p0");
    expect("round" in r && r.round).toBe(1);
    b = r as typeof b;
    r = applyBidFixed(b, "p1", { type: "pass" }, "p0");
    expect("round" in r && r.round).toBe(2);
    b = r as typeof b;
    // Non-dealer (firstSpeaker p0) may still pass on round 2
    r = applyBidFixed(b, "p0", { type: "pass" }, "p0");
    expect("turn" in r && r.turn).toBe("p1");
    b = r as typeof b;
    // Dealer (p1) cannot pass — must name a suit
    r = applyBidFixed(b, "p1", { type: "pass" }, "p0");
    expect(r).toEqual({ error: "must_choose" });
    r = applyBidFixed(b, "p1", { type: "choose", suit: "hearts" }, "p0");
    expect("taker" in r && r.taker).toBe("p1");
    if ("trump" in r)
      expect(r.trump).toBe("hearts");
  });

  it("round2 cannot choose face suit", () => {
    let b = createBidding("clubs", "p0");
    b = applyBidFixed(b, "p0", { type: "pass" }, "p0") as typeof b;
    b = applyBidFixed(b, "p1", { type: "pass" }, "p0") as typeof b;
    const r = applyBidFixed(b, "p0", { type: "choose", suit: "clubs" }, "p0");
    expect(r).toEqual({ error: "must_be_other_suit" });
  });
});

describe("deal 3-3-3-3", () => {
  it("deals packets starting with the non-dealer", () => {
    const deck = shuffle(createDeck(), () => 0.42);
    const { hands, faceUp, stock } = dealInitial(deck, "p0");
    // Dealer p0 → first speaker p1 gets packets 1 and 3
    expect(hands.p1).toHaveLength(6);
    expect(hands.p0).toHaveLength(6);
    expect(faceUp).toBeTruthy();
    expect(stock).toHaveLength(11);
    // Reconstruct order from a fresh shuffle with same rng
    const d = shuffle(createDeck(), () => 0.42);
    expect(hands.p1.slice(0, 3).map(c => c.id)).toEqual(d.slice(0, 3).map(c => c.id));
    expect(hands.p0.slice(0, 3).map(c => c.id)).toEqual(d.slice(3, 6).map(c => c.id));
    expect(hands.p1.slice(3, 6).map(c => c.id)).toEqual(d.slice(6, 9).map(c => c.id));
    expect(hands.p0.slice(3, 6).map(c => c.id)).toEqual(d.slice(9, 12).map(c => c.id));
    expect(faceUp.id).toBe(d[12]!.id);
  });
});

describe("declarations", () => {
  it("bella always when K+Q trump", () => {
    const hands: Record<Seat, Card[]> = {
      p0: [card("K", "hearts"), card("Q", "hearts"), card("A", "spades")],
      p1: [card("A", "clubs"), card("10", "clubs")],
    };
    const { bella, accepted } = resolveDeclarations(hands, "hearts");
    expect(bella.some(d => d.seat === "p0")).toBe(true);
    expect(accepted.some(d => d.kind === "bella" && d.seat === "p0")).toBe(true);
  });

  it("equal tierces cancel", () => {
    const hands: Record<Seat, Card[]> = {
      p0: [card("9", "spades"), card("10", "spades"), card("J", "spades")],
      p1: [card("9", "clubs"), card("10", "clubs"), card("J", "clubs")],
    };
    const { accepted } = resolveDeclarations(hands, "hearts");
    const tierces = accepted.filter(d => d.kind === "tierce");
    expect(tierces.length).toBe(0);
  });

  it("scores classic AKQ tierce, not 9-J-Q", () => {
    const hands: Record<Seat, Card[]> = {
      p0: [card("A", "spades"), card("K", "spades"), card("Q", "spades")],
      p1: [card("9", "clubs"), card("J", "clubs"), card("Q", "clubs")],
    };
    const { accepted } = resolveDeclarations(hands, "hearts");
    expect(accepted.some(d => d.seat === "p0" && d.kind === "tierce")).toBe(true);
    expect(accepted.some(d => d.seat === "p1" && d.kind === "tierce")).toBe(false);
  });

  it("belny does not also count as tierce", () => {
    const hands: Record<Seat, Card[]> = {
      p0: [card("J", "hearts"), card("Q", "hearts"), card("K", "hearts")],
      p1: [card("A", "clubs"), card("10", "clubs")],
    };
    const { bella, accepted } = resolveDeclarations(hands, "hearts");
    expect(bella.some(d => d.seat === "p0" && d.rawPoints === 40)).toBe(true);
    expect(accepted.some(d => d.seat === "p0" && d.kind === "tierce")).toBe(false);
    const p0Bonus = accepted.filter(d => d.seat === "p0").reduce((s, d) => s + d.gameBonus, 0);
    expect(p0Bonus).toBe(4);
  });

  it("four jacks beat four nines", () => {
    const hands: Record<Seat, Card[]> = {
      p0: [card("J", "hearts"), card("J", "diamonds"), card("J", "spades"), card("J", "clubs")],
      p1: [card("9", "hearts"), card("9", "diamonds"), card("9", "spades"), card("9", "clubs")],
    };
    const { accepted } = resolveDeclarations(hands, "clubs");
    expect(accepted.some(d => d.kind === "four_jacks" && d.seat === "p0")).toBe(true);
    expect(accepted.some(d => d.kind === "four_nines")).toBe(false);
  });
});

describe("scoring", () => {
  it("toPoints rounds on 6", () => {
    expect(toPoints(56)).toBe(6);
    expect(toPoints(55)).toBe(5);
  });

  it("failed contract gives bolt to taker", () => {
    const match = createMatchScore();
    const result = scoreHand({
      taker: "p0",
      cardPoints: { p0: 40, p1: 80 },
      kittyPoints: 20,
      kittyTo: "p1",
      declarations: [],
      tricksTaken: { p0: 2, p1: 7 },
      match,
    });
    expect(result.match.bolts.p0).toBe(1);
    expect(result.hand.p0.totalRaw).toBe(0);
  });

  it("tierce ochki convert to ~2 game points", () => {
    const match = createMatchScore();
    const result = scoreHand({
      taker: "p0",
      cardPoints: { p0: 80, p1: 72 },
      kittyPoints: 10,
      kittyTo: "p0",
      declarations: [{
        id: "p0_tierce",
        seat: "p0",
        kind: "tierce",
        rawPoints: 20,
        gameBonus: 2,
        cards: [],
      }],
      tricksTaken: { p0: 5, p1: 4 },
      match,
    });
    // 80+20+10 = 110 → 11 pts; without tierce would be 90 → 9
    expect(result.hand.p0.declarationPoints).toBe(20);
    expect(result.hand.p0.points).toBe(11);
  });

  it("annul declaration without tricks applies -10", () => {
    const match = createMatchScore();
    const result = scoreHand({
      taker: "p0",
      cardPoints: { p0: 152, p1: 0 },
      kittyPoints: 0,
      kittyTo: "p0",
      declarations: [{
        id: "p1_tierce",
        seat: "p1",
        kind: "tierce",
        rawPoints: 20,
        gameBonus: 2,
        cards: [],
      }],
      tricksTaken: { p0: 9, p1: 0 },
      match,
    });
    expect(result.match.p1).toBe(-10);
  });
});

describe("match flow smoke", () => {
  it("deals 6+faceUp and can take", () => {
    let state = createEmptyMatch("p0");
    state = startHand(state, () => 0.5);
    expect(state.hands.p0).toHaveLength(6);
    expect(state.hands.p1).toHaveLength(6);
    expect(state.faceUp).toBeTruthy();
    const r = bid(state, state.turn!, { type: "take" });
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.hands.p0.length + r.hands.p1.length).toBe(18);
      expect(r.kitty).toHaveLength(6);
      expect(r.trump).toBeTruthy();
    }
  });

  it("deck dealInitial leaves 11 in stock", () => {
    const { stock, faceUp } = dealInitial(shuffle(createDeck(), () => 0.42), "p0");
    expect(faceUp).toBeTruthy();
    expect(stock).toHaveLength(11);
  });
});

// silence unused playCard import if not used — use it lightly
void playCard;
