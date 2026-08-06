import type { Card, MatchState } from "../../../shared/game";
import { describe, expect, it } from "vitest";
import { createEmptyMatch } from "../../../shared/game";
import { decideTimeout } from "./turn-timer-logic";

function card(suit: Card["suit"], rank: Card["rank"]): Card {
  return { id: `${suit}-${rank}`, suit, rank };
}

function baseState(overrides: Partial<MatchState>): MatchState {
  return { ...createEmptyMatch("p0"), ...overrides };
}

describe("decideTimeout", () => {
  it("auto-passes during round-1 bidding", () => {
    const state = baseState({ phase: "bidding1" });
    expect(decideTimeout(state, "p0")).toEqual({
      kind: "bid",
      action: { type: "pass" },
    });
  });

  it("auto-passes during round-2 for the non-dealer", () => {
    const state = baseState({
      phase: "bidding2",
      firstSpeaker: "p0",
      bidding: {
        round: 2,
        faceUpSuit: "hearts",
        turn: "p0",
        passes: 0,
        taker: null,
        trump: null,
      },
    });
    expect(decideTimeout(state, "p0")).toEqual({
      kind: "bid",
      action: { type: "pass" },
    });
  });

  it("auto-chooses a suit on round-2 when the dealer must name trump", () => {
    const state = baseState({
      phase: "bidding2",
      firstSpeaker: "p0",
      dealer: "p1",
      bidding: {
        round: 2,
        faceUpSuit: "hearts",
        turn: "p1",
        passes: 1,
        taker: null,
        trump: null,
      },
    });
    const decision = decideTimeout(state, "p1", () => 0);
    expect(decision.kind).toBe("bid");
    if (decision.kind === "bid") {
      expect(decision.action.type).toBe("choose");
      if (decision.action.type === "choose") {
        expect(decision.action.suit).not.toBe("hearts");
      }
    }
  });

  it("plays a legal card when the phase is playing", () => {
    const hand = [card("hearts", "9"), card("hearts", "A"), card("clubs", "K")];
    const state = baseState({
      phase: "playing",
      trump: "clubs",
      hands: { p0: hand, p1: [] },
      trick: [],
    });
    const decision = decideTimeout(state, "p0", () => 0);
    expect(decision.kind).toBe("play");
    if (decision.kind === "play") {
      expect(hand.some(c => c.id === decision.cardId)).toBe(true);
    }
  });

  it("respects follow-suit legality, not just any card in hand", () => {
    const led = card("diamonds", "K");
    const hand = [card("hearts", "9"), card("diamonds", "A"), card("clubs", "10")];
    const state = baseState({
      phase: "playing",
      trump: "clubs",
      hands: { p0: hand, p1: [] },
      trick: [{ seat: "p1", card: led }],
    });
    const decision = decideTimeout(state, "p0", () => 0);
    expect(decision).toEqual({ kind: "play", cardId: "diamonds-A" });
  });

  it("does nothing if trump hasn't been decided yet (defensive, shouldn't happen)", () => {
    const state = baseState({ phase: "playing", trump: null, hands: { p0: [], p1: [] } });
    expect(decideTimeout(state, "p0")).toEqual({ kind: "none" });
  });

  it("does nothing outside bidding/playing phases", () => {
    const state = baseState({ phase: "handEnd" });
    expect(decideTimeout(state, "p0")).toEqual({ kind: "none" });
  });
});
